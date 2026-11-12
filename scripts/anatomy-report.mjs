import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs", "anatomia-pt-en.md");

const PARTS = {
  satellites: "Pequenos corpos · satellites",
  gaps: "Fendas · gaps",
  strata: "Camadas · strata",
  contour: "Borda · contour",
  posture: "Postura · posture",
  core: "Centro escuro · core",
};

const server = await createServer({
  root: ROOT,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { "@": path.join(ROOT, "src") } },
  plugins: [
    {
      name: "horizonte-glsl",
      transform(code, id) {
        if (!id.endsWith(".glsl")) return null;
        return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
});

try {
  const load = (p) => server.ssrLoadModule(`/src/components/horizonte/${p}`);
  const { questionsOf } = await load("anatomy.ts");
  const { ALBUMS, CURATED_COUNT } = await load("content/index.ts");
  const { ANATOMY_EN } = await load("i18n/anatomy.en.ts");
  const { ANATOMY_PT } = await load("i18n/anatomy.pt-BR.ts");

  const lines = [
    "# Anatomia em português e inglês",
    "",
    "Gerado por `npm run anatomy:report` a partir de `src/components/horizonte/anatomy.ts` (a",
    "interpretação) e dos dois redatores em `src/components/horizonte/i18n/`. Não editar à mão:",
    "mudar a redação nos redatores e gerar de novo.",
    "",
    "Cada álbum lista as seis perguntas na ordem em que a interface as mostra (a primeira é o",
    "convite). Para cada uma: a pergunta, a resposta, o experimento da Contraprova (botão e",
    "rótulo do alternador) e o que a pessoa vê quando segura a imagem. Em itálico, o que fica",
    "em \"Em números\". Perguntas neutras, de discos perto da mediana, não têm experimento.",
    "",
  ];

  let current = null;
  const block = (tag, p, w) => {
    lines.push(`**${tag}**`, "", `- ${p.ask}`, `- ${p.answer}`);
    if (p.what) lines.push(`- ${p.what} · *${p.label}*`, `- ${p.result}`);
    const extra = [...w.details(current).map(([k, v]) => `${k}: ${v}`), w.depth(current)];
    for (const line of extra.filter(Boolean)) lines.push(`- *${line}*`);
    lines.push("");
  };

  for (let i = 0; i < CURATED_COUNT; i++) {
    const album = ALBUMS[i];
    lines.push(`## ${album.cat} · ${album.artist} — ${album.title}`, "");
    const questions = questionsOf(i);
    const core = questions.find((q) => q.part === "core").finding;
    lines.push(`> ${ANATOMY_PT.nameFact(core)}  `, `> ${ANATOMY_EN.nameFact(core)}`, "");
    questions.forEach((q, k) => {
      const f = q.finding;
      const facts = [
        f.near ? "perto da mediana" : f.high ? "acima da mediana" : "abaixo da mediana",
        f.strong ? "extremo" : null,
        f.top ? "1º da coleção" : f.bottom ? "último da coleção" : null,
        f.part === "satellites" ? `${f.bodies} → ${f.after} corpos, ${f.minutes} min` : null,
        f.part === "gaps" && f.open ? "anel aberto" : null,
        f.part === "strata" ? `batida ${f.beat}` : null,
      ].filter(Boolean);
      lines.push(`### ${k + 1}. ${PARTS[q.part]}`, "", `*${facts.join(" · ")}*`, "");
      current = q;
      block("PT", ANATOMY_PT.phrase(q), ANATOMY_PT);
      block("EN", ANATOMY_EN.phrase(q), ANATOMY_EN);
    });
  }

  await writeFile(OUT, lines.join("\n"));
  process.stdout.write(`${path.relative(ROOT, OUT)}\n`);
} finally {
  await server.close();
}
