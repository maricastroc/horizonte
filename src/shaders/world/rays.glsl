precision highp float;
uniform sampler2D uSrc;
uniform vec2 uOut;
uniform vec3 uLightUv;
out vec4 fragColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.71, 289.13))) * 43758.5453); }

void main(){
  vec2 uv = gl_FragCoord.xy / uOut;
  vec2 stepv = (uLightUv.xy - uv) * 0.92 / 30.0;
  vec2 p = uv + stepv * hash(gl_FragCoord.xy);
  float acc = 0.0;
  float w = 1.0;
  for (int i = 0; i < 30; i++){
    acc += texture(uSrc, p).a * w;
    w *= 0.95;
    p += stepv;
  }
  fragColor = vec4(acc / 30.0 * uLightUv.z);
}
