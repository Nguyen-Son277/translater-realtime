import asyncio
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass

import numpy as np
import webrtcvad

logger = logging.getLogger(__name__)
DRAIN_TIMEOUT = 15.0


@dataclass
class Transcript:
    text: str
    language: str
    confidence: float


class SpeechRecognizer:
    """Serialize model inference without blocking the WebSocket event loop."""

    def __init__(self, settings):
        self.settings = settings
        self.state = "loading" if settings.speech_enabled else "disabled"
        self.model = None
        self.semaphore = asyncio.Semaphore(1)
        self.initializing = None

    async def start(self):
        if self.settings.speech_enabled:
            self.initializing = asyncio.create_task(self.load())

    async def load(self):
        try:
            self.model = await asyncio.to_thread(self.load_sync)
            # Warm up inference before accepting microphone captures.
            await asyncio.to_thread(self.transcribe_sync, b"\x00" * 32000, "en")
            self.state = "ready"
        except Exception:
            self.state = "error"
            logger.exception("Speech model could not be loaded")

    def load_sync(self):
        raise NotImplementedError

    def transcribe_sync(self, pcm, language):
        raise NotImplementedError

    async def transcribe(self, pcm: bytes, language: str | tuple[str, ...] | None) -> Transcript:
        if self.state != "ready":
            raise RuntimeError("speech_unavailable")
        async with self.semaphore:
            return await self.infer(pcm, language)

    async def transcribe_preview(self, pcm: bytes,
                                 language: str | tuple[str, ...] | None) -> Transcript | None:
        # Previews never wait for the shared CPU. A final from either phone
        # must not queue behind a disposable preview from the other phone.
        if self.semaphore.locked():
            return None
        return await self.transcribe(pcm, language)

    async def infer(self, pcm, language):
        task = asyncio.create_task(asyncio.to_thread(self.transcribe_sync, pcm, language))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            # Cancelling to_thread does not stop model inference. Keep the slot
            # until the inference actually finishes, including during shutdown.
            await task
            raise

    async def close(self):
        if self.initializing:
            await asyncio.gather(self.initializing, return_exceptions=True)


