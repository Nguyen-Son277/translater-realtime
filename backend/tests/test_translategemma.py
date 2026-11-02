import asyncio
import json

import httpx
import pytest
from pydantic import ValidationError

from app.config import LANGUAGES, Settings
from app.translategemma import INPUT_TOKENS, OUTPUT_TOKENS, render_prompt
from app.translation import LocalTranslator, TranslationError


def settings(**overrides):
    values = dict(_env_file=None, translation_backend="translategemma",
                  translation_base_url="http://local:8081/v1/", translation_model="translategemma-4b-it")
    values.update(overrides)
    return Settings(**values)


class NativeServer:
    """One token per Unicode codepoint makes chunk budgets deterministic."""

    def __init__(self, completion=None):
        self.requests = []
        self.prompts = []
        self.completion = completion

    def __call__(self, request):
        payload = json.loads(request.content)
        self.requests.append((request.url.path, payload))
        assert "authorization" not in request.headers
        if request.url.path == "/tokenize":
            assert payload["add_special"] is False
            assert payload["parse_special"] is True
            assert payload["with_pieces"] is False
            return httpx.Response(200, json={"tokens": [ord(char) for char in payload["content"]]})
        assert request.url.path == "/completion"
        assert all(type(token) is int for token in payload["prompt"])
        assert len(payload["prompt"]) <= INPUT_TOKENS
        assert payload["n_predict"] == OUTPUT_TOKENS == 1024
        assert payload["temperature"] == 0
        assert payload["stream"] is False
        assert payload["cache_prompt"] is True
        assert payload["n_keep"] == -1
        assert payload["stop"] == ["<end_of_turn>", "<eos>"]
        assert payload["model"] == "translategemma-4b-it"
        prompt = "".join(chr(token) for token in payload["prompt"])
        self.prompts.append(prompt)
        if self.completion is not None:
            return httpx.Response(200, json=self.completion)
        # Echo only source text to check splitting/reassembly without an LLM.
        original = prompt.split("\n\n\n", 1)[1].removesuffix("<end_of_turn>\n<start_of_turn>model\n")
        return httpx.Response(200, json={"content": original, "stop_type": "eos", "truncated": False})


async def run(server, text="Xin chào", source="vi", target="en", **overrides):
    translator = LocalTranslator(settings(**overrides), transport=httpx.MockTransport(server))
    try:
        return await translator.translate(text, source, target)
    finally:
        await translator.close()


def test_config_backend_defaults_and_validation():
    assert Settings(_env_file=None).translation_backend == "openai"
    assert settings().translation_backend == "translategemma"
    with pytest.raises(ValidationError):
        settings(translation_backend="other")


def test_canonical_prompt_matches_google_text_template():
    assert render_prompt("  Xin chào\n", "vi", "en") == (
        "<bos><start_of_turn>user\nYou are a professional Vietnamese (vi) to English (en) translator. "
        "Your goal is to accurately convey the meaning and nuances of the original Vietnamese text "
        "while adhering to English grammar, vocabulary, and cultural sensitivities.\n"
        "Produce only the English translation, without any additional explanations or commentary. "
        "Please translate the following Vietnamese text into English:\n\n\nXin chào"
        "<end_of_turn>\n<start_of_turn>model\n"
    )


@pytest.mark.parametrize("language", LANGUAGES)
async def test_native_contract_all_languages(language):
    server = NativeServer({"content": " Hello ", "stop_type": "word"})
    assert await run(server, source=language, target=language) == "Hello"
    assert [path for path, _ in server.requests] == ["/tokenize", "/completion"]
    assert server.prompts == [render_prompt("Xin chào", language, language)]
    assert server.prompts[0].count("<bos>") == 1
    assert "<start_of_turn>system" not in server.prompts[0]
    if language == "zh":
        assert "Chinese (zh-Hans) to Chinese (zh-Hans)" in server.prompts[0]
        assert "Simplified Chinese" not in server.prompts[0]


@pytest.mark.parametrize("base", ["http://local:8081", "http://local:8081/", "http://local:8081/v1"])
async def test_native_endpoint_normalization(base):
    assert await run(NativeServer(), translation_base_url=base) == "Xin chào"


@pytest.mark.parametrize("text", [
    "First paragraph. " * 23 + "\n\n" + "Second paragraph. " * 50,
    "Xin chào thế giới! " * 100,
    "你好世界。" * 240,
    "😊漢字é" * 800,
    "Long\n\n\t" + "x" * 1800 + "\nFinal line.",
    "a" * 4000,
])
async def test_chunking_preserves_source_order_unicode_and_newlines(text):
    server = NativeServer()
    assert await run(server, text=text) == text.strip()
    assert len(server.prompts) > 1
    assert all(len(prompt) <= INPUT_TOKENS for prompt in server.prompts)
    # All boundary/tokenization work completes before generation begins.
    paths = [path for path, _ in server.requests]
    assert "/tokenize" not in paths[paths.index("/completion"):]


async def test_paragraph_boundary_is_preferred():
    server = NativeServer()
    first = "A paragraph. " * 10
    text = first + "\n\n" + "B" * 1000
    assert await run(server, text=text) == text
    first_source = server.prompts[0].split("\n\n\n", 1)[1].split("<end_of_turn>", 1)[0]
    assert first_source == first.strip()


