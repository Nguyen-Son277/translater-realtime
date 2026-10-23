import httpx
import pytest

from app.config import Settings
from app.translation import LocalTranslator, TranslationError


@pytest.mark.parametrize("base", ["http://local-model:8001", "http://local-model:8001/v1/"])
async def test_openai_compatible_contract_and_key_stays_server_side(base):
    def respond(request):
        assert str(request.url) == "http://local-model:8001/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer local-secret"
        import json
        payload = json.loads(request.content)
        assert payload["stream"] is False
        assert payload["model"] == "my-model"
        assert "Vietnamese" in payload["messages"][0]["content"]
        assert "English" in payload["messages"][0]["content"]
        assert payload["messages"][1] == {"role": "user", "content": "Xin chào"}
        return httpx.Response(200, json={"choices": [{"message": {"content": "Hello"}}]})
    settings = Settings(_env_file=None, translation_base_url=base, translation_model="my-model",
                        translation_api_key="local-secret")
    translator = LocalTranslator(settings, transport=httpx.MockTransport(respond))
    assert await translator.translate("Xin chào", "vi", "en") == "Hello"
    await translator.close()


@pytest.mark.parametrize(("status", "payload", "code"), [
    (401, {}, "upstream_auth"), (429, {}, "rate_limited"), (500, {}, "unavailable"),
    (200, {"choices": []}, "invalid_response"),
    (200, {"choices": [{"message": {"content": ""}}]}, "invalid_response"),
])
async def test_upstream_failures_are_safe(status, payload, code):
    translator = LocalTranslator(Settings(_env_file=None, translation_base_url="http://model/v1",
                                          translation_model="local"),
                                 transport=httpx.MockTransport(lambda _: httpx.Response(status, json=payload)))
    with pytest.raises(TranslationError) as error:
        await translator.translate("secret text", "vi", "en")
    assert error.value.code == code and "secret" not in str(error.value)
    await translator.close()


async def test_unconfigured_model_never_fabricates_a_translation():
    translator = LocalTranslator(Settings(_env_file=None))
    with pytest.raises(TranslationError, match="not_configured"):
        await translator.translate("Xin chào", "vi", "en")
    await translator.close()