class WhisperRecognizer(SpeechRecognizer):
    def load_sync(self):
        from faster_whisper import WhisperModel

        return WhisperModel(
            self.settings.whisper_model, device=self.settings.whisper_device,
            compute_type=self.settings.whisper_compute_type,
            cpu_threads=self.settings.whisper_cpu_threads,
            download_root=self.settings.whisper_download_root,
        )

    def transcribe_sync(self, pcm: bytes, language: str | tuple[str, ...] | None) -> Transcript:
        audio = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        detected_probability = None
        if isinstance(language, (tuple, list)):
            allowed = tuple(dict.fromkeys(language))
            if len(allowed) == 1:
                language = allowed[0]
            elif allowed:
                _, _, all_language_probs = self.model.detect_language(
                    audio, language_detection_segments=1,
                )
                probabilities = dict(all_language_probs or [])
                language = max(allowed, key=lambda candidate: probabilities.get(candidate, 0.0))
                detected_probability = probabilities.get(language, 0.0)
            else:
                language = None
        segments, info = self.model.transcribe(
            audio, language=language, beam_size=1, best_of=1, temperature=0,
            condition_on_previous_text=False, vad_filter=False,
            without_timestamps=True,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return Transcript(text[:4000], info.language,
                          detected_probability if detected_probability is not None
                          else info.language_probability)


def create_recognizer(settings):
    if settings.speech_backend == "whisper":
        return WhisperRecognizer(settings)
    from app.nemotron import NemotronRecognizer

    return NemotronRecognizer(settings)


@dataclass
class AudioPiece:
    kind: str
    segment_id: str
    pcm: bytes


class AudioSegmenter:
    """Accept arbitrary PCM packet boundaries; VAD always receives exact 20 ms frames."""

    frame_bytes = 640

    def __init__(self, vad=None, silence_ms=400, max_ms=4000, preview_ms=1000):
        self.vad = vad or webrtcvad.Vad(2)
        self.silence_ms, self.max_ms, self.preview_ms = silence_ms, max_ms, preview_ms
        self.remainder = bytearray()
        self.preroll = deque(maxlen=10)
        self.frames: list[bytes] = []
        self.voiced = 0
        self.silence = 0
        self.preview_at = 0
        self.segment_id = ""

    def feed(self, data: bytes) -> list[AudioPiece]:
        self.remainder.extend(data)
        pieces = []
        while len(self.remainder) >= self.frame_bytes:
            frame = bytes(self.remainder[:self.frame_bytes])
            del self.remainder[:self.frame_bytes]
            voice = self.vad.is_speech(frame, 16000)
            if not self.frames:
                if not voice:
                    self.preroll.append(frame)
                    continue
                self.frames = list(self.preroll)
                self.preroll.clear()
                self.segment_id = str(uuid.uuid4())
                self.preview_at = 0
            self.frames.append(frame)
            self.voiced += int(voice)
            self.silence = 0 if voice else self.silence + 20
            duration = len(self.frames) * 20
            if self.silence >= self.silence_ms or duration >= self.max_ms:
                final = self.flush_segment()
                if final:
                    pieces.append(final)
            elif (voice and duration - self.preview_at >= self.preview_ms
                  and self.voiced >= 10):
                pieces.append(AudioPiece("partial", self.segment_id, b"".join(self.frames)))
                self.preview_at = duration
        return pieces

    def flush_segment(self) -> AudioPiece | None:
        result = None
        if self.frames and self.voiced >= 10:
            result = AudioPiece("final", self.segment_id, b"".join(self.frames))
        self.frames, self.voiced, self.silence, self.preview_at = [], 0, 0, 0
        return result

    def flush(self) -> list[AudioPiece]:
        result = self.flush_segment()
        self.remainder.clear()
        self.preroll.clear()
        return [result] if result else []


class AudioStream:
    """One bounded stream per capture. Finals take priority over disposable previews."""

    def __init__(self, recognizer, connection, room, settings, hub, on_final, capture_id=None):
        self.recognizer, self.connection, self.room = recognizer, connection, room
        self.settings, self.hub, self.on_final = settings, hub, on_final
        self.capture_id = capture_id
        self.segmenter = AudioSegmenter(
            silence_ms=settings.speech_silence_ms,
            max_ms=settings.speech_max_segment_ms,
            preview_ms=settings.speech_preview_ms,
        )
        self.finals = deque()
        self.partial = None
        self.wake = asyncio.Event()
        self.stopping = False
        self.finished = set()
        self.preview_ids = set()
        self.processing = False
        self.cleanup_task = None
        self.worker = asyncio.create_task(self.run())

    def offer(self, piece):
        if piece.kind == "partial":
            # Do not catch up on old captions immediately after an inference.
            # The next live window will arrive naturally if the CPU can keep up.
            if self.processing or self.finals or self.stopping:
                return
            self.partial = piece
        else:
            if len(self.finals) >= self.settings.audio_queue_size:
                raise OverflowError("audio_queue_full")
            self.finals.append(piece)
            if self.partial and self.partial.segment_id == piece.segment_id:
                self.partial = None
        self.wake.set()

    def feed(self, data):
        for piece in self.segmenter.feed(data):
            self.offer(piece)

    async def preview(self, segment_id, text, speaker=None):
        if text:
            self.preview_ids.add(segment_id)
        else:
            self.preview_ids.discard(segment_id)
        await self.hub.broadcast(self.room.id, {
            "type": "transcript.partial", "segment_id": segment_id, "text": text,
            "speaker": speaker, "user_id": self.connection.user_id,
        })

    def speaker_for(self, transcript):
        if self.room.mode == "remote":
            return self.connection.side
        if transcript.confidence < self.settings.language_confidence:
            return None
        if transcript.language == self.room.language_a:
            return "A"
        if transcript.language == self.room.language_b:
            return "B"
        return None

    def detach(self, flush=True):
        if not self.stopping:
            if flush:
                for piece in self.segmenter.flush():
                    try:
                        self.offer(piece)
                    except OverflowError:
                        logger.warning("Audio tail rejected: capture queue full, room_id=%s", self.room.id)
            self.partial = None
            self.stopping = True
            self.cleanup_task = asyncio.create_task(self.clear_previews())
            self.wake.set()

    async def clear_previews(self):
        for segment_id in tuple(self.preview_ids):
            await self.preview(segment_id, "")

    async def run(self):
        while True:
            await self.wake.wait()
            if self.finals:
                piece = self.finals.popleft()
            elif self.partial and not self.stopping:
                piece, self.partial = self.partial, None
            elif self.stopping:
                break
            else:
                self.wake.clear()
                continue

            if self.room.mode == "remote":
                language = self.room.language_a if self.connection.side == "A" else self.room.language_b
            else:
                # Shared microphones may contain either room language. The
                # recognizer uses this pair to constrain or validate detection;
                # unrecognized languages must not be assigned to either speaker.
                language = (self.room.language_a, self.room.language_b)
            started = time.monotonic()
            self.processing = True
            try:
                if piece.kind == "partial":
                    if self.stopping:
                        continue
                    result = await self.recognizer.transcribe_preview(piece.pcm, language)
                    if result is None:
                        continue
                else:
                    result = await self.recognizer.transcribe(piece.pcm, language)
                speaker = self.speaker_for(result)
                if piece.kind == "final":
                    if result.text:
                        await self.on_final(piece.segment_id, result.text, speaker)
                    self.finished.add(piece.segment_id)
                    await self.preview(piece.segment_id, "")
                elif (piece.segment_id not in self.finished
                      and not any(p.segment_id == piece.segment_id for p in self.finals)
                      and not self.stopping):
                    await self.preview(piece.segment_id, result.text, speaker)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Speech processing failed: room_id=%s", self.room.id)
                await self.preview(piece.segment_id, "")
                try:
                    correlated = {"capture_id": self.capture_id} if self.capture_id is not None else {}
                    await self.connection.send({"type": "error", "code": "speech_failed",
                                                "detail": "Không nhận dạng được đoạn nói. Hãy thử lại hoặc nhập chữ.", **correlated})
                except Exception:
                    pass
            finally:
                self.processing = False
                logger.info("Speech kind=%s duration_ms=%d", piece.kind,
                            (time.monotonic() - started) * 1000)
            # Keep only the latest completed ID; the queue has at most one pending preview.
            if len(self.finished) > 20:
                self.finished = {piece.segment_id}

    async def stop(self, flush=True):
        self.detach(flush=flush)
        try:
            await asyncio.wait_for(asyncio.shield(self.worker), timeout=DRAIN_TIMEOUT)
        except TimeoutError:
            logger.warning("Audio stream drain timed out, room_id=%s", self.room.id)
            self.worker.cancel()
            try:
                correlated = {"capture_id": self.capture_id} if self.capture_id is not None else {}
                await self.connection.send({"type": "error", "code": "speech_drain_timeout",
                                            "detail": "Một đoạn nói trước chưa xử lý xong do quá tải. Hãy kiểm tra hội thoại và nói lại phần bị thiếu.", **correlated})
            except Exception:
                pass
            # Native inference cannot be interrupted safely. Keep its semaphore and
            # drain slot until it actually returns instead of starting overlapping work.
            await asyncio.gather(self.worker, return_exceptions=True)
        except asyncio.CancelledError:
            self.worker.cancel()
            await asyncio.gather(self.worker, return_exceptions=True)
            raise
        finally:
            self.finals.clear()
            if self.cleanup_task:
                await asyncio.gather(self.cleanup_task, return_exceptions=True)
            await self.clear_previews()
