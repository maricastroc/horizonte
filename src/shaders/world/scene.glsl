precision highp float;
precision highp sampler2D;

#define NB 3

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFocal;
uniform sampler2D uShape;
uniform sampler2D uWarp;
uniform sampler2D uText;
uniform vec3 uBPos[NB];
uniform vec4 uBRot[NB];
uniform vec4 uBBand[NB];
uniform vec4 uBCore[NB];
uniform vec4 uBGlass[NB];
uniform vec3 uBInkA[NB];
uniform vec3 uBInkB[NB];
uniform vec4 uBSat[NB * 4];
uniform vec4 uBMat[NB];
uniform vec4 uScore;
uniform vec4 uWave;
uniform vec4 uPulse;
uniform vec3 uKeyCol;
uniform vec3 uInk2;
uniform vec4 uAir;
uniform float uReflK;
uniform vec2 uPart;
uniform vec4 uSeed;
uniform float uRef;
uniform vec4 uPlay;
uniform vec4 uHover;
uniform float uFocus;
uniform vec3 uInk;
uniform vec3 uMoon;
uniform vec3 uKey;
uniform vec3 uRim;
uniform vec4 uAudio;
uniform vec4 uAccent;
uniform vec4 uRings[6];
uniform vec4 uSea;
uniform vec4 uCursor;
uniform float uGlow;
uniform float uJet;
uniform vec4 uTextRect;
uniform vec3 uTextAt;
uniform float uSteps;
uniform float uDetail;
uniform float uIor;
uniform float uIrid;

out vec4 fragColor;

const float TAU = 6.2831853;

struct Hit {
  float t;
  float kind;
  float id;
  vec3 p;
  vec3 n;
};

vec3 gPos;
float gSa;
float gCa;
float gRad;
vec4 gBand;
vec4 gCore;
vec4 gGlass;
vec3 gInkA;
vec3 gInkB;
float gRow;
int gBody;

