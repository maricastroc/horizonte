import { describe, expect, it } from "vitest";
import { CROWN_BANDS, CROWN_CEILING, CROWN_NODES, Crown, type CrownDrive } from "../world/crown";

const N = CROWN_NODES;
const FRAME = 1 / 60;

const drive = (over: Partial<CrownDrive> = {}): CrownDrive => ({
  head: 0,
  push: [0.05, 0.035, 0.02],
  speed: 0.4,
  carry: 0.45,
  hold: 1,
  ...over,
});

const run = (crown: Crown, seconds: number, d: CrownDrive, dt = FRAME) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) crown.step(dt, d);
};

const energy = (crown: Crown) => {
  let sum = 0;
  for (let i = 0; i < crown.lift.length; i++) sum += crown.lift[i] ** 2 + (crown.pace[i] / 10) ** 2;
  return sum;
};

const reach = (crown: Crown, band: number, from: number, to: number) => {
  let top = 0;
  for (let i = from; i <= to; i++) top = Math.max(top, Math.abs(crown.heightAt(band, i)));
  return top;
};

describe("crown", () => {
  it("stays at rest when nothing drives it", () => {
    const crown = new Crown();
    run(crown, 2, drive({ push: [0, 0, 0] }));
    expect(energy(crown)).toBe(0);
  });

  it("moves where the music enters before it moves anywhere else", () => {
    const crown = new Crown();
    run(crown, 0.25, drive());
    expect(reach(crown, 0, -4, 4)).toBeGreaterThan(0.02);
    expect(reach(crown, 0, N / 2 - 8, N / 2 + 8)).toBeLessThan(0.001);
  });

  it("carries an attack around the ring after the music lets go", () => {
    const crown = new Crown();
    run(crown, 0.2, drive());
    const quarter = Math.round(N / 4);
    const before = reach(crown, 0, quarter - 4, quarter + 4);
    run(crown, 0.55, drive({ hold: 0 }));
    expect(reach(crown, 0, quarter - 4, quarter + 4)).toBeGreaterThan(before + 0.002);
  });

  it("dies away instead of ringing forever", () => {
    const crown = new Crown();
    run(crown, 0.3, drive());
    const struck = energy(crown);
    run(crown, 6, drive({ hold: 0 }));
    expect(energy(crown)).toBeLessThan(struck * 0.01);
  });

  it("keeps a sustained track moving longer than a dry one", () => {
    const dry = new Crown();
    const held = new Crown();
    run(dry, 0.3, drive({ carry: 0.16 }));
    run(held, 0.3, drive({ carry: 0.55 }));
    run(dry, 1.5, drive({ carry: 0.16, hold: 0 }));
    run(held, 1.5, drive({ carry: 0.55, hold: 0 }));
    expect(energy(held)).toBeGreaterThan(energy(dry) * 3);
  });

  it("sends the high band ahead of the low band", () => {
    const crown = new Crown();
    run(crown, 0.15, drive());
    run(crown, 0.2, drive({ hold: 0 }));
    const at = Math.round(N * 0.3);
    const low = reach(crown, 0, at - 3, at + 3) / CROWN_CEILING[0];
    const high = reach(crown, 2, at - 3, at + 3) / CROWN_CEILING[2];
    expect(high).toBeGreaterThan(0.05);
    expect(low).toBeLessThan(high * 0.3);
  });

  it("never leaves the room the distance field reserves for it", () => {
    const crown = new Crown();
    const out = new Float32Array(N * 8);
    let over = 0;
    let unbounded = 0;
    let glow = 0;
    for (let k = 0; k < 600; k++) {
      const wild = k % 7 < 3 ? 1 : -1;
      crown.step(k % 5 === 0 ? 0.05 : FRAME, drive({ head: k * 0.013, push: [wild, -wild, wild], speed: 0.8, carry: 1.5 }));
      crown.write(out);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        let steep = 0;
        for (let b = 0; b < CROWN_BANDS; b++) {
          over = Math.max(over, Math.abs(out[i * 4 + b]) - CROWN_CEILING[b]);
          steep = Math.max(steep, Math.abs(out[j * 4 + b] - out[i * 4 + b]) * N);
          const lit = out[(N + i) * 4 + b];
          if (lit < 0 || lit > 1) glow++;
        }
        unbounded = Math.max(unbounded, steep - out[i * 4 + 3], steep - out[j * 4 + 3]);
      }
    }
    expect(over).toBeLessThanOrEqual(0);
    expect(unbounded).toBeLessThan(1e-4);
    expect(glow).toBe(0);
  });

  it("does about the same thing at thirty frames a second as at sixty", () => {
    const fine = new Crown();
    const coarse = new Crown();
    run(fine, 1, drive());
    run(coarse, 1, drive(), 1 / 30);
    let gap = 0;
    let size = 0;
    for (let i = 0; i < N; i++) {
      gap = Math.max(gap, Math.abs(fine.heightAt(0, i) - coarse.heightAt(0, i)));
      size = Math.max(size, Math.abs(fine.heightAt(0, i)));
    }
    expect(gap).toBeLessThan(size * 0.12);
  });

  it("forgets everything when asked to settle", () => {
    const crown = new Crown();
    run(crown, 0.5, drive());
    crown.settle();
    expect(energy(crown)).toBe(0);
  });
});
