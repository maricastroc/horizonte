precision highp float;
uniform sampler2D uBack, uFront;
uniform vec2 uRes;
uniform vec4 uM0, uM1;
uniform vec3 uCur;
uniform vec3 uWave;
uniform float uSpin, uBlur, uTime, uFade, uGrain, uDisp, uJet;
uniform float uReach;
uniform float uRim;
uniform vec2 uLight;
uniform vec3 uInk;
uniform vec4 uLobeA;
uniform vec4 uLobeB;
uniform float uFlat;
uniform float uWorld;
uniform vec3 uGuard;
uniform sampler2D uFocus;
uniform vec3 uFocusMix;
uniform float uFocusFront;
uniform sampler2D uShape;
uniform vec4 uRelief;
uniform vec4 uReliefBand;
uniform vec2 uReliefAt;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.71, 289.13))) * 43758.5453); }

vec2 pullOf(vec2 p, vec4 m, float spin){
  vec2 d = (p - m.xy) / uWorld;
  float r = max(length(d), 1e-4);
  float k = min(m.z / (r * r + 0.014), 0.85);
  vec2 dir = d / r;
  vec2 tang = vec2(-dir.y, dir.x);
  return (-dir * k * 0.13 + tang * k * spin * 0.13) * uWorld;
}

float lobeOf(vec2 d){
  if (uLobeB.z <= 0.0001) return 1.0;
  float th = atan(d.y, d.x) - uLobeB.w;
  float v = uLobeA.x * cos(2.0 * th) + uLobeA.y * sin(2.0 * th)
          + uLobeA.z * cos(3.0 * th) + uLobeA.w * sin(3.0 * th)
          + uLobeB.x * cos(4.0 * th) + uLobeB.y * sin(4.0 * th);
  return 1.0 + uLobeB.z * v;
}

vec2 bodySpace(vec2 d, float lobed){
  float f = mix(1.0, uFlat, lobed);
  return vec2(d.x, d.y / max(f, 0.05));
}

float coreOf(vec2 p, vec4 m, float lobed){
  if (m.w <= 0.0) return 0.0;
  vec2 e = bodySpace(p - m.xy, lobed);
  float r = length(e);
  float w = m.w * mix(1.0, lobeOf(e), lobed);
  return smoothstep(w, w * 0.87, r);
}

float rimOf(vec2 p, vec4 m, float lobed){
  if (m.w <= 0.0) return 0.0;
  vec2 e = bodySpace(p - m.xy, lobed);
  float r = length(e);
  float w = m.w * mix(1.0, lobeOf(e), lobed);
  float band = exp(-pow((r - w * 1.01) / (w * 0.028), 2.0));
  float g = max(0.0, dot(normalize(e), normalize(uLight)));
  return band * pow(g, uRim) * 1.25;
}

vec2 plateAt(vec2 q){
  vec2 d = q - uReliefAt;
  vec2 e = vec2(d.x, -d.y / max(uRelief.y, 0.05));
  float R = uRelief.x;
  float r = length(e) / R;
  if (r < uReliefBand.x || r > uReliefBand.y) return vec2(-1.0, 0.0);
  float turn = fract((atan(e.y, e.x) - uRelief.z) / 6.2831853);
  vec4 a = texture2D(uShape, vec2(turn, 0.25));
  vec4 b = texture2D(uShape, vec2(turn, 0.75));
  float ang = b.z * 6.2831853 * r;
  vec3 lo = vec3(a.x, a.z, b.x);
  vec3 hi = vec3(a.y, a.w, b.y);
  vec3 sd = min(min(vec3(r) - lo, hi - vec3(r)), vec3(ang)) * R;
  vec3 bev = min(vec3(0.05 * R), (hi - lo) * R * 0.44);
  vec3 s = clamp(sd / max(bev, vec3(1e-5)), 0.0, 1.0);
  vec3 h = (1.0 - (1.0 - s) * (1.0 - s)) * bev * 0.62;
  float top = max(sd.x, max(sd.y, sd.z));
  float height = max(h.x, max(h.y, h.z));
  return vec2(top, height);
}

