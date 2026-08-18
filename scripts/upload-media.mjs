import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { list, put } from "@vercel/blob";

const ROOT = path.resolve(import.meta.dirname, "..");
const MUSIC = path.join(ROOT, "public", "music");
const PREFIX = "music";
const CACHE_MAX_AGE = 60 * 60 * 24 * 365;

const CONTENT_TYPE = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const FORCE = args.has("--force");
const CHECK_ONLY = args.has("--check");

const mb = (n) => `${(n / 1048576).toFixed(1)} MiB`;

function die(msg) {
  console.error(`\nERRO: ${msg}\n`);
  process.exit(1);
}

async function collect() {
  if (!existsSync(MUSIC)) die(`não encontrei ${path.relative(ROOT, MUSIC)}`);
  const out = [];
  for (const album of (await readdir(MUSIC, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    const dir = path.join(MUSIC, album);
    for (const file of (await readdir(dir)).sort()) {
      const ext = path.extname(file).toLowerCase();
      if (!CONTENT_TYPE[ext]) continue;
      const abs = path.join(dir, file);
      out.push({
        abs,
        album,
        pathname: `${PREFIX}/${album}/${file}`,
        contentType: CONTENT_TYPE[ext],
        size: (await stat(abs)).size,
      });
    }
  }
  return out;
}

async function remoteIndex(token) {
  const index = new Map();
  let cursor;
  do {
    const page = await list({ prefix: `${PREFIX}/`, cursor, limit: 1000, token });
    for (const b of page.blobs) index.set(b.pathname, b);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return index;
}

async function probe(url) {
  const res = await fetch(url, { headers: { Range: "bytes=0-99" } });
  const cors = res.headers.get("access-control-allow-origin");
  return {
    status: res.status,
    range: res.status === 206,
    acceptRanges: res.headers.get("accept-ranges"),
    cors,
    cacheControl: res.headers.get("cache-control"),
    contentType: res.headers.get("content-type"),
  };
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !DRY) {
    die(
      "BLOB_READ_WRITE_TOKEN não está definido.\n" +
        "       Crie um Blob store em vercel.com → Storage → Blob e rode:\n" +
        "         vercel env pull .env.local     (ou exporte a variável no shell)",
    );
  }

  const files = await collect();
  if (!files.length) die(`nenhum arquivo de mídia em ${path.relative(ROOT, MUSIC)}`);

  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  const albums = [...new Set(files.map((f) => f.album))];
  console.log(`${files.length} arquivos · ${albums.length} álbuns · ${mb(totalBytes)}\n`);

  const remote = DRY ? new Map() : await remoteIndex(token);

  if (CHECK_ONLY) {
    let faltando = 0;
    for (const f of files) if (!remote.has(f.pathname)) faltando++;
    console.log(`${remote.size} objetos no storage · ${faltando} faltando localmente`);
    const sample = files.find((f) => remote.has(f.pathname));
    if (sample) {
      const info = await probe(remote.get(sample.pathname).url);
      console.log(`\nsonda em ${sample.pathname}`);
      console.log(`  Range 206:      ${info.range ? "sim" : `NÃO (${info.status})`}`);
      console.log(`  accept-ranges:  ${info.acceptRanges ?? "—"}`);
      console.log(`  CORS:           ${info.cors ?? "AUSENTE — análise de áudio vai falhar"}`);
      console.log(`  cache-control:  ${info.cacheControl ?? "—"}`);
      console.log(`  content-type:   ${info.contentType ?? "—"}`);
    }
    return;
  }

  let enviados = 0;
  let pulados = 0;
  let bytes = 0;
  let base = "";

  for (const f of files) {
    const existente = remote.get(f.pathname);
    if (!FORCE && existente && existente.size === f.size) {
      pulados++;
      if (!base) base = new URL(existente.url).origin;
      continue;
    }
    if (DRY) {
      console.log(`  enviaria  ${f.pathname}  ${mb(f.size)}`);
      enviados++;
      bytes += f.size;
      continue;
    }
    const body = await readFile(f.abs);
    const blob = await put(f.pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: f.contentType,
      cacheControlMaxAge: CACHE_MAX_AGE,
      token,
    });
    if (!base) base = new URL(blob.url).origin;
    enviados++;
    bytes += f.size;
    console.log(`  ✓ ${f.pathname}  ${mb(f.size)}`);
  }

  console.log(`\n${enviados} enviados (${mb(bytes)}) · ${pulados} já estavam lá`);

  if (DRY) {
    console.log("\n--dry-run: nada foi enviado.");
    return;
  }

  if (base) {
    console.log(`\nDefina esta variável de ambiente (local e na Vercel):`);
    console.log(`\n  NEXT_PUBLIC_MEDIA_BASE_URL=${base}\n`);
    const amostra = files[0];
    const info = await probe(`${base}/${amostra.pathname}`);
    console.log(`sonda em ${amostra.pathname}`);
    console.log(`  Range 206:      ${info.range ? "sim" : `NÃO (${info.status})`}`);
    console.log(`  accept-ranges:  ${info.acceptRanges ?? "—"}`);
    console.log(`  CORS:           ${info.cors ?? "AUSENTE — análise de áudio vai falhar"}`);
    console.log(`  cache-control:  ${info.cacheControl ?? "—"}`);
    if (!info.range || !info.cors) {
      die("o storage não atendeu Range e/ou CORS — não remova public/music ainda.");
    }
  }
}

main().catch((e) => die(e?.message ?? String(e)));
