precision highp float;
uniform sampler2D uBack, uFront;
uniform vec2 uRes;
uniform vec4 uM0, uM1;
uniform vec3 uCur;
uniform vec3 uWave;
uniform float uSpin, uBlur, uTime, uFade, uGrain, uDisp, uJet;
// Alcance do cursor: +1 sobre um alvo, -1 sobre o vazio que devolve uma escala.
// O anel fecha ou abre — mesma gramática da entrada de ingestão, sem palavra alguma.
uniform float uReach;
// Dureza do fio de luz rasante: brilho de timbre vira dureza de luz.
// Constante por álbum (centróide medido), perturbada de leve pelo trecho.
uniform float uRim;
// Direção da luz rasante. Varre um arco ao longo da faixa: a posição do
// playhead vira a hora do dia, e a duração vira a velocidade da varredura.
uniform vec2 uLight;
uniform vec3 uInk;
// Lobos do corpo: os harmônicos 2..4 do envelope do álbum viram a forma do
// horizonte. A macroforma do disco — como ele sobe e desce ao longo da
// duração — deixa de ser espessura de anel e passa a ser o contorno da massa.
// uLobeA = (a2,b2,a3,b3) · uLobeB = (a4,b4,amplitude,rotação)
uniform vec4 uLobeA;
uniform vec4 uLobeB;
// Achatamento do corpo. O núcleo e a coroa compartilham um ângulo de visada:
// sem isto, um disco escuro (coroa muito achatada) deixa o núcleo escapar por
// cima e por baixo, e o mundo se parte em dois objetos.
uniform float uFlat;
// Escala do mundo em unidades de tela. O campo é medido pelo eixo menor, mas o
// shader trabalha num espaço normalizado pela altura: num telefone o mesmo
// m0k desviava três vezes mais fração de largura que no desktop, e a tipografia
// saía da viewport. A lente passa a medir distância e desvio em unidades de
// mundo, e não em unidades de viewport.
uniform float uWorld;
// Contrato de camadas. A lente é um fenômeno do palco: acima do chão do palco
// ela deforma tudo, abaixo dele decai para um resíduo. É o que deixa a
// identidade, a lista e o transporte legíveis sem tirá-los do mundo — eles
// continuam recebendo interferência, só que leve. No desktop uGuard.z = 1 e
// esta função é a identidade.
// uGuard = (chão do palco em p.y · maciez · resíduo)
uniform vec3 uGuard;

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

  float core = max(coreOf(p, uM0, 1.0), coreOf(p, uM1, 0.0));
  col = mix(col, vec3(0.0), core);
  col += uInk * (rimOf(p, uM0, 1.0) + rimOf(p, uM1, 0.0)) * 1.15;

  if (uJet > 0.001){
    vec2 jd = (p - uM0.xy) / uWorld;
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
