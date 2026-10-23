import asyncio

from app.speech import Transcript
from app.translation import TranslationError


class FakeTranslator:
    configured = True

    def __init__(self):
        self.calls = []
        self.fail = False
        self.delay = 0.01

    def configured_for(self, owner_id):
        return True

    async def translate(self, text, source, target, *, owner_id=None):
        self.calls.append((text, source, target))
        await asyncio.sleep(self.delay)
        if self.fail:
            raise TranslationError("timeout")
        return {
            ("Xin chào", "en"): "Hello",
            ("Hello", "vi"): "Xin chào",
            ("How are you?", "vi"): "Bạn khỏe không?",
        }.get((text, target), f"[{target}] {text}")

    async def close(self):
        pass


class FakeRecognizer:
    state = "ready"

    def __init__(self):
        self.result = Transcript("Xin chào", "vi", 0.99)
        self.calls = []

    async def start(self):
        pass

    async def transcribe(self, pcm, language):
        self.calls.append((len(pcm), language))
        await asyncio.sleep(0)
        return self.result

    async def transcribe_preview(self, pcm, language):
        return await self.transcribe(pcm, language)

    async def close(self):
        pass
