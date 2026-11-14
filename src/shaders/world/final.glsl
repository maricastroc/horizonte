precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform vec2 uOut;
uniform vec3 uRayCol;
uniform vec3 uInk;
uniform vec4 uCur;
uniform float uExposure;
uniform float uBloomAmt;
uniform float uTime;
uniform float uFade;
uniform float uGrain;
out vec4 fragColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.71, 289.13))) * 43758.5453); }

vec3 filmic(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uOut;
  vec2 c = uv - 0.5;
  float ca = dot(c, c) * 0.005;
  vec3 col = vec3(
    texture(uScene, uv + c * ca).r,
    texture(uScene, uv).g,
    texture(uScene, uv - c * ca).b);
  col += texture(uBloom, uv).rgb * uBloomAmt;
  col += uRayCol * texture(uRays, uv).r;
  col *= uExposure * (1.0 - dot(c, c) * 0.8) * uFade;
  col = pow(filmic(col), vec3(1.0 / 2.2));

  vec2 p = (uv - uCur.xy) * vec2(uOut.x / uOut.y, 1.0);
  float cd = length(p);
  vec3 tip = mix(uInk, vec3(1.0), 0.55);
  col += tip * exp(-cd * cd * 5200.0) * 0.6 * uCur.w;
  if (abs(uCur.z) > 0.004){
    float rad = 0.030 - 0.011 * uCur.z;
    float rq = (cd - rad) / 0.0026;
    col += tip * exp(-rq * rq) * (uCur.z > 0.0 ? uCur.z * 0.62 : -uCur.z * 0.3) * uCur.w;
  }

  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.3) - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}