void useBody(int b){
  gBody = b;
  gPos = uBPos[b];
  gSa = uBRot[b].x;
  gCa = uBRot[b].y;
  gRad = uBRot[b].z;
  gBand = uBBand[b];
  gCore = uBCore[b];
  gGlass = uBGlass[b];
  gInkA = uBInkA[b];
  gInkB = uBInkB[b];
  gRow = float(b);
}

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float smax(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

vec3 toLocalDir(vec3 d){ return vec3(d.x, d.y * gSa + d.z * gCa, -d.y * gCa + d.z * gSa); }
vec3 toLocal(vec3 p){ return toLocalDir(p - gPos) / gRad; }
vec3 toWorldDir(vec3 d){ return vec3(d.x, d.y * gSa - d.z * gCa, d.y * gCa + d.z * gSa); }
vec3 toWorld(vec3 p){ return toWorldDir(p) * gRad + gPos; }

void profAt(vec3 pl, out vec4 a, out vec4 b, out float r, out float turn){
  r = length(pl.xz);
  turn = fract(atan(pl.z, pl.x) / TAU - gGlass.z);
  float v = (gRow * 2.0 + 0.5) / float(NB * 2);
  a = texture(uShape, vec2(turn, v));
  b = texture(uShape, vec2(turn, v + 1.0 / float(NB * 2)));
}

float bandD(float r, float lo, float hi){
  return hi - lo < 1e-4 ? 9.0 : max(lo - r, r - hi);
}

float mapBody(vec3 pl){
  vec4 a;
  vec4 b;
  float r;
  float turn;
  profAt(pl, a, b, r, turn);
  float lo = a.x;
  float hi = max(a.y, max(a.w, b.y));
  if (hi - lo < 1e-4) return 9.0;
  vec4 wv = texture(uWarp, vec2(turn, (gRow + 0.5) / float(NB)));
  float hw = (hi - lo) * 0.5;
  float x = r - (lo + hi) * 0.5;
  float lift = wv.x * gGlass.x;
  if (float(gBody) == uFocus){
    float dp = abs(fract(turn - uPlay.x + 0.5) - 0.5);
    float hit = exp(-dp * dp * 260.0) * uScore.y * uPlay.w;
    lift += uWave.x * sin(turn * TAU * uWave.y - uWave.z) + hit * 0.075;
    x -= uWave.w + hit * 0.05;
  }
  float e = clamp(x / hw, -1.0, 1.0);
  float gap = min(min(bandD(r, a.x, a.y), bandD(r, a.z, a.w)), bandD(r, b.x, b.y));
  float thick = gBand.z * mix(0.2, 1.0, sqrt(1.0 - e * e)) * (1.0 - 0.42 * smoothstep(0.0, 0.012, gap));
  vec2 q = vec2(x, pl.y - lift - x * wv.w * gGlass.y);
  float rr = min(hw, thick) * 0.9;
  vec2 w = abs(q) - vec2(hw, thick) + rr;
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - rr;
  return smax(d, -b.z * TAU * r - 0.005, 0.02);
}

float planD(vec3 pl){
  vec4 a;
  vec4 b;
  float r;
  float turn;
  profAt(pl, a, b, r, turn);
  float hi = max(a.y, max(a.w, b.y));
  return max(bandD(r, a.x, hi), -b.z * TAU * r);
}

float arcLine(vec3 d, vec3 axis, float c, float w){
  float x = (dot(d, axis) - c) / w;
  return exp(-x * x);
}

vec3 arcs(vec3 d){
  float a = arcLine(d, normalize(vec3(0.25, 0.35, -0.9)), 0.62, 0.002) * 0.8
          + arcLine(d, normalize(vec3(-0.5, 0.2, -0.85)), 0.35, 0.0015) * 0.45
          + arcLine(d, normalize(vec3(0.1, 0.9, 0.4)), 0.2, 0.003) * 0.3;
  return (vec3(1.0, 0.8, 0.5) * 0.3 + uInk * 0.5) * a * smoothstep(-0.02, 0.12, d.y);
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
  return vec3(0.8, 0.86, 1.0) * s * (0.25 + 0.75 * hash21(id + 1.7)) * tw * smoothstep(0.0, 0.2, d.y) * 0.5 * uAir.z;
}

float moonLobe(float mu){
  float l = pow(mu, 30.0) * 0.035 + pow(mu, 5.0) * 0.012;
  if (mu > 0.97) l += pow(mu, uAir.w) * 6.0 + pow(mu, uAir.w * 0.08) * 0.06;
  return l;
}

vec3 hazeOf(vec3 d){
  float az = max(dot(normalize(d.xz + 1e-5), normalize(uMoon.xz)), 0.0);
  return (uInk * 0.014 + vec3(0.003, 0.004, 0.009) + uInk * 0.05 * (0.25 + 0.75 * az * az) + uInk2 * 0.018 * (1.0 - az)) * uAir.y;
}

vec3 skyBase(vec3 d){
  float y = max(d.y, 0.0);
  float az = max(dot(normalize(d.xz + 1e-5), normalize(uMoon.xz)), 0.0);
  vec3 c = mix(uInk * 0.014 + vec3(0.003, 0.004, 0.009), vec3(0.0018, 0.0026, 0.007), pow(y, 0.38));
  c += (uInk * 0.085 * (0.25 + 0.75 * az * az) + uInk2 * 0.03 * (1.0 - az)) * exp(-y * 9.0) * uAir.y;
  c += (uInk * 0.6 + 0.05) * 0.11 * exp(-y * 70.0) * (0.35 + 0.65 * az);
  c += mix(uInk * 1.5, vec3(1.0, 0.94, 0.84), 0.5) * moonLobe(max(dot(d, uMoon), 0.0)) * uGlow;
  float k1 = max(dot(d, uKey), 0.0);
  c += uKeyCol * (smoothstep(0.9, 0.975, k1) * 1.2 + pow(k1, 5.0) * 0.08);
  float k2 = max(dot(d, uRim), 0.0);
  c += (uInk * 1.6 + 0.18) * (smoothstep(0.93, 0.988, k2) * 1.4 + pow(k2, 8.0) * 0.06) * (1.0 + 1.5 * uScore.z);
  c += arcs(d);
  return c;
}

vec3 sky(vec3 d){
  return skyBase(d) + stars(d);
}

vec3 envAt(vec3 d){
  if (d.y >= 0.0) return min(skyBase(d), vec3(8.0));
  float f = 0.02 + 0.98 * pow(1.0 + d.y, 5.0);
  return min(skyBase(vec3(d.x, -d.y, d.z)), vec3(8.0)) * f + vec3(0.002, 0.004, 0.008) + uInk * 0.012;
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
         + d2 * (k * 0.4 * cos(dot(p, d2) * k * 1.6 - t * 1.45 + 1.7))
         + d3 * (k * 0.2 * cos(dot(p, d3) * k * 2.7 - t * 1.9 + 4.1));
  g *= uSea.x;
  if (detail > 0.04){
    vec3 n1 = noised(p * 3.1 + vec2(t * 0.35, t * 0.2));
    vec3 n2 = noised(p * 7.3 - vec2(t * 0.5, -t * 0.3));
    g += uSea.z * detail * (n1.yz * 3.1 + n2.yz * 3.65);
  }
  for (int b = 0; b < NB; b++){
    float alive = uBRot[b].w;
    if (alive < 0.01) continue;
    vec2 q = p - uBPos[b].xz;
    float r2 = uBRot[b].z * uBRot[b].z * 0.9;
    float rr = dot(q, q);
    if (rr > r2 * 12.0) continue;
    g += q * (uBCore[b].w * 0.9 * alive * exp(-rr / r2) * (-2.0 / r2));
  }
  for (int i = 0; i < 6; i++){
    float age = uTime - uRings[i].z;
    if (uRings[i].w <= 0.0 || age < 0.0 || age > 9.0) continue;
    vec2 q = p - uRings[i].xy;
    float r = length(q) + 1e-4;
    float rho = age * 1.5;
    float x = r - rho;
    if (abs(x) > 1.2) continue;
    float amp = uRings[i].w;
    g += q / r * (amp / (1.0 + rho * 0.55) * exp(-x * x * 9.0)
       * (-18.0 * x * cos(x * 11.0) - 11.0 * sin(x * 11.0)));
  }
  vec2 qc = p - uCursor.xy;
  float rc = dot(qc, qc);
  if (uCursor.z > 0.0 && rc < 1.0) g += qc * (uCursor.z * exp(-rc * 22.0) * 44.0);
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
  return texture(uText, uv).r * smoothstep(0.0, 0.04, uTextAt.y);
}

vec3 textColor(vec3 ro, vec3 rd, float t){
  float y = (ro + rd * t).y;
  return (vec3(0.8, 0.79, 0.76) + uInk * 0.35) * uTextAt.y * mix(0.35, 1.0, smoothstep(0.0, 1.2, y));
}

vec3 fogged(vec3 c, vec3 rd, float dist){
  return mix(c, hazeOf(rd), 1.0 - exp(-dist * uAir.x));
}

bool boundsOf(vec3 ro, vec3 rd, out float t0, out float t1){
  float bound = gBand.y + 0.06;
  float b = dot(ro, rd);
  float h = b * b - dot(ro, ro) + bound * bound;
  t0 = 0.0;
  t1 = 0.0;
  if (h < 0.0) return false;
  h = sqrt(h);
  t0 = max(-b - h, 0.0);
  t1 = -b + h;
  if (abs(rd.y) > 1e-5){
    float ta = (-gBand.w - ro.y) / rd.y;
    float tb = (gBand.w - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
  } else if (abs(ro.y) > gBand.w) return false;
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
  h.id = 0.0;
  h.p = vec3(0.0);
  h.n = vec3(0.0, 1.0, 0.0);
  float ob = dot(ro, rd);
  if (ob * ob - dot(ro, ro) + 9.0 < 0.0) return h;
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
  vec3 cc = vec3(gCore.x, 0.0, gCore.y);
  if (core > 0.5){
    float ts = sphereAt(ro, rd, cc, gCore.z);
    if (ts > 0.0 && ts < h.t){
      h.t = ts;
      h.kind = 2.0;
      h.n = normalize(ro + rd * ts - cc);
    }
  }
  for (int i = 0; i < 4; i++){
    vec4 s = uBSat[gBody * 4 + i];
    if (s.z < 0.001) continue;
    vec3 sc = vec3(s.x, 0.0, s.y);
    float ts = sphereAt(ro, rd, sc, s.z);
    if (ts > 0.0 && ts < h.t){
      h.t = ts;
      h.kind = 3.0;
      h.id = float(i);
      h.n = normalize(ro + rd * ts - sc);
    }
  }
  if (float(gBody) == uFocus && uSeed.z > 0.001){
    vec3 sc = vec3(uSeed.x, 0.0, uSeed.y);
    float ts = sphereAt(ro, rd, sc, uSeed.z);
    if (ts > 0.0 && ts < h.t){
      h.t = ts;
      h.kind = 3.0;
      h.id = 4.0;
      h.n = normalize(ro + rd * ts - sc);
    }
  }
  h.p = ro + rd * h.t;
  return h;
}

Hit traceAll(vec3 ro, vec3 rd, float steps, float core, out vec3 dl){
  Hit best;
  best.t = 1e9;
  best.kind = 0.0;
  best.id = 0.0;
  best.p = vec3(0.0);
  best.n = vec3(0.0, 1.0, 0.0);
  int pick = -1;
  dl = rd;
  for (int b = 0; b < NB; b++){
    if (uBRot[b].w < 0.01) continue;
    useBody(b);
    Hit h = traceLocal(toLocal(ro), toLocalDir(rd), steps, core);
    if (h.kind > 0.5 && h.t * gRad < best.t){
      best = h;
      best.t = h.t * gRad;
      pick = b;
    }
  }
  if (pick >= 0){
    useBody(pick);
    dl = toLocalDir(rd);
  }
  return best;
}

vec3 film(float c){
  return 0.5 + 0.5 * cos(TAU * (c * 1.4 + vec3(0.0, 0.33, 0.67)));
}

vec3 bodyOf(float ndv, float r){
  return gInkA * (0.5 + 1.0 * film(ndv * 0.7 + r * 0.4)) + gInkB * 0.14;
}

vec3 sigmaOf(vec3 body){
  return (vec3(1.0) - clamp(body * 1.3 + 0.12, 0.0, 1.0)) * 5.0;
}

vec3 shadeOrb(vec3 n, vec3 rd, float kind){
  vec4 m = uBMat[gBody];
  float ndv = max(dot(n, -rd), 0.0);
  float f0 = mix(0.045, 0.5, m.w);
  float f = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
  vec3 c = envAt(reflect(rd, n)) * f * mix(vec3(1.0), gInkA * 2.2 + 0.25, m.w) * mix(0.45, 1.0, m.x);
  float wrap = max(dot(n, uKey) * 0.5 + 0.5, 0.0);
  float glow = (float(gBody) == uFocus ? uPulse.x : 0.15) * (kind > 2.5 ? 0.45 : 1.0);
  c += gInkA * (0.02 + 0.06 * wrap * wrap) * (1.0 - 0.6 * m.y) + gInkA * ndv * ndv * 0.12 * glow;
  return c;
}

vec3 innerLight(float r, float turn){
  if (float(gBody) != uFocus) return vec3(0.0);
  float dturn = abs(fract(turn - uPlay.x + 0.5) - 0.5);
  float line = exp(-pow(dturn * TAU * r / 0.045, 2.0));
  vec3 c = mix(gInkA, vec3(1.0), 0.6) * line * (0.9 + 4.0 * uAccent.w) * uPlay.w;
  float act = step(uPlay.y, turn) * step(turn, uPlay.z) * uPlay.w;
  float hov = step(uHover.x, turn) * step(turn, uHover.y) * uHover.z;
  c += gInkA * (0.14 * act + 0.26 * hov) + vec3(0.05) * hov;
  return c;
}

vec3 waterBase(vec3 p){
  vec3 deep = vec3(0.002, 0.004, 0.008) + uInk * 0.012;
  for (int b = 0; b < NB; b++){
    float alive = uBRot[b].w;
    if (alive < 0.01) continue;
    vec2 q = p.xz - uBPos[b].xz;
    float rr = dot(q, q) / (uBRot[b].z * uBRot[b].z);
    float pool = exp(-rr * 0.55) * alive;
    if (pool < 0.02) continue;
    useBody(b);
    vec3 sl = toLocal(p);
    vec3 ll = toLocalDir(uKey);
    float d = 9.0;
    float along = ll.y > 1e-3 ? -sl.y / ll.y : -1.0;
    if (along > 0.0) d = planD(sl + ll * along);
    float lit = 0.3 + 0.45 * smoothstep(0.03, -0.03, d) + 2.2 * exp(-d * d * 700.0);
    deep += mix(gInkA, vec3(1.0, 0.92, 0.8), 0.12) * pool * (0.05 + 0.2 * uAccent.w * (float(b) == uFocus ? 1.0 : 0.0)) * uBGlass[b].w * lit;
  }
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
    c = fogged(mix(vec3(0.002, 0.004, 0.008) + uInk * 0.012, skyBase(normalize(r)), f), rd, tw);
  } else {
    c = sky(rd);
  }
  if (ta > 0.0 && tt < tw) c = mix(c, textColor(ro, rd, tt), ta);
  return c;
}

vec3 shadeLite(Hit h, vec3 dl, vec3 rd);

vec3 shadeSphere(Hit h, vec3 dl, vec3 rd, float steps){
  vec4 m = uBMat[gBody];
  bool isCore = h.kind < 2.5;
  vec3 centre = vec3(gCore.x, 0.0, gCore.y);
  float rad = gCore.z;
  if (!isCore){
    vec4 s = h.id > 3.5 ? uSeed.xyzz : uBSat[gBody * 4 + int(h.id)];
    centre = vec3(s.x, 0.0, s.y);
    rad = s.z;
  }
  vec3 n = h.n;
  vec3 wn = toWorldDir(n);
  float ndv = max(dot(n, -dl), 0.0);
  float f0 = mix(0.045, 0.5, m.w);
  float f = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
  vec3 rl = reflect(dl, n);
  vec3 rw = toWorldDir(rl);
  vec3 soft = hazeOf(rw) * 2.5 + uKeyCol * pow(max(dot(rw, uKey), 0.0), 3.0) * 0.2;
  vec3 mirror = mix(soft, envAt(rw), m.x);
  if (isCore && uDetail > 0.75){
    Hit hr = traceLocal(h.p + n * 0.02, rl, steps * 0.4, 0.0);
    if (hr.kind > 0.5 && hr.kind < 1.5) mirror = mix(mirror, shadeLite(hr, rl, rw), 0.5 + 0.5 * m.x);
  }
  vec3 refl = mirror * f * mix(vec3(1.0), gInkA * 2.2 + 0.25, m.w);

  float glow = (float(gBody) == uFocus ? uPulse.x : 0.15) * (isCore ? 1.0 : 0.45) + (h.id > 3.5 ? 1.4 : 0.0);
  float spin = uPulse.y * (isCore ? 1.0 : 0.6) + h.id * 2.1;
  float shells = isCore ? m.z : min(m.z, 1.0);
  vec3 di = refract(dl, n, 1.0 / 1.5);
  float chord = 2.0 * max(dot(-di, n), 0.0);
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < 4; i++){
    vec3 q = n + di * chord * (float(i) + 0.5) * 0.25;
    float r = length(q);
    float lay = 0.0;
    for (int k = 0; k < 3; k++){
      if (float(k) >= shells) break;
      float x = (r - (0.3 + 0.23 * float(k))) / 0.04;
      lay += exp(-x * x);
    }
    float swirl = 0.5 + 0.5 * sin(atan(q.z, q.x) * 3.0 + r * 9.0 + q.y * 4.0 - spin);
    float nuc = exp(-r * r * 12.0);
    vec3 em = gInkA * (lay * (0.25 + 0.75 * swirl) * 0.55 + nuc * (0.5 + 3.0 * glow))
            + gInkB * lay * 0.18 + gInkA * swirl * 0.05 * (1.0 - m.y);
    acc += em * trans * chord * 0.25;
    trans *= exp(-m.y * (0.7 + 0.6 * swirl) * chord * 0.85);
  }
  vec3 col = refl + acc * (1.0 - f);
  if (trans > 0.05 && uDetail > 0.75){
    vec3 pe = n + di * chord;
    vec3 ne = -normalize(pe);
    vec3 dg = refract(di, ne, 1.5);
    if (dot(dg, dg) < 1e-4) dg = reflect(di, ne);
    col += farField(toWorld(centre + pe * rad), toWorldDir(dg)) * trans * (1.0 - f) * (gInkA * 1.2 + 0.25);
  }
  float wrap = max(dot(wn, uKey) * 0.5 + 0.5, 0.0);
  col += gInkA * 0.02 * wrap * wrap * (1.0 - m.x * 0.5);
  if (!isCore){
    vec3 toCore = normalize(vec3(gCore.x, 0.0, gCore.y) - centre);
    col += gInkA * max(dot(n, toCore), 0.0) * 0.24 * glow;
  }
  if (float(gBody) == uFocus && uPart.y > 0.01){
    bool mine = isCore ? abs(uPart.x - 6.0) < 0.5 : abs(uPart.x - 1.0) < 0.5;
    float beat = isCore ? 1.0 : 0.7 + 0.5 * sin(uTime * 2.4 - h.id * 1.5);
    col = col * mix(1.0, mine ? 1.2 * beat : 0.34, uPart.y) + (mine ? gInkA * 0.1 * beat * uPart.y : vec3(0.0));
  }
  return col;
}

