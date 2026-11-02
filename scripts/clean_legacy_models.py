"""Remove only legacy model caches; validate shared references before deleting.

Run from the repository: python scripts/clean_legacy_models.py models
For a stopped Docker speech volume, mount it at /models and pass /models.
"""
import shutil
import sys
from pathlib import Path


def clean(root: Path) -> None:
    root = root.resolve(strict=True)
    assert root.name in {"models", "speech_models", "_data"}, f"Unexpected cache root: {root}"
    names = [f"models--Systran--faster-whisper-{size}" for size in ("base", "small", "tiny")]
    targets = [root / name for name in names] + [root / ".locks" / name for name in names]
    targets.append(root / "translation")
    for target in targets:
        assert target.resolve() == target, f"Refusing symlink deletion target: {target}"
        assert target.is_relative_to(root), f"Outside cache: {target}"
    repositories = targets[:3]
    legacy_blobs = set()
    retained_blobs = set()
    for path in root.rglob("*"):
        if not path.is_symlink():
            continue
        resolved = path.resolve()
        if not resolved.is_relative_to(root):
            raise RuntimeError(f"Reference outside cache: {path}")
        if any(path.is_relative_to(repo) for repo in repositories):
            legacy_blobs.add(resolved)
        else:
            retained_blobs.add(resolved)
    shared_blobs = sorted(blob for blob in legacy_blobs - retained_blobs
                          if blob.is_relative_to(root / "blobs"))
    freed = 0
    for target in targets:
        if target.exists():
            print(f"Remove verified legacy cache: {target}")
            freed += sum(p.stat().st_size for p in target.rglob("*")
                         if p.is_file() and not p.is_symlink())
            shutil.rmtree(target)
    for blob in shared_blobs:
        assert blob.resolve() == blob and blob.is_file(), f"Invalid blob: {blob}"
        print(f"Remove exclusively legacy shared blob: {blob}")
        freed += blob.stat().st_size
        blob.unlink()
    preserved = root / "models--nvidia--nemotron-3.5-asr-streaming-0.6b"
    broken = [p for p in preserved.rglob("*") if p.is_symlink() and not p.exists()]
    assert not broken, f"Broken Nemotron references: {broken}"
    print(f"Freed {freed / 1024**3:.3f} GiB; Nemotron broken references: {len(broken)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: clean_legacy_models.py <verified-model-cache-root>")
    clean(Path(sys.argv[1]))
