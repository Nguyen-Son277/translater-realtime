"""Selective cleanup must preserve all retained references and unrelated files."""
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "cleanup", Path(__file__).resolve().parents[2] / "scripts" / "clean_legacy_models.py",
)
cleanup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleanup)


def test_cleanup_retains_shared_and_nemotron_blobs(tmp_path):
    root = tmp_path / "models"
    blobs = root / "blobs"
    blobs.mkdir(parents=True)
    old, shared, kept = (blobs / name for name in ("old", "shared", "kept"))
    for path in (old, shared, kept):
        path.write_bytes(b"weights")
    old_repo = root / "models--Systran--faster-whisper-base"
    old_repo.mkdir()
    (old_repo / "old").symlink_to(old)
    (old_repo / "shared").symlink_to(shared)
    retained = root / "models--nvidia--nemotron-3.5-asr-streaming-0.6b"
    retained.mkdir()
    (retained / "weights").symlink_to(kept)
    (retained / "shared").symlink_to(shared)
    local = root / "translation"
    local.mkdir()
    (local / "model.gguf").write_bytes(b"obsolete")
    unrelated = root / "unrelated"
    unrelated.write_bytes(b"preserve")
    cleanup.clean(root)
    assert not old_repo.exists() and not old.exists() and not local.exists()
    assert shared.exists() and kept.exists() and unrelated.read_bytes() == b"preserve"
    assert (retained / "weights").read_bytes() == b"weights"
    cleanup.clean(root)  # Repeated cleanup is safe.


def test_cleanup_refuses_symlink_target_before_deleting(tmp_path):
    root = tmp_path / "models"
    root.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (root / "translation").symlink_to(outside, target_is_directory=True)
    with pytest.raises(AssertionError, match="Refusing symlink"):
        cleanup.clean(root)
    assert outside.exists()