vec3 shadeGlass(Hit h, vec3 dl, vec3 rd, float steps){
  if (h.kind > 1.5) return shadeSphere(h, dl, rd, steps);
  float focus = float(gBody) == uFocus ? 1.0 : 0.0;
  vec3 pl = h.p;
  vec3 nl = normalAt(pl);
  float r = length(pl.xz);
  float turn = fract(atan(pl.z, pl.x) / TAU - gGlass.z);
  vec3 radial = normalize(vec3(pl.x, 0.0, pl.z));
  nl = normalize(nl + radial * sin(r * 190.0) * 0.04 * (1.0 + 1.5 * uAudio.w * focus) / (1.0 + h.t * h.t * 0.05));
  vec3 n = toWorldDir(nl);
  float ndv = max(dot(nl, -dl), 0.0);
  float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
  float f = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
  vec3 body = bodyOf(ndv, r);
  vec3 sigma = sigmaOf(body) * mix(1.0, uPulse.z, focus);
  vec3 tint = mix(vec3(1.0), film(ndv + r * 0.6) * 1.7, min(uIrid + uPulse.w * focus, 0.9));
  vec3 refl = envAt(toWorldDir(reflect(dl, nl))) * f * tint;

  vec3 di = refract(dl, nl, 1.0 / uIor);
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
  vec3 dg = refract(di, ne, uIor);
  if (dot(dg, dg) < 1e-4) dg = reflect(di, ne);
  vec3 po = pe - ne * 0.02;
  vec3 wo = toWorld(po);

  vec3 back;
  Hit h2 = traceLocal(po, dg, steps * 0.6, 1.0);
  if (h2.kind > 1.5){
    back = shadeOrb(toWorldDir(h2.n), toWorldDir(dg), h2.kind);
  } else if (h2.kind > 0.5){
    vec3 n2 = normalAt(h2.p);
    float nv2 = max(dot(n2, -dg), 0.0);
    float f2 = f0 + (1.0 - f0) * pow(1.0 - nv2, 5.0);
    vec3 thru = normalize(mix(dg, refract(dg, n2, 1.0 / uIor), 0.6));
    float t2 = 2.0 * gBand.z / max(nv2, 0.35);
    vec3 body2 = bodyOf(nv2, length(h2.p.xz));
    back = farField(toWorld(h2.p), toWorldDir(thru)) * exp(-sigmaOf(body2) * t2) * (1.0 - f2)
         + envAt(toWorldDir(reflect(dg, n2))) * f2
         + body2 * (1.0 - exp(-t2 * 8.0)) * 0.2 * gGlass.w;
  } else if (uDetail > 0.75){
    float sp = 0.014 + 0.02 * uAudio.z;
    vec3 dr = refract(di, ne, uIor * (1.0 - sp));
    vec3 db = refract(di, ne, uIor * (1.0 + sp));
    if (dot(dr, dr) < 1e-4) dr = dg;
    if (dot(db, db) < 1e-4) db = dg;
    back = vec3(
      farField(wo, toWorldDir(dr)).r,
      farField(wo, toWorldDir(dg)).g,
      farField(wo, toWorldDir(db)).b);
  } else {
    back = farField(wo, toWorldDir(dg));
  }

  float wrap = max(dot(n, uKey) * 0.5 + 0.5, 0.0);
  float side = max(dot(n, uRim), 0.0);
  float keyLum = dot(uKeyCol, vec3(0.333));
  vec3 lc = vec3(gCore.x, 0.0, gCore.y) - pl;
  float nucleus = mix(0.15, uPulse.x, focus);
  float fromCore = max(dot(nl, normalize(lc)) * 0.5 + 0.5, 0.0) * nucleus * 0.22 / (0.35 + dot(lc, lc) * 2.0);
  vec3 glow = body * mix(vec3(1.0), uKeyCol / max(keyLum, 0.05), 0.3) * (1.0 - exp(-ti * 8.0))
            * (0.1 + 0.42 * wrap * wrap * keyLum + 0.3 * side + fromCore) * gGlass.w;
  vec3 col = back * tr * (1.0 - f) + refl + glow;
  if (focus > 0.5 && uPart.y > 0.01){
    vec4 pa;
    vec4 pb;
    float pr;
    float pt;
    profAt(pl, pa, pb, pr, pt);
    float hi = max(pa.y, max(pa.w, pb.y));
    float chan = min(min(bandD(pr, pa.x, pa.y), bandD(pr, pa.z, pa.w)), bandD(pr, pb.x, pb.y));
    float w = 0.0;
    if (abs(uPart.x - 2.0) < 0.5) w = exp(-pow(pb.z * TAU * pr / 0.04, 2.0));
    else if (abs(uPart.x - 3.0) < 0.5) w = 0.2 + smoothstep(-0.004, 0.006, chan);
    else if (abs(uPart.x - 4.0) < 0.5) w = exp(-pow((hi - pr) / 0.04, 2.0));
    else if (abs(uPart.x - 5.0) < 0.5) w = 0.5;
    float lit = step(1.5, uPart.x) * step(uPart.x, 4.5);
    col = col * mix(1.0, 0.32 + 0.9 * w, uPart.y) + (gInkA * 1.4 + 0.3) * w * lit * uPart.y * 0.8
        + body * 0.1 * uPart.y;
  }
  col += innerLight(r, turn) * (0.4 + 0.6 * tr);
  return col;
}

