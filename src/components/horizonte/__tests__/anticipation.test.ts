import { describe, expect, it } from "vitest";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import { LOOKAHEAD_S, leadOf } from "../audio/anticipation";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import { encodeEnvelope, signature } from "./fixtures";

const subida = Array.from({ length: 512 }, (_, i) => Math.round((i / 511) * 255));
const rampa = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope(subida));

describe("leadOf — o campo lê à frente", () => {
  it("num trecho que cresce, o sinal é positivo", () => {
    expect(leadOf(rampa, 0.1, 100, 20)).toBeGreaterThan(0);
  });

  it("num trecho que cai, o sinal é negativo", () => {
    const queda = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([...subida].reverse()));
    expect(leadOf(queda, 0.1, 100, 20)).toBeLessThan(0);
  });

  it("sem envelope medido, não antecipa nada", () => {
    expect(leadOf(NEUTRAL_SIGNATURE, 0.3, 2400)).toBe(0);
  });

  it("sem duração conhecida, não antecipa nada", () => {
    expect(leadOf(rampa, 0.3, 0)).toBe(0);
    expect(leadOf(rampa, 0.3, NaN)).toBe(0);
  });

  it("no fim do disco não há o que antecipar", () => {
    expect(leadOf(rampa, 1, 100, 20)).toBe(0);
  });

  it("horizonte maior enxerga mais longe", () => {
    expect(Math.abs(leadOf(rampa, 0.1, 100, 40))).toBeGreaterThan(
      Math.abs(leadOf(rampa, 0.1, 100, 10)),
    );
  });

  it("fica sempre dentro de [-1, 1] em todo o acervo", () => {
    for (const album of CURATION) {
      const sig = SIGNATURES[album.id];
      for (let i = 0; i <= 200; i++) {
        const v = leadOf(sig, i / 200, sig.measured.durationS, LOOKAHEAD_S);
        expect(Math.abs(v), album.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("todo disco do acervo tem estrutura suficiente para o sinal existir", () => {
    for (const album of CURATION) {
      const sig = SIGNATURES[album.id];
      let maior = 0;
      for (let i = 0; i <= 500; i++) {
        maior = Math.max(maior, Math.abs(leadOf(sig, i / 500, sig.measured.durationS)));
      }
      expect(maior, album.id).toBeGreaterThan(0.1);
    }
  });
});
