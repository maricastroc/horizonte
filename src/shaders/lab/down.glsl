precision highp float;
uniform sampler2D uSrc;
uniform vec2 uOut;
uniform vec2 uTexel;
uniform float uKnee;
out vec4 fragColor;

void main(){
  vec2 uv = gl_FragCoord.xy / uOut;
  vec3 c = texture(uSrc, uv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture(uSrc, uv + uTexel * vec2(1.0, -1.0)).rgb
         + texture(uSrc, uv + uTexel * vec2(-1.0, 1.0)).rgb
         + texture(uSrc, uv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  if (uKnee > 0.0){
    float l = max(c.r, max(c.g, c.b));
    c = c * (max(l - uKnee, 0.0) / max(l, 1e-4)) + c * 0.035;
    c = min(c, vec3(24.0));
  }
  fragColor = vec4(c, 1.0);
}