vec3 shadeLite(Hit h, vec3 dl, vec3 rd){
  if (h.kind > 1.5) return shadeOrb(toWorldDir(h.n), rd, h.kind);
  vec3 nl = normalAt(h.p);
  vec3 n = toWorldDir(nl);
  float ndv = max(dot(nl, -dl), 0.0);
  float f = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  float r = length(h.p.xz);
  vec3 body = bodyOf(ndv, r);
  vec3 through = normalize(rd - n * 0.18);
  through.y = abs(through.y);
  float wrap = max(dot(n, uKey) * 0.5 + 0.5, 0.0);
  vec3 col = envAt(toWorldDir(reflect(dl, nl))) * f;
  col += skyBase(through) * exp(-sigmaOf(body) * 0.1) * (1.0 - f);
  col += body * (0.12 + 0.3 * wrap * wrap) * gGlass.w;
  float turn = fract(atan(h.p.z, h.p.x) / TAU - gGlass.z);
  col += innerLight(r, turn) * 0.6;
  return col;
}

vec3 reflected(vec3 p, vec3 r){
  vec3 dl;
  Hit h = traceAll(p, r, uSteps * 0.6, 1.0, dl);
  float tt;
  float ta = textHit(p, r, tt) * uTextAt.z;
  vec3 c = h.kind > 0.5 ? shadeLite(h, dl, r) * uReflK : skyBase(r);
  if (ta > 0.0 && tt < h.t) c = mix(c, textColor(p, r, tt), ta);
  return c;
}

