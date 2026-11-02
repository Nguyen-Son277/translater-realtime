"""Text-only TranslateGemma protocol for a resident llama.cpp server.

The prompt is the text branch of llama.cpp b8500's
models/templates/google-translategemma-4b-it.jinja (Google's TranslateGemma
chat template): https://github.com/ggml-org/llama.cpp/blob/b8500/models/templates/google-translategemma-4b-it.jinja
Token IDs are sent to /completion so llama.cpp cannot add a
second BOS or tokenize the prompt differently from the budget check.
"""

import re

from app.config import LANGUAGE_NAMES

CONTEXT_TOKENS = 2048
INPUT_TOKENS = 1024
OUTPUT_TOKENS = CONTEXT_TOKENS - INPUT_TOKENS
MAX_TRANSLATION_CHARS = 32000
STOP_STRINGS = ["<end_of_turn>", "<eos>"]


def render_prompt(text: str, source: str, target: str) -> str:
    source_name = "Chinese" if source == "zh" else LANGUAGE_NAMES[source]
    target_name = "Chinese" if target == "zh" else LANGUAGE_NAMES[target]
    source_code = "zh-Hans" if source == "zh" else source
    target_code = "zh-Hans" if target == "zh" else target
    return (
        f"<bos><start_of_turn>user\nYou are a professional {source_name} ({source_code}) to "
        f"{target_name} ({target_code}) translator. Your goal is to accurately convey the meaning and "
        f"nuances of the original {source_name} text while adhering to {target_name} grammar, "
        "vocabulary, and cultural sensitivities.\n"
        f"Produce only the {target_name} translation, without any additional explanations or "
        f"commentary. Please translate the following {source_name} text into {target_name}:\n\n\n"
        f"{text.strip()}<end_of_turn>\n<start_of_turn>model\n"
    )


def split_boundary(text: str, limit: int) -> int:
    """Prefer complete paragraphs, then sentences/words, then Unicode codepoints.

    A separator belongs to the preceding chunk, allowing its exact whitespace
    to be restored after the model output (the canonical template trims it).
    """
    prefix = text[:limit]
    for pattern in (r"\n[\t \r\n]*", r"[.!?。！？](?:[\"'”’）)]*)\s*", r"\s+"):
        boundaries = [match.end() for match in re.finditer(pattern, prefix)
                      if text[:match.end()].strip()]
        if boundaries:
            return boundaries[-1]
    return limit


def completion_text(data: dict) -> str:
    if not isinstance(data, dict):
        raise ValueError("invalid completion")
    # Native API versions expose either stop_type or the legacy stop flags.
    # Missing completion metadata is not evidence of a successful completion.
    if data.get("truncated", False) is not False or data.get("stopped_limit", False) is not False:
        raise ValueError("truncated completion")
    if "stop_type" in data:
        finished = data["stop_type"] in {"eos", "word"}
    else:
        finished = data.get("stopped_eos") is True or data.get("stopped_word") is True
    result = data.get("content")
    if (not finished or not isinstance(result, str) or not result.strip()
            or len(result) > MAX_TRANSLATION_CHARS):
        raise ValueError("invalid completion")
    return result.strip()


async def translate(post, text: str, source: str, target: str, model: str) -> str:
    """Translate atomically; ``post`` supplies HTTP handling and the total deadline.

    Every candidate is measured by the server's tokenizer. Binary search need
    not find the maximal prefix (BPE counts aren't strictly monotonic), but
    every emitted prefix is independently checked and fits the hard budget.
    Cache lifetime is only this call; it cannot leak conversation text between
    users or grow indefinitely over the lifetime of the server.
    """
    if not text.strip():
        raise ValueError("empty input")
    token_cache: dict[str, list[int]] = {}

    async def tokens_for(value):
        key = value.strip()
        if key not in token_cache:
            data = await post("/tokenize", {
                "content": render_prompt(key, source, target),
                "add_special": False,  # Explicit <bos> in the canonical template.
                "parse_special": True,
                "with_pieces": False,
            })
            tokens = data.get("tokens") if isinstance(data, dict) else None
            if (not isinstance(tokens, list) or not tokens
                    or any(type(token) is not int or token < 0 for token in tokens)):
                raise ValueError("invalid tokenization")
            token_cache[key] = tokens
        return token_cache[key]

    # Establish all chunk boundaries before generating anything. A too-small
    # context, malformed tokenize reply or timeout cannot yield partial output.
    chunks = []
    remaining = text
    while remaining:
        if not remaining.strip():
            if chunks:
                chunks[-1] += remaining
            break
        tokens = await tokens_for(remaining)
        if len(tokens) <= INPUT_TOKENS:
            chunks.append(remaining)
            break
        low, high, fit = 1, len(remaining) - 1, 0
        while low <= high:
            middle = (low + high) // 2
            if len(await tokens_for(remaining[:middle])) <= INPUT_TOKENS:
                fit, low = middle, middle + 1
            else:
                high = middle - 1
        if not fit or not remaining[:fit].strip():
            raise ValueError("input cannot fit context")
        boundary = split_boundary(remaining, fit)
        # Prefer boundaries only if their exact re-tokenization still fits.
        if len(await tokens_for(remaining[:boundary])) > INPUT_TOKENS:
            boundary = fit
        chunks.append(remaining[:boundary])
        remaining = remaining[boundary:]

    output = []
    length = 0
    for chunk in chunks:
        tokens = await tokens_for(chunk)
        if len(tokens) > INPUT_TOKENS:
            raise ValueError("input exceeds context")
        data = await post("/completion", {
            "model": model,
            "prompt": tokens,
            "n_predict": OUTPUT_TOKENS,
            "temperature": 0,
            "stream": False,
            "stop": STOP_STRINGS,
            "cache_prompt": True,
            "n_keep": -1,
        })
        result = completion_text(data)
        leading = chunk[:len(chunk) - len(chunk.lstrip())]
        trailing = chunk[len(chunk.rstrip()):]
        rendered = leading + result + trailing
        length += len(rendered)
        if length > MAX_TRANSLATION_CHARS:
            raise ValueError("translation exceeds limit")
        output.append(rendered)
    return "".join(output).strip()
