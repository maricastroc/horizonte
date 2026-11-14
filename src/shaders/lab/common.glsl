precision highp float;
precision highp sampler2D;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFocal;
uniform vec3 uBodyPos;
uniform mat3 uBodyRot;
uniform float uRadius;
uniform sampler2D uShape;
uniform sampler2D uWarp;
uniform sampler2D uText;
uniform sampler2D uCover;
uniform vec4 uBand;
uniform vec2 uBound;
uniform vec3 uCoreAt;
uniform float uCore;
uniform vec4 uSat[4];
uniform vec3 uInkA;
uniform vec3 uInkB;
uniform vec3 uLight;
uniform vec3 uKey;
uniform vec4 uAudio;
uniform vec4 uAccent;
uniform vec2 uRings[6];
uniform vec4 uSea;
uniform float uTide;
uniform vec4 uPlay;
uniform vec4 uHover;
uniform float uSpin;
uniform float uGlow;
uniform vec4 uTextRect;
uniform vec2 uTextAt;
uniform float uSteps;
uniform float uLens;
uniform vec4 uGlass;
uniform float uDetail;

out vec4 fragColor;

const float TAU = 6.2831853;

struct Hit {
  float t;
  float kind;
  vec3 p;
  vec3 n;
};

float mapBody(vec3 p);
vec3 shadeBody(Hit h, vec3 dl, vec3 rd);
vec3 shadeBodyLite(Hit h, vec3 dl, vec3 rd);

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float smax(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

vec3 toLocal(vec3 p){ return ((p - uBodyPos) * uBodyRot) / uRadius; }
vec3 toLocalDir(vec3 d){ return d * uBodyRot; }
vec3 toWorld(vec3 p){ return uBodyRot * p * uRadius + uBodyPos; }
vec3 toWorldDir(vec3 d){ return uBodyRot * d; }

void profAt(vec3 pl, out vec4 a, out vec4 b, out float r, out float turn){
  r = length(pl.xz);
  turn = fract(atan(pl.z, pl.x) / TAU - uSpin);
  a = texture(uShape, vec2(turn, 0.25));
  b = texture(uShape, vec2(turn, 0.75));
}

float bandD(float r, float lo, float hi){
  return hi - lo < 1e-4 ? 9.0 : max(lo - r, r - hi);
}

float planD(vec3 pl, out float r, out float turn, out float gap){
  vec4 a;
  vec4 b;
  profAt(pl, a, b, r, turn);
  float hi = max(a.y, max(a.w, b.y));
  gap = min(min(bandD(r, a.x, a.y), bandD(r, a.z, a.w)), bandD(r, b.x, b.y));
  return max(bandD(r, a.x, hi), -b.z * TAU * r);
}

float lightLobe(float mu){
  float l = pow(mu, 24.0) * 0.06 + pow(mu, 4.0) * 0.01;
  if (mu > 0.97) l += pow(mu, 2400.0) * 30.0 + pow(mu, 220.0) * 0.5;
  return l;
}

float arcLine(vec3 d, vec3 axis, float c, float w){
  float x = (dot(d, axis) - c) / w;
  return exp(-x * x);
}

vec3 arcs(vec3 d){
  float a = arcLine(d, normalize(vec3(0.25, 0.35, -0.9)), 0.62, 0.0022) * 0.9
          + arcLine(d, normalize(vec3(-0.5, 0.2, -0.85)), 0.35, 0.0016) * 0.5
          + arcLine(d, normalize(vec3(0.1, 0.9, 0.4)), 0.2, 0.003) * 0.4;
  return (vec3(1.0, 0.8, 0.5) * 0.45 + uInkB * 0.5) * a * smoothstep(-0.02, 0.12, d.y);
}

vec3 stars(vec3 d){
  if (d.y < 0.01) return vec3(0.0);
  vec2 uv = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0))) * 110.0;
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash21(id);
  vec2 o = (vec2(hash21(id + 7.1), hash21(id + 3.3)) - 0.5) * 0.6;
  float s = step(0.955, h) * smoothstep(0.14, 0.0, length(f + o));
  float tw = 0.7 + 0.3 * sin(uTime * 1.3 + h * 40.0);
  return vec3(0.8, 0.86, 1.0) * s * (0.25 + 0.75 * hash21(id + 1.7)) * tw * smoothstep(0.0, 0.2, d.y) * 0.6;
}