vec3 waterShade(vec3 p, vec3 rd, float dist){
  vec3 n = waterN(p.xz, dist);
  float f = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 r = reflect(rd, n);
  r.y = abs(r.y) + 0.001;
  return mix(waterBase(p), reflected(p, normalize(r)), f);
}

vec3 orbits(vec3 ro, vec3 rd, float limit){
  vec3 c = vec3(0.0);
  for (int b = 0; b < NB; b++){
    float alive = uBRot[b].w;
    if (alive < 0.01) continue;
    useBody(b);
    vec3 rl = toLocal(ro);
    vec3 dl = toLocalDir(rd);
    if (abs(dl.y) < 0.02) continue;
    float tp = -rl.y / dl.y;
    if (tp <= 0.0 || tp * gRad > limit) continue;
    vec3 q = rl + dl * tp;
    if ((ro + rd * tp * gRad).y < 0.0) continue;
    float r = length(q.xz);
    float w = 0.002 + tp * 0.0011;
    float line = 0.0;
    for (int i = 0; i < 4; i++){
      vec4 s = uBSat[b * 4 + i];
      if (s.z < 0.001) continue;
      float x = (r - s.w) / w;
      float near = 1.0 - smoothstep(0.0, 1.5, distance(q.xz, s.xy));
      line += exp(-x * x) * (0.1 + 0.9 * near * near);
    }
    float mine = float(b) == uFocus ? 1.0 : 0.0;
    float sat = mine * uPart.y * (abs(uPart.x - 1.0) < 0.5 ? 1.0 : 0.0);
    c += (gInkA * 1.2 + vec3(1.0, 0.82, 0.55) * 0.35) * line * (0.2 + 0.3 * sat) * alive * min(abs(dl.y) * 6.0, 1.0);
    if (mine > 0.5 && uPart.y > 0.01){
      vec3 ghost = vec3(0.95, 0.9, 0.8) * 0.6 * uPart.y;
      if (abs(uPart.x - 5.0) < 0.5 && abs(rd.z) > 0.01){
        float th = (gPos.z - ro.z) / rd.z;
        if (th > 0.0 && th < limit){
          vec3 ph = ro + rd * th - gPos;
          float xh = (length(ph.xy) / gRad - gBand.y + 0.05) / (0.006 + th * 0.0016);
          c += ghost * exp(-xh * xh) * step(0.5, fract(atan(ph.y, ph.x) / TAU * 36.0)) * step(-gPos.y, ph.y);
        }
      }
      if (uRef > gCore.z * 1.04){
        float xr = (r - uRef) / (w * 1.6);
        c += ghost * exp(-xr * xr) * step(0.5, fract(atan(q.z, q.x) / TAU * 40.0));
      }
    }
  }
  return c;
}

