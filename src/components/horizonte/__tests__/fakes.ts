type Ouvinte = (e: unknown) => void;

export interface JanelaFalsa {
  dispatch(tipo: string, evento?: Record<string, unknown>): void;
  mudarMovimento(matches: boolean): void;
  registrados(): number;
  restaurar(): void;
}

export function janelaFalsa({
  innerWidth = 1000,
  innerHeight = 800,
  reduced = false,
  coarse = false,
}: { innerWidth?: number; innerHeight?: number; reduced?: boolean; coarse?: boolean } = {}) {
  const porTipo = new Map<string, Set<Ouvinte>>();
  const movimento = new Set<Ouvinte>();

  const win = {
    innerWidth,
    innerHeight,
    addEventListener(tipo: string, fn: Ouvinte) {
      const s = porTipo.get(tipo) ?? new Set();
      s.add(fn);
      porTipo.set(tipo, s);
    },
    removeEventListener(tipo: string, fn: Ouvinte) {
      porTipo.get(tipo)?.delete(fn);
    },
    matchMedia(consulta: string) {
      return {
        matches: consulta.includes("reduced-motion") ? reduced : coarse,
        addEventListener: (_t: string, fn: Ouvinte) => movimento.add(fn),
        removeEventListener: (_t: string, fn: Ouvinte) => movimento.delete(fn),
      };
    },
  };

  const anterior = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = win;

  const janela: JanelaFalsa = {
    dispatch(tipo, evento = {}) {
      const e = { preventDefault: () => {}, target: null, ...evento };
      for (const fn of porTipo.get(tipo) ?? []) fn(e);
    },
    mudarMovimento(matches) {
      for (const fn of movimento) fn({ matches });
    },
    registrados() {
      let n = 0;
      for (const s of porTipo.values()) n += s.size;
      return n + movimento.size;
    },
    restaurar() {
      (globalThis as { window?: unknown }).window = anterior;
    },
  };
  return janela;
}

export interface Chamada {
  nome: string;
  args: unknown[];
}

export function gravador() {
  const chamadas: Chamada[] = [];
  const nomes = [
    "markIntent", "resize", "setReducedMotion", "pointTo", "teleportTo",
    "beginPan", "panBy", "endPan", "wheelBy", "primary", "back", "stepFocus",
  ] as const;

  const acoes = Object.fromEntries(
    nomes.map((n) => [n, (...args: unknown[]) => chamadas.push({ nome: n, args })]),
  ) as unknown as Record<(typeof nomes)[number], (...a: unknown[]) => void>;

  return {
    acoes,
    chamadas,
    nomesChamados: () => chamadas.map((c) => c.nome),
    ultima: (nome: string) => [...chamadas].reverse().find((c) => c.nome === nome),
    contar: (nome: string) => chamadas.filter((c) => c.nome === nome).length,
    limpar: () => chamadas.splice(0, chamadas.length),
  };
}

export interface AnalisadorFalso {
  fftSize: number;
  smoothingTimeConstant: number;
  readonly frequencyBinCount: number;
  getByteFrequencyData(alvo: Uint8Array): void;
  getByteTimeDomainData(alvo: Uint8Array): void;
  connect(): void;
  espectro: Uint8Array;
  onda: Uint8Array;
}

export function contextoFalso(sampleRate = 44100) {
  const analisador: AnalisadorFalso = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    get frequencyBinCount() {
      return analisador.fftSize / 2;
    },
    espectro: new Uint8Array(512),
    onda: new Uint8Array(1024),
    getByteFrequencyData(alvo) {
      alvo.set(analisador.espectro.subarray(0, alvo.length));
    },
    getByteTimeDomainData(alvo) {
      alvo.set(analisador.onda.subarray(0, alvo.length));
    },
    connect() {},
  };
  const ctx = {
    sampleRate,
    createAnalyser: () => analisador,
    destination: {},
  };
  return { ctx: ctx as unknown as AudioContext, analisador };
}

