precision highp float;
uniform sampler2D uBack, uFront;
uniform vec2 uRes;
uniform vec4 uM0, uM1;
uniform vec3 uCur;
uniform vec3 uWave;
uniform float uSpin, uBlur, uTime, uFade, uGrain, uDisp, uJet;
// Dureza do fio de luz rasante: brilho de timbre vira dureza de luz.
// Constante por álbum (centróide medido), perturbada de leve pelo trecho.
uniform float uRim;
uniform vec3 uInk;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.71, 289.13))) * 43758.5453); }

vec2 pullOf(vec2 p, vec4 m, float spin){
  vec2 d = p - m.xy;
  float r = max(length(d), 1e-4);
  float k = min(m.z / (r * r + 0.014), 0.85);
  vec2 dir = d / r;
  vec2 tang = vec2(-dir.y, dir.x);
  return -dir * k * 0.13 + tang * k * spin * 0.13;
}

float coreOf(vec2 p, vec4 m){
  if (m.w <= 0.0) return 0.0;
  float r = length(p - m.xy);
  return smoothstep(m.w, m.w * 0.87, r);
}

float rimOf(vec2 p, vec4 m){
  if (m.w <= 0.0) return 0.0;
  vec2 d = p - m.xy;
  float r = length(d);
  float band = exp(-pow((r - m.w * 1.01) / (m.w * 0.028), 2.0));
  float g = max(0.0, dot(normalize(d), normalize(vec2(-0.70, 0.71))));
  return band * pow(g, uRim) * 1.25;
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

  vec2 dw = p - uM0.xy;
  float rw = length(dw);
  float dr = rw - uWave.x;
  off += normalize(dw + 1e-5) * uWave.y * exp(-dr * dr * 42.0);

  vec2 offUv = off / vec2(aspect, 1.0);
  vec3 col = samp(uBack, uv, offUv, uBlur);

  float core = max(coreOf(p, uM0), coreOf(p, uM1));
  col = mix(col, vec3(0.0), core);
  col += uInk * (rimOf(p, uM0) + rimOf(p, uM1)) * 1.15;

  if (uJet > 0.001){
    vec2 jd = p - uM0.xy;
    float axis = abs(jd.x * 0.62 + jd.y * 0.78);
    float along = clamp(1.0 - abs(jd.x * 0.78 - jd.y * 0.62) * 0.7, 0.0, 1.0);
    col += uInk * exp(-axis * axis * 900.0) * along * uJet * 2.4;
  }

  vec2 fOff = offUv * 0.34;
  vec3 fCol = samp(uFront, uv, fOff, uBlur * 0.6);
  float fA = texture2D(uFront, uv + fOff).a;
  col = mix(col, fCol, clamp(fA * 1.6, 0.0, 1.0));

  float cd = length(p - uCur.xy);
  col += uInk * exp(-cd * cd * 5200.0) * 0.55;

  col *= uFade;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.3) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