vec3 traceWorld(vec3 ro, vec3 rd, float core, float limit, out float mask, out float near){
  mask = 0.0;
  vec3 dl;
  Hit h = traceAll(ro, rd, uSteps, core, dl);
  float tb = h.kind > 0.5 ? h.t : 1e9;
  float tw = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;
  float tt;
  float ta = textHit(ro, rd, tt);
  near = min(tb, tw);
  if (ta > 0.5) near = min(near, tt);
  if (near > limit) return vec3(0.0);
  vec3 c;
  if (tb < tw){
    c = shadeGlass(h, dl, rd, uSteps);
  } else if (tw < 1e8){
    c = waterShade(ro + rd * tw, rd, tw);
  } else {
    c = sky(rd);
    mask = clamp(moonLobe(max(dot(rd, uMoon), 0.0)) * 0.8, 0.0, 3.0) * uGlow;
  }
  float tn = min(tb, tw);
  if (ta > 0.0 && tt < tn){
    c = mix(c, textColor(ro, rd, tt), ta);
    mask *= 1.0 - ta;
    tn = tt;
  }
  c += orbits(ro, rd, tn);
  return fogged(c, rd, min(tn, 70.0));
}

vec3 jetOf(vec3 ro, vec3 rd){
  if (uJet < 0.002) return vec3(0.0);
  useBody(int(uFocus));
  vec3 c = toWorld(vec3(gCore.x, 0.0, gCore.y));
  vec2 w = ro.xz - c.xz;
  vec2 dir = rd.xz;
  float len = dot(dir, dir);
  if (len < 1e-5) return vec3(0.0);
  float t = -dot(w, dir) / len;
  if (t <= 0.0) return vec3(0.0);
  float d = length(w + dir * t);
  float y = ro.y + rd.y * t - c.y;
  float reach = gCore.z * gRad;
  float fall = exp(-max(abs(y) - reach, 0.0) / (gRad * 0.6)) * step(reach * 0.9, abs(y));
  float wide = gRad * (0.007 + 0.014 * uJet);
  return mix(gInkA, vec3(1.0), 0.4) * exp(-d * d / (wide * wide)) * fall * uJet * 0.55 * step(0.0, ro.y + rd.y * t);
}