vec3 relief(vec3 col, vec2 q, float smear){
  float R = uRelief.x;
  float w = uRelief.w * (1.0 - smoothstep(0.03 * R, 0.16 * R, smear));
  if (w < 0.002) return col;
  float px = 1.0 / uRes.y;
  vec2 c = plateAt(q);
  vec2 ld = normalize(uLight);
  vec3 L = normalize(vec3(uLight, 1.1));
  if (c.x > -0.5 * px) {
    float dl = 1.5 * px;
    float hx = plateAt(q + vec2(dl, 0.0)).y;
    float hy = plateAt(q + vec2(0.0, dl)).y;
    vec2 d = q - uReliefAt;
    vec2 rad = normalize(vec2(d.x, d.y / max(uRelief.y, 0.05)) + 1e-6);
    float rr = clamp(length(vec2(d.x, d.y / max(uRelief.y, 0.05))) / (R * uReliefBand.y), 0.0, 1.0);
    vec2 g = vec2(hx - c.y, hy - c.y) / dl;
    vec3 n = normalize(vec3(-g + rad * 0.5 * rr, 1.0));
    float cov = clamp(c.x * uRes.y + 0.5, 0.0, 1.0);
    float lit = (0.26 + 0.74 * max(dot(n, L), 0.0)) / (0.26 + 0.74 * L.z);
    vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
    float base = pow(hv.z, 22.0);
    float sp = max(0.0, pow(max(dot(n, hv), 0.0), 22.0) - base) / (1.0 - base);
    float body = smoothstep(0.03, 0.16, max(col.r, max(col.g, col.b)));
    vec3 keyed = col * lit + mix(uInk, vec3(1.0), 0.4) * sp * body * 0.5 * (1.0 + uReliefBand.w);
    float slope = length(g);
    vec2 gn = slope > 1e-4 ? -g / slope : vec2(0.0);
    float facing = max(dot(gn, ld), 0.0);
    float side = 0.5 + 0.5 * max(dot(rad, ld), 0.0);
    float edge = smoothstep(0.08, 0.9, slope) * facing * facing * side;
    vec3 lf = normalize(vec3(uLight, 1.6));
    float fill = clamp(0.9 + 1.4 * (dot(n, lf) - lf.z), 0.45, 1.45);
    vec3 backlit = col * fill + mix(uInk, vec3(1.0), 0.4) * edge * 1.1 * (1.0 + uReliefBand.w);
    vec3 shaded = mix(keyed, backlit, uReliefBand.z);
    return mix(col, shaded, w * cov);
  }
  if (c.x < -0.5) return col;
  float occ = smoothstep(0.035 * R, 0.0, -c.x);
  vec2 sh = plateAt(q + ld * 0.03 * R);
  float shade = sh.x < -0.5 ? 0.0 : smoothstep(-0.014 * R, 0.014 * R, sh.x);
  float dark = max(occ * 0.4, shade * 0.62);
  return col * (1.0 - dark * w);
}

vec3 samp(sampler2D t, vec2 uv, vec2 off, float blur){
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; i++){
    float f = float(i) / 3.0;
    vec2 o = off * (1.0 + f * blur * 2.2);
    c.r += texture2D(t, uv + o * (1.0 + uDisp * 1.6)).r;
    c.g += texture2D(t, uv + o).g;
    c.b += texture2D(t, uv + o * (1.0 - uDisp * 1.6)).b;
  }
  return c / 4.0;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  vec2 off = pullOf(p, uM0, uSpin) + pullOf(p, uM1, uSpin);
  off += pullOf(p, vec4(uCur.xy, uCur.z, 0.0), uSpin * 0.4);

  vec2 dw = (p - uM0.xy) / uWorld;
  float rw = length(dw);
  float dr = rw - uWave.x;
  off += normalize(dw + 1e-5) * uWave.y * exp(-dr * dr * 42.0) * uWorld;

  off *= mix(uGuard.z, 1.0, smoothstep(uGuard.x - uGuard.y, uGuard.x + uGuard.y, p.y));

  vec2 offUv = off / vec2(aspect, 1.0);
  vec3 col = samp(uBack, uv, offUv, uBlur);
  if (uRelief.w > 0.001) col = relief(col, p + off, length(off) * (uBlur * 2.2 + uDisp * 1.6));

  float core = max(coreOf(p, uM0, 1.0), coreOf(p, uM1, 0.0));
  col = mix(col, vec3(0.0), core);
  col += uInk * (rimOf(p, uM0, 1.0) + rimOf(p, uM1, 0.0) * smoothstep(0.008, 0.02, uM1.w)) * 1.15;

  if (uJet > 0.001){
    vec2 jd = (p - uM0.xy) / uWorld;
    float axis = abs(jd.x * 0.62 + jd.y * 0.78);
    float along = clamp(1.0 - abs(jd.x * 0.78 - jd.y * 0.62) * 0.7, 0.0, 1.0);
    col += uInk * exp(-axis * axis * 900.0) * along * uJet * 2.4;
  }

  float fMag = length(offUv);
  vec2 fOff = fMag > 1e-6
    ? (offUv / fMag) * (fMag / (1.0 + fMag * 4.0)) * 0.85
    : vec2(0.0);
  vec3 fCol = samp(uFront, uv, fOff, uBlur * 0.6);
  float fA = texture2D(uFront, uv + fOff).a;
  col = mix(col, fCol, clamp(fA * 1.6, 0.0, 1.0));

  if (uFocusMix.x > 0.0005){
    vec2 fm = texture2D(uFocus, uv + mix(offUv, fOff, uFocusFront)).rg;
    float keep = smoothstep(0.08, 0.62, fm.r);
    col *= mix(1.0 - uFocusMix.x * uFocusMix.y, 1.0, keep);
    col += uInk * fm.g * (1.0 - keep) * uFocusMix.x * uFocusMix.z;
  }

  float cd = length(p - uCur.xy);
  col += uInk * exp(-cd * cd * 5200.0) * 0.55;

  if (abs(uReach) > 0.004){
    float rad = 0.030 - 0.011 * uReach;
    float rq = (cd - rad) / 0.0026;
    float amp = uReach > 0.0 ? uReach * 0.62 : -uReach * 0.30;
    col += uInk * exp(-rq * rq) * amp;
  }

  col *= uFade;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.3) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
