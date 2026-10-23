// Stateful box-filter resampling: packet boundaries never reset the sample clock.
export class PCM16Resampler {
  constructor(inputRate, outputRate = 16000) {
    this.ratio = inputRate / outputRate;
    this.remaining = this.ratio;
    this.sum = 0;
  }

  push(samples) {
    const output = [];
    for (const sample of samples) {
      let available = 1;
      while (available > 1e-9) {
        const weight = Math.min(available, this.remaining);
        this.sum += sample * weight;
        available -= weight;
        this.remaining -= weight;
        if (this.remaining < 1e-9) {
          const value = Math.max(-1, Math.min(1, this.sum / this.ratio));
          output.push(Math.round(value * (value < 0 ? 32768 : 32767)));
          this.sum = 0;
          this.remaining = this.ratio;
        }
      }
    }
    return output;
  }
}