export function faixaSenoidal(amplitude: number, tamanho = 1024): Uint8Array {
  const onda = new Uint8Array(tamanho);
  for (let i = 0; i < tamanho; i++) {
    onda[i] = Math.round(128 + Math.sin((i / tamanho) * Math.PI * 2 * 8) * 127 * amplitude);
  }
  return onda;
}

export interface AudioFalso {
  preload: string;
  crossOrigin: string | null;
  src: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  falharAoTocar: boolean;
  carregou: number;
  addEventListener(tipo: string, fn: () => void): void;
  removeAttribute(nome: string): void;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  emitir(tipo: string): void;
}

export function ambienteDeAudio() {
  const criados: AudioFalso[] = [];
  const conexoes: { origem: AudioFalso; destino: unknown }[] = [];

  function novoAudio(): AudioFalso {
    const ouvintes = new Map<string, Set<() => void>>();
    const el: AudioFalso = {
      preload: "",
      crossOrigin: null,
      src: "",
      currentTime: 0,
      duration: NaN,
      paused: true,
      falharAoTocar: false,
      carregou: 0,
      addEventListener(tipo, fn) {
        const s = ouvintes.get(tipo) ?? new Set();
        s.add(fn);
        ouvintes.set(tipo, s);
      },
      removeAttribute(nome) {
        if (nome === "crossorigin") el.crossOrigin = null;
        if (nome === "src") el.src = "";
      },
      async play() {
        if (el.falharAoTocar) throw new Error("bloqueado");
        el.paused = false;
      },
      pause() {
        el.paused = true;
      },
      load() {
        el.carregou++;
      },
      emitir(tipo) {
        for (const fn of ouvintes.get(tipo) ?? []) fn();
      },
    };
    criados.push(el);
    return el;
  }

  const analisador = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    get frequencyBinCount() {
      return analisador.fftSize / 2;
    },
    getByteFrequencyData(a: Uint8Array) {
      a.fill(0);
    },
    getByteTimeDomainData(a: Uint8Array) {
      a.fill(128);
    },
    connect() {},
  };

  let fechados = 0;
  class ContextoFalso {
    sampleRate = 44100;
    state = "running";
    destination = { nome: "saida" };
    createAnalyser() {
      return analisador;
    }
    createMediaElementSource(el: AudioFalso) {
      return {
        connect: (destino: unknown) => conexoes.push({ origem: el, destino }),
        disconnect: () => {},
      };
    }
    resume() {}
    close() {
      fechados++;
    }
  }

  const anteriorWindow = (globalThis as Record<string, unknown>).window;
  const anteriorAudio = (globalThis as Record<string, unknown>).Audio;
  (globalThis as Record<string, unknown>).window = { AudioContext: ContextoFalso };
  (globalThis as Record<string, unknown>).Audio = novoAudio;

  return {
    criados,
    conexoes,
    analisador,
    contextosFechados: () => fechados,
    restaurar() {
      (globalThis as Record<string, unknown>).window = anteriorWindow;
      (globalThis as Record<string, unknown>).Audio = anteriorAudio;
    },
  };
}

export interface ContextoDePintura {
  chamadas: string[];
  props: Record<string, unknown>;
  fontes: string[];
  larguraDeTexto: number;
  ctx: CanvasRenderingContext2D;
}

