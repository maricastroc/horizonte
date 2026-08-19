export type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

export const ls = (x: Ctx, v: string) => {
  if (x.letterSpacing !== undefined) x.letterSpacing = v;
};
