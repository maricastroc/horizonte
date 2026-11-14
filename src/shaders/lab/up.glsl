precision highp float;
uniform sampler2D uSrc;
uniform sampler2D uAdd;
uniform vec2 uOut;
uniform vec2 uTexel;
uniform float uSpread;
out vec4 fragColor;

void main(){
  vec2 uv = gl_FragCoord.xy / uOut;
  vec2 t = uTexel;
  vec3 c = texture(uSrc, uv).rgb * 4.0;
  c += (texture(uSrc, uv + vec2(t.x, 0.0)).rgb + texture(uSrc, uv - vec2(t.x, 0.0)).rgb
      + texture(uSrc, uv + vec2(0.0, t.y)).rgb + texture(uSrc, uv - vec2(0.0, t.y)).rgb) * 2.0;
  c += texture(uSrc, uv + t).rgb + texture(uSrc, uv - t).rgb
     + texture(uSrc, uv + vec2(t.x, -t.y)).rgb + texture(uSrc, uv + vec2(-t.x, t.y)).rgb;
  fragColor = vec4(c / 16.0 * uSpread + texture(uAdd, uv).rgb, 1.0);
}