export function contextoDePintura(larguraDeTexto = 10): ContextoDePintura {
  const registro: ContextoDePintura = {
    chamadas: [],
    props: {},
    fontes: [],
    larguraDeTexto,
    ctx: null as unknown as CanvasRenderingContext2D,
  };

  const gradiente = { addColorStop: () => {} };

  const alvo: Record<string, unknown> = {
    createRadialGradient: () => gradiente,
    createLinearGradient: () => gradiente,
    measureText: () => ({ width: registro.larguraDeTexto }),
    getImageData: () => ({ data: new Uint8ClampedArray(48 * 48 * 4) }),
  };

  registro.ctx = new Proxy(alvo, {
    get(base, chave: string) {
      if (chave in base) {
        const v = base[chave];
        if (typeof v === "function") {
          return (...args: unknown[]) => {
            registro.chamadas.push(chave);
            return (v as (...a: unknown[]) => unknown)(...args);
          };
        }
        return v;
      }
      if (chave in registro.props) return registro.props[chave];
      return (...args: unknown[]) => {
        registro.chamadas.push(chave);
        void args;
      };
    },
    set(_base, chave: string, valor) {
      registro.props[chave] = valor;
      if (chave === "font") registro.fontes.push(String(valor));
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return registro;
}

function telaFalsa() {
  const pintura = contextoDePintura();
  return {
    width: 0,
    height: 0,
    getContext: () => pintura.ctx,
  };
}

export interface AmbienteDoMotor {
  disparar(tipo: string, evento?: Record<string, unknown>): void;
  mudarMovimento(matches: boolean): void;
  avancar(ms?: number): void;
  quadros(): number;
  agora(): number;
  redimensionar(w: number, h: number): void;
  imagens: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[];
  audios: AudioFalso[];
  restaurar(): void;
}

export function ambienteDoMotor({
  innerWidth = 1280,
  innerHeight = 800,
  reduced = false,
}: { innerWidth?: number; innerHeight?: number; reduced?: boolean } = {}): AmbienteDoMotor {
  const anterior: Record<string, unknown> = {};
  const g = globalThis as Record<string, unknown>;
  for (const k of ["document", "window", "Image", "Audio", "requestAnimationFrame", "cancelAnimationFrame"]) {
    anterior[k] = g[k];
  }

  const imagens: AmbienteDoMotor["imagens"] = [];
  const audios: AudioFalso[] = [];
  const audio = ambienteDeAudio();
  const janelaAudio = (globalThis as { window?: { AudioContext?: unknown } }).window;

  let pendente: ((t: number) => void) | null = null;
  let proximoId = 1;
  let t = 10_000;
  let contados = 0;

  const escutas = new Map<string, Set<(e: unknown) => void>>();
  const movimento = new Set<(e: unknown) => void>();

  const janela = {
    innerWidth,
    innerHeight,
    devicePixelRatio: 1,
    AudioContext: janelaAudio?.AudioContext,
    matchMedia: (consulta: string) => ({
      matches: consulta.includes("reduced-motion") ? reduced : false,
      media: consulta,
      addEventListener: (_t: string, fn: (e: unknown) => void) => movimento.add(fn),
      removeEventListener: (_t: string, fn: (e: unknown) => void) => movimento.delete(fn),
    }),
    addEventListener(tipo: string, fn: (e: unknown) => void) {
      const s = escutas.get(tipo) ?? new Set();
      s.add(fn);
      escutas.set(tipo, s);
    },
    removeEventListener(tipo: string, fn: (e: unknown) => void) {
      escutas.get(tipo)?.delete(fn);
    },
  };

  g.document = {
    visibilityState: "visible",
    createElement: (tag: string) => (tag === "canvas" ? telaFalsa() : {}),
  };
  g.window = janela;
  g.Image = function Imagem(this: Record<string, unknown>) {
    const img = { src: "", decoding: "", crossOrigin: "", onload: null, onerror: null };
    imagens.push(img as AmbienteDoMotor["imagens"][number]);
    return img;
  };
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    pendente = cb;
    return proximoId++;
  };
  g.cancelAnimationFrame = () => {
    pendente = null;
  };

  return {
    disparar(tipo, evento = {}) {
      const e = { preventDefault: () => {}, target: null, ...evento };
      for (const fn of escutas.get(tipo) ?? []) fn(e);
    },
    mudarMovimento(matches) {
      for (const fn of movimento) fn({ matches });
    },
    avancar(ms = 16) {
      t += ms;
      contados++;
      const cb = pendente;
      pendente = null;
      cb?.(t);
    },
    quadros: () => contados,
    agora: () => t,
    redimensionar(w, h) {
      janela.innerWidth = w;
      janela.innerHeight = h;
    },
    imagens,
    audios,
    restaurar() {
      audio.restaurar();
      for (const [k, v] of Object.entries(anterior)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
    },
  };
}
