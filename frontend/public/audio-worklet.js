import { PCM16Resampler } from './audio-resampler.js';

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new PCM16Resampler(sampleRate);
    this.pending = [];
    this.port.onmessage = event => {
      if (event.data === 'flush') {
        if (this.pending.length) this.send();
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }

  send() {
    const buffer = new ArrayBuffer(this.pending.length * 2);
    const view = new DataView(buffer);
    this.pending.forEach((sample, index) => view.setInt16(index * 2, sample, true));
    this.pending = [];
    this.port.postMessage(buffer, [buffer]);
  }

  process(inputs, outputs) {
    const samples = inputs[0]?.[0];
    if (samples) {
      this.pending.push(...this.resampler.push(samples));
      if (this.pending.length >= 1600) this.send();
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
