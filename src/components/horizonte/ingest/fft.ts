const TAU = Math.PI * 2;

function bitReverse(n: number): Uint32Array {
  let bits = 0;
  while (1 << bits < n) bits++;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  return rev;
}

export class RealFFT {
  readonly size: number;
  readonly bins: number;
  readonly mag: Float64Array;

  private half: number;
  private re: Float64Array;
  private im: Float64Array;
  private cos: Float64Array;
  private sin: Float64Array;
  private rev: Uint32Array;
  private uCos: Float64Array;
  private uSin: Float64Array;

  constructor(size: number) {
    if (size < 4 || (size & (size - 1)) !== 0) {
      throw new Error(`RealFFT: size must be a power of two >= 4, got ${size}`);
    }
    this.size = size;
    this.half = size >> 1;
    this.bins = this.half + 1;
    this.mag = new Float64Array(this.bins);
    this.re = new Float64Array(this.half);
    this.im = new Float64Array(this.half);
    this.rev = bitReverse(this.half);

    this.cos = new Float64Array(this.half);
    this.sin = new Float64Array(this.half);
    for (let t = 0; t < this.half; t++) {
      this.cos[t] = Math.cos((TAU * t) / this.half);
      this.sin[t] = Math.sin((TAU * t) / this.half);
    }

    this.uCos = new Float64Array(this.bins);
    this.uSin = new Float64Array(this.bins);
    for (let k = 0; k < this.bins; k++) {
      this.uCos[k] = Math.cos((TAU * k) / size);
      this.uSin[k] = Math.sin((TAU * k) / size);
    }
  }

  private complexFFT() {
    const { re, im, rev, cos, sin, half } = this;
    for (let i = 0; i < half; i++) {
      const j = rev[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (let len = 2; len <= half; len <<= 1) {
      const stride = half / len;
      const mid = len >> 1;
      for (let i = 0; i < half; i += len) {
        for (let k = 0; k < mid; k++) {
          const t = k * stride;
          const wr = cos[t];
          const wi = -sin[t];
          const a = i + k;
          const b = a + mid;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }

  magnitudes(frame: Float64Array): Float64Array {
    const { re, im, half, mag, uCos, uSin } = this;
    for (let k = 0; k < half; k++) {
      re[k] = frame[2 * k];
      im[k] = frame[2 * k + 1];
    }
    this.complexFFT();

    for (let k = 0; k <= half; k++) {
      const a = k === half ? 0 : k;
      const b = (half - k) % half;
      const zar = re[a];
      const zai = im[a];
      const zbr = re[b];
      const zbi = -im[b];

      const er = (zar + zbr) * 0.5;
      const ei = (zai + zbi) * 0.5;
      const dr = (zar - zbr) * 0.5;
      const di = (zai - zbi) * 0.5;
      const or_ = di;
      const oi = -dr;

      const wr = uCos[k];
      const wi = -uSin[k];
      const xr = er + (or_ * wr - oi * wi);
      const xi = ei + (or_ * wi + oi * wr);
      mag[k] = Math.hypot(xr, xi);
    }
    return mag;
  }
}
