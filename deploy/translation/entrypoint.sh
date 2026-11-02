#!/bin/sh
set -eu
model=/models/translategemma-4b-it-Q4_K_M.gguf
printf '%s  %s\n' '7f7357c14abd9da4eb200b38b05da502cd6e10d7e1d403fbc9f78c19f3209b72' "$model" | sha256sum -c -
if [ "${TRANSLATION_GPU_LAYERS:-0}" != 0 ]; then
    devices=$(/opt/llama/llama-b12018/llama-server --list-devices)
    printf '%s\n' "$devices"
    case "$devices" in
        *llvmpipe*) echo 'Software Vulkan is not a GPU; use CPU configuration explicitly.' >&2; exit 1 ;;
        *Vulkan*) ;;
        *) echo 'No hardware Vulkan device found.' >&2; exit 1 ;;
    esac
fi
exec /opt/llama/llama-b12018/llama-server \
    --model "$model" --alias translategemma-4b-it \
    --host 0.0.0.0 --port 8081 --ctx-size 2048 --parallel 1 \
    --threads 4 --threads-batch 4 --n-gpu-layers "${TRANSLATION_GPU_LAYERS:-0}" \
    --no-context-shift --no-webui --no-jinja --chat-template chatml --cache-ram 0
