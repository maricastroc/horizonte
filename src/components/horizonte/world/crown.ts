import { clamp } from "../math";

export const CROWN_NODES = 128;
export const CROWN_BANDS = 3;
export const CROWN_CEILING = [0.07, 0.05, 0.03] as const;

const WIDTH = [0.05, 0.032, 0.02];
const GRIP = [19, 31, 50];
const SPEED = [1, 1.6, 2.6];
const CARRY = [1, 0.8, 0.6];
const REACH = 0.12;
const VISCOSITY = 0.03;
const COURANT = 0.7;

export interface CrownDrive {
  head: number;
  push: readonly [number, number, number];
  speed: number;
  carry: number;
  hold: number;
}

export class Crown {
  readonly lift = new Float32Array(CROWN_NODES * CROWN_BANDS);
  readonly pace = new Float32Array(CROWN_NODES * CROWN_BANDS);
  private grip = new Float32Array(CROWN_NODES);
  private next = new Float32Array(CROWN_NODES);

  step(dt: number, drive: CrownDrive) {
    if (dt <= 0) return;
    const n = CROWN_NODES;
    const speed = clamp(drive.speed, 0.05, 0.8);
    const carry = clamp(drive.carry, 0.08, 1.5);
    const hold = clamp(drive.hold, 0, 1);
    const fastest = speed * SPEED[CROWN_BANDS - 1];
    const steps = clamp(Math.max(Math.ceil(dt * 120), Math.ceil((fastest * dt * n) / COURANT)), 2, 48);
    const h = dt / steps;
    const head = (((drive.head % 1) + 1) % 1) * n;

    for (let b = 0; b < CROWN_BANDS; b++) {
      const u = this.lift.subarray(b * n, (b + 1) * n);
      const v = this.pace.subarray(b * n, (b + 1) * n);
      const c = speed * SPEED[b];
      const c2 = c * c * n * n;
      const rest = (c / REACH) ** 2;
      const drag = (2 * c) / (carry * CARRY[b]);
      const stiff = GRIP[b] * GRIP[b];
      const damp = 2 * GRIP[b];
      const aim = clamp(drive.push[b], -CROWN_CEILING[b], CROWN_CEILING[b]);
      for (let i = 0; i < n; i++) {
        let d = Math.abs(i - head);
        if (d > n / 2) d = n - d;
        const x = d / (n * WIDTH[b]);
        this.grip[i] = x > 3 ? 0 : hold * Math.exp(-x * x);
      }
      for (let s = 0; s < steps; s++) {
        for (let i = 0; i < n; i++) {
          const lap = u[(i + n - 1) % n] - 2 * u[i] + u[(i + 1) % n];
          const g = this.grip[i];
          v[i] += (c2 * lap - rest * u[i] - drag * v[i] + g * (stiff * (aim - u[i]) - damp * v[i])) * h;
        }
        for (let i = 0; i < n; i++) {
          this.next[i] = v[i] + VISCOSITY * (v[(i + n - 1) % n] - 2 * v[i] + v[(i + 1) % n]);
        }
        const top = CROWN_CEILING[b] * 2;
        for (let i = 0; i < n; i++) {
          v[i] = this.next[i];
          u[i] = clamp(u[i] + v[i] * h, -top, top);
        }
      }
    }
  }

  settle() {
    this.lift.fill(0);
    this.pace.fill(0);
  }

  heightAt(band: number, node: number): number {
    const top = CROWN_CEILING[band];
    return top * Math.tanh(this.lift[band * CROWN_NODES + (((node % CROWN_NODES) + CROWN_NODES) % CROWN_NODES)] / top);
  }

  write(out: Float32Array) {
    const n = CROWN_NODES;
    for (let i = 0; i < n; i++) {
      let steep = 0;
      for (let b = 0; b < CROWN_BANDS; b++) {
        const here = this.heightAt(b, i);
        const top = CROWN_CEILING[b];
        steep = Math.max(
          steep,
          Math.abs(this.heightAt(b, i + 1) - here) * n,
          Math.abs(here - this.heightAt(b, i - 1)) * n,
        );
        out[i * 4 + b] = here;
        out[(n + i) * 4 + b] = clamp((Math.abs(here) / top) * 0.55 + Math.abs(this.pace[b * n + i]) / (top * 9), 0, 1);
      }
      out[i * 4 + 3] = steep;
      out[(n + i) * 4 + 3] = 0;
    }
  }
}
