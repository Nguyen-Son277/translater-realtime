"""Run the same PCM recognition path as the live microphone, using a local file."""
import argparse
import json
import statistics
import time

import numpy as np
from faster_whisper.audio import decode_audio

from app.config import LANGUAGES, Settings
from app.speech import create_recognizer


def main():
    parser = argparse.ArgumentParser(description="Kiểm tra model speech-to-text bằng file âm thanh")
    parser.add_argument("file")
    parser.add_argument("--language", default="auto", choices=["auto", *LANGUAGES])
    parser.add_argument("--seconds", type=float, default=6,
                        help="Số giây âm thanh đầu file cần nhận dạng (tối đa 10)")
    parser.add_argument("--repeat", type=int, default=1,
                        help="Số lần đo trên cùng đoạn âm thanh")
    args = parser.parse_args()
    if not 0 < args.seconds <= 10 or not 1 <= args.repeat <= 20:
        parser.error("--seconds phải trong (0, 10]; --repeat phải trong [1, 20]")
    settings = Settings()
    settings.prepare_directories()
    recognizer = create_recognizer(settings)
    model_name = (settings.speech_model if settings.speech_backend == "nemotron"
                  else settings.whisper_model)
    device = (settings.speech_device if settings.speech_backend == "nemotron"
              else settings.whisper_device)
    print(f"Đang tải model {model_name} ({device})…", flush=True)
    recognizer.model = recognizer.load_sync()
    audio = decode_audio(args.file, sampling_rate=16000)[:int(16000 * args.seconds)]
    if not len(audio):
        parser.error("File âm thanh rỗng")
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
    durations = []
    for _ in range(args.repeat):
        started = time.monotonic()
        result = recognizer.transcribe_sync(pcm, None if args.language == "auto" else args.language)
        durations.append(time.monotonic() - started)
    print(json.dumps({"backend": settings.speech_backend, "model": model_name,
                      "text": result.text, "language": result.language,
                      "confidence": round(result.confidence, 3),
                      "audio_seconds": len(audio) / 16000,
                      "processing_seconds": round(statistics.median(durations), 3),
                      "runs_seconds": [round(duration, 3) for duration in durations]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