vec3 hazeOf(vec3 d){
  float mu = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uLight.x, 0.0, uLight.z))), 0.0);
  return uInkA * 0.012 + vec3(0.003, 0.004, 0.009) + uInkA * 0.05 * (0.3 + 0.7 * pow(mu, 3.0));
}

vec3 skyBase(vec3 d){
  float y = max(d.y, 0.0);
  float mu = max(dot(d, uLight), 0.0);
  vec3 zen = vec3(0.0022, 0.003, 0.008);
  vec3 hor = uInkA * 0.012 + vec3(0.003, 0.004, 0.009);
  vec3 c = mix(hor, zen, pow(y, 0.4));
  c += uInkA * 0.05 * exp(-y * 14.0) * (0.3 + 0.7 * pow(mu, 3.0));
  vec3 lc = mix(uInkA * 1.6, vec3(1.0, 0.93, 0.82), 0.4);
  c += lc * lightLobe(mu) * uGlow;
  float kk = max(dot(d, uKey), 0.0);
  c += vec3(1.0, 0.78, 0.55) * (pow(kk, 60.0) * 2.2 + pow(kk, 6.0) * 0.12);
  c += arcs(d);
  return c;
}

vec3 sky(vec3 d){
  return skyBase(d) + stars(d);
}

vec3 envAt(vec3 d){
  if (d.y >= 0.0) return min(skyBase(d), vec3(10.0));
  float f = 0.02 + 0.98 * pow(1.0 + d.y, 5.0);
  return min(skyBase(vec3(d.x, -d.y, d.z)), vec3(10.0)) * f + vec3(0.002, 0.004, 0.008) + uInkA * 0.012;
}

vec3 noised(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}

vec2 waterGrad(vec2 p, float detail){
  float t = uTime * uSea.w;
  float k = TAU / uSea.y;
  const vec2 d1 = vec2(0.92, 0.38);
  const vec2 d2 = vec2(-0.35, 0.94);
  const vec2 d3 = vec2(0.55, -0.83);
  vec2 g = d1 * (k * 0.6 * cos(dot(p, d1) * k - t * 1.1))
         + d2 * (k * 0.416 * cos(dot(p, d2) * k * 1.6 - t * 1.45 + 1.7))
         + d3 * (k * 0.243 * cos(dot(p, d3) * k * 2.7 - t * 1.9 + 4.1));
  g *= uSea.x;
  if (detail > 0.04){
    vec3 n1 = noised(p * 3.1 + vec2(t * 0.35, t * 0.2));
    vec3 n2 = noised(p * 7.3 - vec2(t * 0.5, -t * 0.3));
    g += uSea.z * detail * (n1.yz * 3.1 + n2.yz * 3.65);
  }
  vec2 q = p - uBodyPos.xz;
  float r = length(q) + 1e-4;
  if (r < 16.0){
    float r2 = uRadius * uRadius * 0.9;
    float dr = uTide * exp(-r * r / r2) * (-2.0 * r / r2);
    for (int i = 0; i < 6; i++){
      float age = uTime - uRings[i].x;
      if (uRings[i].y <= 0.0 || age < 0.0 || age > 9.0) continue;
      float rho = age * 1.5;
      float x = r - rho;
      dr += uRings[i].y / (1.0 + rho * 0.55) * exp(-x * x * 9.0)
          * (-18.0 * x * cos(x * 11.0) - 11.0 * sin(x * 11.0));
    }
    g += q / r * dr;
  }
  return g;
}

vec3 waterN(vec2 p, float dist){
  vec2 g = waterGrad(p, uDetail / (1.0 + dist * dist * 0.012));
  return normalize(vec3(-g.x, 1.0, -g.y));
}

float textHit(vec3 ro, vec3 rd, out float t){
  t = 1e9;
  if (abs(rd.z) < 1e-5) return 0.0;
  float tt = (uTextAt.x - ro.z) / rd.z;
  if (tt <= 0.0) return 0.0;
  vec3 p = ro + rd * tt;
  if (p.y < 0.0) return 0.0;
  vec2 uv = vec2((p.x - uTextRect.x) / (uTextRect.y - uTextRect.x), (p.y - uTextRect.z) / (uTextRect.w - uTextRect.z));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  t = tt;
  return texture(uText, uv).r;
}

