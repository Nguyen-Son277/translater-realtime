"""Benchmark configured translation on fixed synthetic text, never stored conversations."""
import argparse
import asyncio
import json
import math
import statistics
import time

from app.config import Settings
from app.translation import LocalTranslator, TranslationError

SAMPLES = [
    ("vi", "en", "Xin chào, bạn có thể giúp tôi tìm nhà ga gần nhất không?"),
    ("en", "vi", "The meeting starts at 9:30 tomorrow morning in room 204."),
    ("vi", "en", "Tôi muốn đặt một bàn cho hai người lúc bảy giờ tối."),
    ("en", "vi", "Please send the updated document to Linh before Friday."),
    ("vi", "en", "Hôm nay trời mưa nên chúng tôi sẽ đi bằng taxi."),
    ("en", "vi", "Thank you for waiting. Your order will be ready in five minutes."),
]
OTHER_SAMPLES = [
    ("ja", "vi", "最寄りの駅はどこですか？"),
    ("ko", "vi", "가장 가까운 역은 어디인가요?"),
    ("zh", "vi", "最近的车站在哪里？"),
    ("fr", "vi", "Où est la gare la plus proche ?"),
    ("de", "vi", "Wo ist der nächste Bahnhof?"),
    ("es", "vi", "¿Dónde está la estación más cercana?"),
    *[("vi", language, "Cảm ơn bạn đã giúp đỡ tôi.") for language in ("ja", "ko", "zh", "fr", "de", "es")],
]


async def benchmark(args):
    settings = Settings()
    if args.backend:
        settings.translation_backend = args.backend
    if args.url:
        settings.translation_base_url = args.url
    if args.model:
        settings.translation_model = args.model
    if args.backend == "translategemma":
        settings.translation_api_key = ""
    translator = LocalTranslator(settings)
    durations, failures = [], []
    try:
        started = time.perf_counter()
        await translator.translate("Xin chào.", "vi", "en")
        warmup_ms = round((time.perf_counter() - started) * 1000, 1)
        print(json.dumps({"warmup_ms": warmup_ms, "backend": settings.translation_backend,
                          "model": settings.translation_model}), flush=True)
        samples = SAMPLES + (OTHER_SAMPLES if args.all_languages else [])
        for iteration in range(args.repeat):
            for source, target, text in samples:
                started = time.perf_counter()
                try:
                    result = await translator.translate(text, source, target)
                    elapsed = (time.perf_counter() - started) * 1000
                    durations.append(elapsed)
                    print(json.dumps({"iteration": iteration + 1, "source": source, "target": target,
                                      "ms": round(elapsed, 1), "translation": result}, ensure_ascii=False), flush=True)
                except TranslationError as exc:
                    failures.append(exc.code)
                    print(json.dumps({"source": source, "target": target, "error": exc.code}), flush=True)
        ordered = sorted(durations)
        print(json.dumps({"summary": {"successes": len(durations), "failures": failures,
                          "median_ms": round(statistics.median(ordered), 1) if ordered else None,
                          "p95_ms": round(ordered[math.ceil(.95 * len(ordered)) - 1], 1) if ordered else None}}), flush=True)
        return bool(failures)
    finally:
        await translator.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", choices=["openai", "translategemma"])
    parser.add_argument("--url")
    parser.add_argument("--model")
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--all-languages", action="store_true")
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error("repeat must be positive")
    try:
        raise SystemExit(int(asyncio.run(benchmark(args))))
    except TranslationError as exc:
        parser.exit(1, f"Warm-up failed: {exc.code}\n")


if __name__ == "__main__":
    main()
