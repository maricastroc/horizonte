float mapBody(vec3 pl){
  vec4 a;
  vec4 b;
  float r;
  float turn;
  profAt(pl, a, b, r, turn);
  float lo = a.x;
  float hi = max(a.y, max(a.w, b.y));
  if (hi - lo < 1e-4) return 9.0;
  vec4 wv = texture(uWarp, vec2(turn, 0.5));
  float hw = (hi - lo) * 0.5;
  float x = r - (lo + hi) * 0.5;
  float e = clamp(x / hw, -1.0, 1.0);
  float gap = min(min(bandD(r, a.x, a.y), bandD(r, a.z, a.w)), bandD(r, b.x, b.y));
  float thick = uBand.z * mix(0.22, 1.0, sqrt(1.0 - e * e)) * (1.0 - 0.4 * smoothstep(0.0, 0.012, gap));
  vec2 q = vec2(x, pl.y - wv.x * uGlass.x - x * wv.w * uGlass.y);
  float rr = min(hw, thick) * 0.9;
  vec2 w = abs(q) - vec2(hw, thick) + rr;
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - rr;
  return smax(d, -b.z * TAU * r - 0.006, 0.02);
}

vec3 film(float c){
  return 0.5 + 0.5 * cos(TAU * (c * 1.4 + vec3(0.0, 0.33, 0.67)));
}

vec3 bodyOf(float ndv, float r){
  return uInkA * (0.5 + 1.0 * film(ndv * 0.7 + r * 0.4)) + uInkB * 0.12;
}

vec3 sigmaOf(vec3 body){
  return (vec3(1.0) - clamp(body * 1.3 + 0.12, 0.0, 1.0)) * 5.0;
}

vec3 innerLight(float r, float turn){
  float dturn = abs(fract(turn - uPlay.x + 0.5) - 0.5);
  float line = exp(-pow(dturn * TAU * r / 0.05, 2.0));
  vec3 c = mix(uInkA, vec3(1.0), 0.6) * line * (0.9 + 4.0 * uAccent.w) * uPlay.w;
  float act = step(uPlay.y, turn) * step(turn, uPlay.z) * uPlay.w;
  float hov = step(uHover.x, turn) * step(turn, uHover.y) * uHover.z;
  c += uInkA * (0.16 * act + 0.2 * hov);
  return c;
}

vec3 shadeBody(Hit h, vec3 dl, vec3 rd){
  if (h.kind > 1.5) return shadeOrb(toWorldDir(h.n), rd, h.kind > 2.5 ? 1.0 : 1.5);
  vec3 pl = h.p;
  vec3 nl = normalAt(pl);
  float r = length(pl.xz);
  float turn = fract(atan(pl.z, pl.x) / TAU - uSpin);
  vec3 radial = normalize(vec3(pl.x, 0.0, pl.z));
  nl = normalize(nl + radial * sin(r * 190.0) * 0.045 / (1.0 + h.t * h.t * 0.04));
  float ndv = max(dot(nl, -dl), 0.0);
  float ior = uGlass.z;
  float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float f = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
  vec3 body = bodyOf(ndv, r);
  vec3 sigma = sigmaOf(body);
  vec3 tint = mix(vec3(1.0), film(ndv + r * 0.6) * 1.7, uGlass.w);
  vec3 refl = envAt(toWorldDir(reflect(dl, nl))) * f * tint;

  vec3 di = refract(dl, nl, 1.0 / ior);
  vec3 pin = pl - nl * 0.006;
  float ti = 0.0;
  for (int i = 0; i < 20; i++){
    float d = -mapBody(pin + di * ti);
    if (d < 0.002 || ti > 1.2) break;
    ti += max(d, 0.006);
  }
  vec3 pe = pin + di * ti;
  vec3 ne = -normalAt(pe);
  vec3 tr = exp(-sigma * ti);
  vec3 dg = refract(di, ne, ior);
  if (dot(dg, dg) < 1e-4) dg = reflect(di, ne);
  vec3 po = pe - ne * 0.02;
  vec3 wo = toWorld(po);

  Hit h2 = traceLocal(po, dg, uSteps * 0.6, 1.0);
  vec3 back;
  if (h2.kind > 1.5){
    back = shadeOrb(toWorldDir(h2.n), toWorldDir(dg), 1.2);
  } else if (h2.kind > 0.5){
    vec3 n2 = normalAt(h2.p);
    float nv2 = max(dot(n2, -dg), 0.0);
    float f2 = f0 + (1.0 - f0) * pow(1.0 - nv2, 5.0);
    vec3 thru = normalize(mix(dg, refract(dg, n2, 1.0 / ior), 0.6));
    float t2 = 2.0 * uBand.z / max(nv2, 0.35);
    vec3 body2 = bodyOf(nv2, length(h2.p.xz));
    back = farField(toWorld(h2.p), toWorldDir(thru)) * exp(-sigmaOf(body2) * t2) * (1.0 - f2)
         + envAt(toWorldDir(reflect(dg, n2))) * f2
         + body2 * (1.0 - exp(-t2 * 8.0)) * 0.22 * uGlow;
  } else if (uDetail > 0.75){
    float sp = 0.014 + 0.02 * uAudio.z;
    vec3 dr = refract(di, ne, ior * (1.0 - sp));
    vec3 db = refract(di, ne, ior * (1.0 + sp));
    if (dot(dr, dr) < 1e-4) dr = dg;
    if (dot(db, db) < 1e-4) db = dg;
    back = vec3(
      farField(wo, toWorldDir(dr)).r,
      farField(wo, toWorldDir(dg)).g,
      farField(wo, toWorldDir(db)).b);
  } else {
    back = farField(wo, toWorldDir(dg));
  }

  float mu = max(dot(rd, uLight), 0.0);
  vec3 glow = body * (1.0 - exp(-ti * 8.0)) * (0.12 + 0.5 * mu * mu) * uGlow;
  vec3 col = back * tr * (1.0 - f) + refl + glow;
  col += innerLight(r, turn) * (0.4 + 0.6 * tr);
  return col;
}

vec3 shadeBodyLite(Hit h, vec3 dl, vec3 rd){
  if (h.kind > 1.5) return shadeOrb(toWorldDir(h.n), rd, 1.0);
  vec3 nl = normalAt(h.p);
  float ndv = max(dot(nl, -dl), 0.0);
  float f = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  float r = length(h.p.xz);
  vec3 body = bodyOf(ndv, r);
  vec3 through = normalize(rd - toWorldDir(nl) * 0.18);
  through.y = abs(through.y);
  vec3 col = envAt(toWorldDir(reflect(dl, nl))) * f;
  col += skyBase(through) * exp(-sigmaOf(body) * 0.1) * (1.0 - f);
  col += body * 0.3 * uGlow;
  float turn = fract(atan(h.p.z, h.p.x) / TAU - uSpin);
  col += innerLight(r, turn) * 0.6;
  return col;
}