async def test_sentence_boundary_is_preferred():
    server = NativeServer()
    text = "A sentence. " + "b" * 1200
    assert await run(server, text=text) == text
    assert "\n\n\nA sentence.<end_of_turn>" in server.prompts[0]


@pytest.mark.parametrize("payload", [
    {}, [], {"content": ""}, {"content": "  ", "stop_type": "eos"},
    {"content": "partial", "stop_type": "limit"},
    {"content": "partial", "stop_type": "none"},
    {"content": "partial", "stop_type": "eos", "truncated": True},
    {"content": "partial", "stop_type": "eos", "stopped_limit": True},
    {"content": "partial", "stopped_limit": True, "stopped_eos": True},
    {"content": "no completion metadata"},
    {"content": None, "stop_type": "eos"},
    {"content": 123, "stop_type": "eos"},
    {"content": "a" * 32001, "stop_type": "eos"},
    {"content": "bad", "stop_type": []},
])
async def test_bad_or_truncated_completion_is_not_a_translation(payload):
    with pytest.raises(TranslationError, match="invalid_response"):
        await run(NativeServer(payload))


@pytest.mark.parametrize("flags", [{"stop_type": "eos"}, {"stop_type": "word"},
                                   {"stopped_eos": True}, {"stopped_word": True}])
async def test_native_completion_stop_metadata_compatibility(flags):
    assert await run(NativeServer({"content": "Hello", **flags})) == "Hello"


@pytest.mark.parametrize("payload", [{}, [], {"tokens": []}, {"tokens": "123"},
                                     {"tokens": [True]}, {"tokens": [-1]}, {"tokens": [{}]}])
async def test_malformed_tokenizer_never_calls_completion(payload):
    def respond(request):
        assert request.url.path == "/tokenize"
        return httpx.Response(200, json=payload)
    with pytest.raises(TranslationError, match="invalid_response"):
        await run(respond)


@pytest.mark.parametrize(("status", "code"), [(401, "upstream_auth"), (403, "upstream_auth"),
                                              (429, "rate_limited"), (500, "unavailable"),
                                              (503, "unavailable")])
@pytest.mark.parametrize("endpoint", ["/tokenize", "/completion"])
async def test_upstream_errors_are_safe_and_no_fallback(status, code, endpoint):
    server = NativeServer()
    def respond(request):
        if request.url.path == endpoint:
            return httpx.Response(status, json={"error": "private text"})
        return server(request)
    with pytest.raises(TranslationError) as error:
        await run(respond)
    assert error.value.code == code
    assert "private" not in str(error.value)


async def test_no_partial_result_when_later_chunk_fails():
    server = NativeServer()
    def respond(request):
        if request.url.path == "/completion" and server.prompts:
            return httpx.Response(503)
        return server(request)
    with pytest.raises(TranslationError, match="unavailable"):
        await run(respond, text="Hello. " * 300)
    assert len(server.prompts) == 1


async def test_total_result_limit_applies_across_chunks():
    server = NativeServer({"content": "a" * 17000, "stop_type": "eos"})
    with pytest.raises(TranslationError, match="invalid_response"):
        await run(server, text="Long text. " * 300)


async def test_total_timeout_includes_tokenization_and_all_chunks():
    server = NativeServer()
    async def respond(request):
        if request.url.path == "/completion":
            await asyncio.sleep(0.6)
        return server(request)
    translator = LocalTranslator(settings(translation_timeout=1), transport=httpx.MockTransport(respond))
    try:
        with pytest.raises(TranslationError, match="timeout"):
            await translator.translate("a" * 1600, "vi", "en")
        assert len(server.prompts) == 1
    finally:
        await translator.close()


async def test_tokenization_is_inside_total_deadline():
    async def respond(request):
        await asyncio.sleep(0.1)
        return httpx.Response(200, json={"tokens": [1]})
    translator = LocalTranslator(settings(), transport=httpx.MockTransport(respond))
    translator.settings.translation_timeout = 0.01
    try:
        with pytest.raises(TranslationError, match="timeout"):
            await translator.translate("secret", "vi", "en")
    finally:
        await translator.close()


@pytest.mark.parametrize(("exception", "code"), [(httpx.ReadTimeout, "timeout"),
                                                (httpx.ConnectError, "unavailable")])
async def test_transport_errors(exception, code):
    def respond(request):
        raise exception("private text", request=request)
    with pytest.raises(TranslationError) as error:
        await run(respond)
    assert error.value.code == code and "private" not in str(error.value)


async def test_cancellation_propagates_for_job_shutdown():
    async def respond(request):
        raise asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):
        await run(respond)


async def test_no_model_configuration_still_fails_without_network():
    def respond(request):
        pytest.fail("must not make a request")
    with pytest.raises(TranslationError, match="not_configured"):
        await run(respond, translation_model="")


async def test_invalid_json_is_safe():
    with pytest.raises(TranslationError, match="invalid_response"):
        await run(lambda request: httpx.Response(200, content=b"not json"))


async def test_impossible_prompt_budget_fails_without_generation():
    def respond(request):
        assert request.url.path == "/tokenize"
        return httpx.Response(200, json={"tokens": [1] * 1025})
    with pytest.raises(TranslationError, match="invalid_response"):
        await run(respond)