vec3 scene(vec3 ro, vec3 rd, out float mask){
  float near;
  for (int b = 0; b < NB; b++){
    if (uBRot[b].w < 0.01 || uBCore[b].w <= 0.0) continue;
    useBody(b);
    vec3 c = toWorld(vec3(gCore.x, 0.0, gCore.y));
    float tca = dot(c - ro, rd);
    if (tca <= 0.0) continue;
    vec3 pc = ro + rd * tca;
    vec3 tow = c - pc;
    float bb = length(tow);
    float rc = gCore.z * gRad;
    float q = rc / bb;
    float al = gCore.w * 6.0 * q * q * q * smoothstep(2.6, 1.15, bb / rc);
    if (al > 0.004 && bb > rc){
      vec3 first = traceWorld(ro, rd, 1.0, tca, mask, near);
      if (near <= tca) return first;
      vec3 second = traceWorld(pc, normalize(rd + (tow / bb) * al), 0.0, 1e9, mask, near);
      useBody(b);
      float ring = exp(-pow((bb - rc * 1.03) / (rc * 0.02), 2.0));
      return second + mix(uBInkA[b], vec3(1.0, 0.92, 0.8), 0.5) * ring * 0.1 * uBGlass[b].w;
    }
  }
  return traceWorld(ro, rd, 1.0, 1e9, mask, near);
}

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 rd = normalize(uCamRot * vec3(uv, uFocal));
  float mask;
  vec3 col = scene(uCamPos, rd, mask) + jetOf(uCamPos, rd);
  fragColor = vec4(min(col, vec3(48.0)), mask);
}
