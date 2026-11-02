"""Pinned, project-local TranslateGemma installation and foreground server (Python 3.12+)."""
import argparse
import fcntl
import hashlib
import json
import os
import platform
import subprocess
import tarfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models" / "translation"
VERSION = "b12018"
REVISION = "7c938465a870d8624bcfa98a8e4a3510053c19a8"
MODEL_NAME = "translategemma-4b-it-Q4_K_M.gguf"
MODEL_SHA = "7f7357c14abd9da4eb200b38b05da502cd6e10d7e1d403fbc9f78c19f3209b72"
MODEL_URL = f"https://huggingface.co/bullerwins/translategemma-4b-it-GGUF/resolve/{REVISION}/{MODEL_NAME}"
RUNTIMES = {
    "cpu": (f"llama-{VERSION}-bin-ubuntu-x64.tar.gz", "4bafb440d6dd24ae45d496c0f5a25f316b3740ee500074f130eaebceed465a7b"),
    "vulkan": (f"llama-{VERSION}-bin-ubuntu-vulkan-x64.tar.gz", "37ad54a1b6df89c65d8683bd301d9295061b8d2e52dc44f1344df01c566dd7d2"),
}


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def download(url, target, expected):
    """Resume interrupted transfers, never trust a partial or unchecked file."""
    target = target.resolve()
    if not target.is_relative_to(MODEL_DIR.resolve()):
        raise RuntimeError("Download target must be inside models/translation")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if digest(target) != expected:
            raise RuntimeError(f"Checksum mismatch: {target}; inspect/remove the damaged file manually")
        print(f"Verified {target.name}", flush=True)
        return
    partial = target.with_suffix(target.suffix + ".part")
    if partial.exists() and digest(partial) == expected:
        partial.replace(target)
        return
    offset = partial.stat().st_size if partial.exists() else 0
    headers = {"Range": f"bytes={offset}-"} if offset else {}
    request = urllib.request.Request(url, headers=headers)
    print(f"Downloading {target.name} (resume offset {offset})", flush=True)
    with urllib.request.urlopen(request, timeout=120) as response:
        resume = offset and response.status == 206
        if resume and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
            raise RuntimeError("Server returned an incorrect download range")
        with partial.open("ab" if resume else "wb") as stream:
            while block := response.read(4 * 1024 * 1024):
                stream.write(block)
    if digest(partial) != expected:
        raise RuntimeError(f"Checksum mismatch: {partial}; refusing installation")
    # Both resolved paths are checked before the atomic move.
    if not partial.resolve().is_relative_to(MODEL_DIR.resolve()):
        raise RuntimeError("Unexpected partial file path")
    partial.replace(target)
    print(f"Verified {target.name}", flush=True)


def runtime_dir(device):
    return MODEL_DIR / f"llama-{VERSION}-{device}"


def binary(device):
    matches = list(runtime_dir(device).rglob("llama-server"))
    if len(matches) != 1:
        raise RuntimeError(f"Run setup --device {device} first (llama-server not found)")
    return matches[0]


def setup(args):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with (MODEL_DIR / "setup.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if not args.model_only:
            if platform.system() != "Linux" or platform.machine() != "x86_64":
                raise RuntimeError("Bundled runtime supports Linux x86_64 only; use model-only elsewhere")
            name, checksum = RUNTIMES[args.device]
            archive = MODEL_DIR / name
            download(f"https://github.com/ggml-org/llama.cpp/releases/download/{VERSION}/{name}", archive, checksum)
            destination = runtime_dir(args.device)
            destination.mkdir(parents=True, exist_ok=True)
            with tarfile.open(archive) as bundle:
                bundle.extractall(destination, filter="data")
            print(f"Runtime: {binary(args.device)}", flush=True)
        download(MODEL_URL, MODEL_DIR / MODEL_NAME, MODEL_SHA)


def serve(args):
    model = MODEL_DIR / MODEL_NAME
    if not model.is_file() or digest(model) != MODEL_SHA:
        raise RuntimeError("Model missing/corrupt; run setup first")
    exe = binary(args.device)
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(exe.parent) + (":" + env["LD_LIBRARY_PATH"] if env.get("LD_LIBRARY_PATH") else "")
    if args.device == "vulkan":
        probe = subprocess.run([str(exe), "--list-devices"], env=env, capture_output=True, text=True, check=True)
        print(probe.stdout + probe.stderr, flush=True)
        if "Vulkan" not in probe.stdout or "llvmpipe" in probe.stdout.lower():
            raise RuntimeError("No hardware Vulkan GPU detected; explicitly use --device cpu or fix GPU access")
    command = [str(exe), "--model", str(model), "--alias", "translategemma-4b-it",
               "--host", "127.0.0.1", "--port", str(args.port), "--ctx-size", "2048",
               "--parallel", "1", "--threads", "4", "--threads-batch", "4",
               "--n-gpu-layers", "99" if args.device == "vulkan" else "0",
               # /completion receives canonical token IDs; disable incompatible chat auto-probing.
               "--no-jinja", "--chat-template", "chatml", "--cache-ram", "0",
               "--no-context-shift", "--swa-full", "--no-webui"]
    print(f"Serving {args.device} at http://127.0.0.1:{args.port}; stop with Ctrl+C", flush=True)
    os.execve(exe, command, env)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    install = commands.add_parser("setup", help="Download and verify runtime/model once")
    install.add_argument("--device", choices=RUNTIMES, default="cpu")
    install.add_argument("--model-only", action="store_true")
    run = commands.add_parser("serve", help="Run foreground; stop with Ctrl+C")
    run.add_argument("--device", choices=RUNTIMES, default="cpu")
    run.add_argument("--port", type=int, default=8081)
    health = commands.add_parser("health", help="Check readiness, not just configuration")
    health.add_argument("--url", default="http://127.0.0.1:8081")
    args = parser.parse_args()
    try:
        if args.command == "setup":
            setup(args)
        elif args.command == "serve":
            serve(args)
        else:
            with urllib.request.urlopen(args.url.rstrip("/") + "/health", timeout=5) as response:
                status = json.load(response)
            print(json.dumps(status))
            if status.get("status") != "ok":
                raise RuntimeError("Model is not ready")
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Translation runtime error: {exc}\n")


if __name__ == "__main__":
    main()