vec3 textColor(vec3 ro, vec3 rd, float t){
  float y = (ro + rd * t).y;
  return (vec3(0.84, 0.82, 0.78) + uInkA * 0.25) * uTextAt.y * mix(0.4, 1.0, smoothstep(0.0, 0.8, y));
}

vec3 fogged(vec3 c, vec3 rd, float dist){
  float f = 1.0 - exp(-dist * 0.016);
  return mix(c, hazeOf(rd), f);
}

bool boundsOf(vec3 ro, vec3 rd, out float t0, out float t1){
  float b = dot(ro, rd);
  float c = dot(ro, ro) - uBound.x * uBound.x;
  float h = b * b - c;
  t0 = 0.0;
  t1 = 0.0;
  if (h < 0.0) return false;
  h = sqrt(h);
  t0 = max(-b - h, 0.0);
  t1 = -b + h;
  if (abs(rd.y) > 1e-5){
    float ta = (-uBound.y - ro.y) / rd.y;
    float tb = (uBound.y - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
  } else if (abs(ro.y) > uBound.y) return false;
  return t1 > t0;
}

float sphereAt(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + r * r;
  if (h < 0.0) return -1.0;
  float t = -b - sqrt(h);
  return t > 0.0 ? t : -1.0;
}

vec3 normalAt(vec3 p){
  const vec2 e = vec2(0.003, -0.003);
  return normalize(
      e.xyy * mapBody(p + e.xyy)
    + e.yyx * mapBody(p + e.yyx)
    + e.yxy * mapBody(p + e.yxy)
    + e.xxx * mapBody(p + e.xxx));
}

Hit traceLocal(vec3 ro, vec3 rd, float steps, float core){
  Hit h;
  h.t = 1e9;
  h.kind = 0.0;
  h.p = vec3(0.0);
  h.n = vec3(0.0, 1.0, 0.0);
  float t0;
  float t1;
  if (boundsOf(ro, rd, t0, t1)){
    float t = t0;
    for (int i = 0; i < 96; i++){
      if (float(i) >= steps || t > t1) break;
      float d = mapBody(ro + rd * t);
      if (d < 0.0014){
        h.t = t;
        h.kind = 1.0;
        break;
      }
      t += d * 0.8;
    }
  }
  float ob = dot(ro, rd);
  if (ob * ob - dot(ro, ro) + 8.0 < 0.0){
    h.p = ro + rd * h.t;
    return h;
  }
  if (core > 0.5){
    float ts = sphereAt(ro, rd, uCoreAt, uCore);
    if (ts > 0.0 && ts < h.t){
      h.t = ts;
      h.kind = 2.0;
      h.n = normalize(ro + rd * ts - uCoreAt);
    }
  }
  for (int i = 0; i < 4; i++){
    if (uSat[i].w < 0.001) continue;
    float ts = sphereAt(ro, rd, uSat[i].xyz, uSat[i].w);
    if (ts > 0.0 && ts < h.t){
      h.t = ts;
      h.kind = 3.0;
      h.n = normalize(ro + rd * ts - uSat[i].xyz);
    }
  }
  h.p = ro + rd * h.t;
  return h;
}

vec3 shadeOrb(vec3 n, vec3 rd, float gloss){
  float ndv = max(dot(n, -rd), 0.0);
  float f = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 c = envAt(reflect(rd, n)) * f * gloss;
  c += uInkA * 0.012 * (0.3 + max(dot(n, uKey), 0.0));
  return c;
}

float shadowPlan(vec3 p){
  vec3 sl = toLocal(p);
  vec3 dl = toLocalDir(uLight);
  if (abs(dl.y) < 1e-4) return 9.0;
  float t = -sl.y / dl.y;
  if (t < 0.0) return 9.0;
  float r;
  float turn;
  float gap;
  return planD(sl + dl * t, r, turn, gap);
}

vec3 waterBase(vec3 p){
  float rr = length(p.xz - uBodyPos.xz) / uRadius;
  vec3 deep = vec3(0.002, 0.004, 0.008) + uInkA * 0.012;
  float pool = exp(-rr * rr * 0.5);
  if (pool < 0.015) return deep;
  float d = shadowPlan(p);
  float inside = smoothstep(0.03, -0.03, d);
  float edge = exp(-d * d * 700.0);
#ifdef GLASS
  float lit = 0.35 + 0.5 * inside + 2.6 * edge;
#else
  float lit = 1.0 - 0.75 * inside + 0.0 * edge;
#endif
  deep += mix(uInkA, vec3(1.0, 0.92, 0.8), 0.15) * pool * (0.07 + 0.25 * uAccent.w) * uGlow * lit;
  return deep;
}

vec3 farField(vec3 ro, vec3 rd){
  float tt;
  float ta = textHit(ro, rd, tt);
  float tw = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;
  vec3 c;
  if (tw < 1e8){
    vec3 p = ro + rd * tw;
    vec3 n = waterN(p.xz, tw + 14.0);
    float f = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 r = reflect(rd, n);
    r.y = abs(r.y) + 0.001;
    c = fogged(mix(waterBase(p), skyBase(normalize(r)), f), rd, tw);
  } else {
    c = sky(rd);
  }
  if (ta > 0.0 && tt < tw) c = mix(c, textColor(ro, rd, tt), ta);
  return c;
}

vec3 reflected(vec3 p, vec3 r){
  vec3 rl = toLocal(p);
  vec3 dl = toLocalDir(r);
  Hit h = traceLocal(rl, dl, uSteps * 0.6, 1.0);
  float tt;
  float ta = textHit(p, r, tt);
  float tb = 1e9;
  vec3 c;
  if (h.kind > 0.5){
    c = shadeBodyLite(h, dl, r);
    tb = h.t * uRadius;
  } else {
    c = skyBase(r);
  }
  if (ta > 0.0 && tt < tb) c = mix(c, textColor(p, r, tt), ta);
  return c;
}

vec3 waterShade(vec3 p, vec3 rd, float dist){
  vec3 n = waterN(p.xz, dist);
  float f = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 r = reflect(rd, n);
  r.y = abs(r.y) + 0.001;
  return mix(waterBase(p), reflected(p, normalize(r)), f);
}

vec3 traceWorld(vec3 ro, vec3 rd, float core, float limit, out float mask, out float near){
  mask = 0.0;
  vec3 rl = toLocal(ro);
  vec3 dl = toLocalDir(rd);
  Hit h = traceLocal(rl, dl, uSteps, core);
  float tb = h.kind > 0.5 ? h.t * uRadius : 1e9;
  float tw = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;
  float tt;
  float ta = textHit(ro, rd, tt);
  near = min(tb, tw);
  if (ta > 0.5) near = min(near, tt);
  if (near > limit) return vec3(0.0);
  vec3 c;
  if (tb < tw){
    c = shadeBody(h, dl, rd);
  } else if (tw < 1e8){
    c = waterShade(ro + rd * tw, rd, tw);
  } else {
    c = sky(rd);
    mask = clamp(lightLobe(max(dot(rd, uLight), 0.0)) * 0.6, 0.0, 3.0) * uGlow;
  }
  float tn = min(tb, tw);
  if (ta > 0.0 && tt < tn){
    c = mix(c, textColor(ro, rd, tt), ta);
    mask *= 1.0 - ta;
    tn = tt;
  }
  return fogged(c, rd, min(tn, 60.0));
}

vec3 scene(vec3 ro, vec3 rd, out float mask){
  float near;
#ifdef LENS
  vec3 c = toWorld(uCoreAt);
  float tca = dot(c - ro, rd);
  if (tca > 0.0){
    vec3 pc = ro + rd * tca;
    vec3 tow = c - pc;
    float b = length(tow);
    float rc = uCore * uRadius;
    float q = rc / b;
    float al = uLens * q * q * q * smoothstep(2.8, 1.2, b / rc);
    if (al > 0.004 && b > rc){
      vec3 first = traceWorld(ro, rd, 1.0, tca, mask, near);
      if (near <= tca) return first;
      vec3 bent = normalize(rd + (tow / b) * al);
      vec3 second = traceWorld(pc, bent, 0.0, 1e9, mask, near);
      float ring = exp(-pow((b - rc * 1.03) / (rc * 0.022), 2.0));
      return second + mix(uInkA, vec3(1.0, 0.92, 0.8), 0.5) * ring * 0.12 * uGlow;
    }
  }
#endif
  return traceWorld(ro, rd, 1.0, 1e9, mask, near);
}

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 rd = normalize(uCamRot * vec3(uv, uFocal));
  float mask;
  vec3 col = scene(uCamPos, rd, mask);
  fragColor = vec4(min(col, vec3(64.0)), mask);
}
