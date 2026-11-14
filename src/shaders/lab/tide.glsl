float mapBody(vec3 pl){
  float r;
  float turn;
  float gap;
  float d2 = planD(pl, r, turn, gap);
  float thick = uBand.z * (1.0 - 0.42 * exp(min(d2, 0.0) * 13.0)) * (1.0 - 0.5 * smoothstep(0.0, 0.012, gap));
  float bev = uBand.w;
  vec2 w = vec2(d2, abs(pl.y) - thick) + bev;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bev;
}

vec3 plateBase(vec3 pl, vec3 nl, out float top){
  top = smoothstep(0.35, 0.9, abs(nl.y));
  vec2 cuv = pl.xz * vec2(0.5, -0.5) / uBound.x + 0.5;
  vec3 art = pow(texture(uCover, cuv).rgb, vec3(2.2));
  float lum = dot(art, vec3(0.3, 0.6, 0.1));
  vec3 pigment = mix(uInkA * (0.2 + lum * 2.6), art * 1.3, 0.35);
  return pigment * 0.11 * top + uInkA * 0.006;
}

vec3 marks(vec3 base, float r, float turn, float top){
  float dturn = abs(fract(turn - uPlay.x + 0.5) - 0.5);
  float line = exp(-pow(dturn * TAU * r / 0.014, 2.0));
  vec3 c = mix(uInkA, vec3(1.0), 0.75) * line * (1.6 + 5.0 * uAccent.w) * uPlay.w;
  float act = step(uPlay.y, turn) * step(turn, uPlay.z) * uPlay.w;
  float hov = step(uHover.x, turn) * step(turn, uHover.y) * uHover.z;
  c += (base * 2.4 + uInkA * 0.06 * top) * act;
  c += (base * 1.8 + uInkA * 0.09 * top) * hov;
  return c;
}

vec3 shadeBody(Hit h, vec3 dl, vec3 rd){
  if (h.kind > 2.5) return shadeOrb(toWorldDir(h.n), rd, 1.0);
  if (h.kind > 1.5) return vec3(0.0);
  vec3 pl = h.p;
  vec3 nl = normalAt(pl);
  vec3 n = toWorldDir(nl);
  float r;
  float turn;
  float gap;
  float edge = planD(pl, r, turn, gap);
  float top;
  vec3 base = plateBase(pl, nl, top);
  float ndv = max(dot(n, -rd), 0.0);
  vec3 keyC = vec3(1.0, 0.8, 0.58);
  float kd = max(dot(n, uKey), 0.0);
  vec3 col = base * (kd * keyC * 1.5 + vec3(0.05, 0.07, 0.12) + uInkA * 0.25 * (n.y * 0.5 + 0.5));
  float f = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  col += envAt(reflect(rd, n)) * f;
  vec3 H = normalize(uKey - rd);
  col += mix(keyC, uInkA * 2.0 + 0.1, 0.4) * pow(max(dot(n, H), 0.0), 60.0) * 0.3;
  vec3 T = toWorldDir(normalize(vec3(pl.z, 0.0, -pl.x)));
  float th = dot(T, H);
  float groove = 0.55 + 0.45 * sin(r * 240.0) / (1.0 + h.t * h.t * 0.05);
  col += mix(keyC, uInkA * 2.6 + 0.12, 0.6) * pow(max(1.0 - th * th, 0.0), 80.0) * kd * 0.5 * top * groove;
  float thin = exp(min(edge, 0.0) * 46.0) * (0.3 + 0.7 * (1.0 - top));
  float ph = pow(max(dot(rd, uLight), 0.0), 6.0);
  col += mix(uInkA * 1.4, vec3(1.0, 0.9, 0.8), 0.08) * thin * ph * 0.5 * uGlow;
  col += marks(base, r, turn, top);
  return col;
}

vec3 shadeBodyLite(Hit h, vec3 dl, vec3 rd){
  if (h.kind > 2.5) return shadeOrb(toWorldDir(h.n), rd, 1.0);
  if (h.kind > 1.5) return vec3(0.0);
  vec3 pl = h.p;
  vec3 nl = normalAt(pl);
  vec3 n = toWorldDir(nl);
  float r = length(pl.xz);
  float turn = fract(atan(pl.z, pl.x) / TAU - uSpin);
  float top;
  vec3 base = plateBase(pl, nl, top);
  float ndv = max(dot(n, -rd), 0.0);
  vec3 col = base * (max(dot(n, uKey), 0.0) * vec3(1.5, 1.2, 0.87) + vec3(0.05, 0.07, 0.12));
  col += envAt(reflect(rd, n)) * (0.05 + 0.95 * pow(1.0 - ndv, 5.0));
  col += uInkA * 1.3 * pow(max(dot(rd, uLight), 0.0), 6.0) * (1.0 - top) * 0.35 * uGlow;
  col += marks(base, r, turn, top);
  return col;
}
