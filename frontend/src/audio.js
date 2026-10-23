export class MicrophoneCapture {
  async start(onPacket, onEnded) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Micro cần kết nối HTTPS trên điện thoại, hoặc localhost trên máy tính.');
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !window.AudioWorkletNode) throw new Error('Trình duyệt chưa hỗ trợ thu âm. Hãy cập nhật Chrome hoặc Safari.');
    try {
      this.context = new AudioContext();
      await this.context.resume();
      if (this.stopped) throw new DOMException('Capture cancelled', 'AbortError');
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (this.stopped) { media.getTracks().forEach(track => track.stop()); throw new DOMException('Capture cancelled', 'AbortError'); }
      this.media = media;
      await this.context.audioWorklet.addModule('/audio-worklet.js');
      if (this.stopped) throw new DOMException('Capture cancelled', 'AbortError');
      this.node = new AudioWorkletNode(this.context, 'pcm-processor');
      this.node.port.onmessage = event => {
        if (event.data instanceof ArrayBuffer) onPacket(event.data);
        else if (event.data?.type === 'flushed') this.onFlushed?.();
      };
      this.source = this.context.createMediaStreamSource(this.media);
      this.source.connect(this.node);
      this.node.connect(this.context.destination);
      this.media.getAudioTracks().forEach(track => { track.onended = onEnded; });
    } catch (error) {
      await this.stop();
      if (error.name === 'NotAllowedError') throw new Error('Bạn chưa cho phép dùng micro. Hãy cấp quyền trong trình duyệt hoặc nhập chữ.');
      if (error.name === 'NotFoundError') throw new Error('Không tìm thấy micro. Bạn có thể nhập chữ để trò chuyện.');
      throw error;
    }
  }

  async stop({ flush = false } = {}) {
    this.stopped = true;
    if (flush && this.node) {
      await Promise.race([
        new Promise(resolve => { this.onFlushed = resolve; this.node.port.postMessage('flush'); }),
        new Promise(resolve => setTimeout(resolve, 80)),
      ]);
      this.onFlushed = null;
    }
    this.media?.getAudioTracks().forEach(track => { track.onended = null; track.stop(); });
    this.source?.disconnect();
    this.node?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    if (this.context && this.context.state !== 'closed') await this.context.close().catch(() => {});
    this.media = this.source = this.node = this.context = null;
  }
}
