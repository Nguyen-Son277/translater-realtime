"""Offline checks for the pinned local runtime installer (no network/model required)."""
import hashlib
import importlib.util
import io
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts" / "local_translation.py"
spec = importlib.util.spec_from_file_location("local_translation_runtime", MODULE_PATH)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class DownloadResponse(io.BytesIO):
    def __init__(self, data, status=200, headers=None):
        super().__init__(data)
        self.status = status
        self.headers = headers or {}


@pytest.mark.parametrize("resume", [False, True])
def test_download_verifies_before_promoting(tmp_path, monkeypatch, resume):
    monkeypatch.setattr(runtime, "MODEL_DIR", tmp_path)
    target = tmp_path / "model.gguf"
    content = b"verified-model-content"
    checksum = hashlib.sha256(content).hexdigest()
    if resume:
        target.with_suffix(".gguf.part").write_bytes(content[:5])

    def fetch(request, **kwargs):
        if resume:
            assert request.get_header("Range") == "bytes=5-"
            return DownloadResponse(content[5:], 206, {"Content-Range": "bytes 5-21/22"})
        return DownloadResponse(content)

    monkeypatch.setattr(runtime.urllib.request, "urlopen", fetch)
    runtime.download("https://example.com/model", target, checksum)
    assert target.read_bytes() == content
    assert not target.with_suffix(".gguf.part").exists()


def test_download_restarts_when_range_ignored(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "MODEL_DIR", tmp_path)
    target = tmp_path / "model.gguf"
    target.with_suffix(".gguf.part").write_bytes(b"partial")
    content = b"complete-model"
    monkeypatch.setattr(runtime.urllib.request, "urlopen", lambda *a, **kw: DownloadResponse(content))
    runtime.download("https://example.com/model", target, hashlib.sha256(content).hexdigest())
    assert target.read_bytes() == content


def test_corrupt_download_is_never_promoted(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "MODEL_DIR", tmp_path)
    target = tmp_path / "model.gguf"
    monkeypatch.setattr(runtime.urllib.request, "urlopen", lambda *a, **kw: DownloadResponse(b"bad"))
    with pytest.raises(RuntimeError, match="Checksum mismatch"):
        runtime.download("https://example.com/model", target, "0" * 64)
    assert not target.exists()


def test_verified_download_is_not_requested_again(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "MODEL_DIR", tmp_path)
    target = tmp_path / "model.gguf"
    target.write_bytes(b"model")
    monkeypatch.setattr(runtime.urllib.request, "urlopen", lambda *a, **kw: pytest.fail("network request"))
    runtime.download("https://example.com/model", target, hashlib.sha256(b"model").hexdigest())


def test_download_rejects_target_outside_model_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "MODEL_DIR", tmp_path / "models")
    with pytest.raises(RuntimeError, match="inside models/translation"):
        runtime.download("https://example.com/model", tmp_path / "outside.gguf", "0" * 64)


def test_wrong_resume_range_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "MODEL_DIR", tmp_path)
    target = tmp_path / "model.gguf"
    partial = target.with_suffix(".gguf.part")
    partial.write_bytes(b"partial")
    monkeypatch.setattr(runtime.urllib.request, "urlopen", lambda *a, **kw: DownloadResponse(
        b"bad", 206, {"Content-Range": "bytes 0-2/3"},
    ))
    with pytest.raises(RuntimeError, match="incorrect download range"):
        runtime.download("https://example.com/model", target, "0" * 64)
    assert partial.read_bytes() == b"partial"
