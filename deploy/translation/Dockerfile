FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libgomp1 libvulkan1 mesa-vulkan-drivers
ADD --checksum=sha256:37ad54a1b6df89c65d8683bd301d9295061b8d2e52dc44f1344df01c566dd7d2 \
    https://github.com/ggml-org/llama.cpp/releases/download/b12018/llama-b12018-bin-ubuntu-vulkan-x64.tar.gz /opt/llama.tar.gz
RUN mkdir /opt/llama && tar -xzf /opt/llama.tar.gz -C /opt/llama
ENV LD_LIBRARY_PATH=/opt/llama/llama-b12018
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["sh", "/entrypoint.sh"]
