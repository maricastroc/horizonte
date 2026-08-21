import type { TagData } from "./types";

const HEAD_BYTES = 1_048_576;

const ascii = (v: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...v.subarray(at, at + n));

async function head(file: File, bytes = HEAD_BYTES): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, Math.min(bytes, file.size)).arrayBuffer());
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) return new TextDecoder("latin1").decode(bytes).replace(/\0+$/, "");
    if (encoding === 1) return new TextDecoder("utf-16").decode(bytes).replace(/\0+$/, "");
    if (encoding === 2) return new TextDecoder("utf-16be").decode(bytes).replace(/\0+$/, "");
    return new TextDecoder("utf-8").decode(bytes).replace(/\0+$/, "");
  } catch {
    return "";
  }
}

const firstInt = (s: string) => {
  const m = /(\d+)/.exec(s);
  return m ? Number(m[1]) : 0;
};

const year4 = (s: string) => {
  const m = /(\d{4})/.exec(s);
  return m ? m[1] : "";
};

interface Atom {
  type: string;
  start: number;
  end: number;
}

function atomsIn(v: Uint8Array, from: number, to: number): Atom[] {
  const out: Atom[] = [];
  let at = from;
  while (at + 8 <= to) {
    const dv = new DataView(v.buffer, v.byteOffset + at, Math.min(8, to - at));
    let size = dv.getUint32(0);
    const type = ascii(v, at + 4, 4);
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > to) break;
      const hi = new DataView(v.buffer, v.byteOffset + at + 8, 8).getUint32(0);
      const lo = new DataView(v.buffer, v.byteOffset + at + 8, 8).getUint32(4);
      size = hi * 4294967296 + lo;
      body = at + 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < 8 || at + size > to) break;
    out.push({ type, start: body, end: at + size });
    at += size;
  }
  return out;
}

async function topAtoms(file: File): Promise<Atom[]> {
  const out: Atom[] = [];
  let at = 0;
  while (at + 8 <= file.size) {
    const hdr = new Uint8Array(await file.slice(at, at + 16).arrayBuffer());
    if (hdr.length < 8) break;
    const dv = new DataView(hdr.buffer, hdr.byteOffset, hdr.length);
    let size = dv.getUint32(0);
    const type = ascii(hdr, 4, 4);
    let body = at + 8;
    if (size === 1) {
      if (hdr.length < 16) break;
      size = dv.getUint32(8) * 4294967296 + dv.getUint32(12);
      body = at + 16;
    } else if (size === 0) {
      size = file.size - at;
    }
    if (size < 8 || at + size > file.size) break;
    out.push({ type, start: body, end: at + size });
    at += size;
  }
  return out;
}

function find(list: Atom[], type: string): Atom | undefined {
  return list.find((a) => a.type === type);
}

async function mp4Tags(file: File): Promise<TagData> {
  const top = await topAtoms(file);
  const moov = find(top, "moov");
  if (!moov) return {};
  const buf = new Uint8Array(await file.slice(moov.start, moov.end).arrayBuffer());
  const shift = moov.start;
  const rel = (a: Atom): Atom => ({ ...a, start: a.start - shift, end: a.end - shift });

  const moovKids = atomsIn(buf, 0, buf.length);
  const udta = find(moovKids, "udta");
  if (!udta) return {};
  const meta = find(atomsIn(buf, udta.start, udta.end), "meta");
  if (!meta) return {};
  const ilst = find(atomsIn(buf, meta.start + 4, meta.end), "ilst");
  if (!ilst) return {};
  void rel;

  const tags: TagData = {};
  for (const item of atomsIn(buf, ilst.start, ilst.end)) {
    const data = find(atomsIn(buf, item.start, item.end), "data");
    if (!data) continue;
    const flag = new DataView(buf.buffer, buf.byteOffset + data.start, 4).getUint32(0) & 0xffffff;
    const payload = buf.subarray(data.start + 8, data.end);
    const text = () => new TextDecoder("utf-8").decode(payload).replace(/\0+$/, "");
    switch (item.type) {
      case "©nam":
        tags.title = text();
        break;
      case "©ART":
        tags.artist = text();
        break;
      case "aART":
        tags.albumArtist = text();
        break;
      case "©alb":
        tags.album = text();
        break;
      case "©day":
        tags.year = year4(text());
        break;
      case "trkn":
        if (payload.length >= 4) tags.track = (payload[2] << 8) | payload[3];
        break;
      case "disk":
        if (payload.length >= 4) tags.disc = (payload[2] << 8) | payload[3];
        break;
      case "covr":
        if (payload.length > 16) {
          const mime = flag === 14 ? "image/png" : "image/jpeg";
          tags.artwork = new Blob([payload.slice()], { type: mime });
        }
        break;
    }
  }
  return tags;
}

function syncsafe(v: Uint8Array, at: number): number {
  return (v[at] << 21) | (v[at + 1] << 14) | (v[at + 2] << 7) | v[at + 3];
}

async function id3Tags(file: File): Promise<TagData> {
  const probe = await head(file, 16);
  if (probe.length < 10 || ascii(probe, 0, 3) !== "ID3") return {};
  const size = syncsafe(probe, 6) + 10;
  const v = await head(file, Math.min(size, file.size));
  const major = v[3];
  const tags: TagData = {};
  let at = 10;
  if (v[5] & 0x40 && at + 4 <= v.length) at += new DataView(v.buffer, v.byteOffset + at, 4).getUint32(0);

  while (at + 10 <= v.length) {
    const id = ascii(v, at, 4);
    if (id === "\0\0\0\0") break;
    const dv = new DataView(v.buffer, v.byteOffset + at + 4, 4);
    const len = major >= 4 ? syncsafe(v, at + 4) : dv.getUint32(0);
    if (len <= 0 || at + 10 + len > v.length) break;
    const body = v.subarray(at + 10, at + 10 + len);
    at += 10 + len;

    if (id === "APIC") {
      let p = 1;
      while (p < body.length && body[p] !== 0) p++;
      const mime = new TextDecoder("latin1").decode(body.subarray(1, p)) || "image/jpeg";
      p += 2;
      const enc = body[0];
      if (enc === 1 || enc === 2) {
        while (p + 1 < body.length && !(body[p] === 0 && body[p + 1] === 0)) p += 2;
        p += 2;
      } else {
        while (p < body.length && body[p] !== 0) p++;
        p += 1;
      }
      if (p < body.length) tags.artwork = new Blob([body.slice(p)], { type: mime });
      continue;
    }

    if (id[0] !== "T") continue;
    const text = decodeText(body.subarray(1), body[0]).split("\0")[0].trim();
    if (!text) continue;
    if (id === "TIT2") tags.title = text;
    else if (id === "TPE1") tags.artist = text;
    else if (id === "TPE2") tags.albumArtist = text;
    else if (id === "TALB") tags.album = text;
    else if (id === "TRCK") tags.track = firstInt(text);
    else if (id === "TPOS") tags.disc = firstInt(text);
    else if (id === "TYER" || id === "TDRC" || id === "TDRL") tags.year ||= year4(text);
  }
  return tags;
}

function applyVorbisComment(bytes: Uint8Array, tags: TagData) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  if (at + 4 > bytes.length) return;
  at += 4 + dv.getUint32(at, true);
  if (at + 4 > bytes.length) return;
  const count = dv.getUint32(at, true);
  at += 4;
  for (let i = 0; i < count && at + 4 <= bytes.length; i++) {
    const len = dv.getUint32(at, true);
    at += 4;
    if (at + len > bytes.length) break;
    const raw = new TextDecoder("utf-8").decode(bytes.subarray(at, at + len));
    at += len;
    const eq = raw.indexOf("=");
    if (eq < 0) continue;
    const key = raw.slice(0, eq).toUpperCase();
    const value = raw.slice(eq + 1).trim();
    if (!value) continue;
    if (key === "TITLE") tags.title ??= value;
    else if (key === "ARTIST") tags.artist ??= value;
    else if (key === "ALBUMARTIST") tags.albumArtist ??= value;
    else if (key === "ALBUM") tags.album ??= value;
    else if (key === "DATE" || key === "YEAR") tags.year ??= year4(value);
    else if (key === "TRACKNUMBER") tags.track ??= firstInt(value);
    else if (key === "DISCNUMBER") tags.disc ??= firstInt(value);
    else if (key === "METADATA_BLOCK_PICTURE" && !tags.artwork) {
      try {
        const bin = atob(value);
        const pic = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) pic[k] = bin.charCodeAt(k);
        const art = flacPicture(pic);
        if (art) tags.artwork = art;
      } catch {}
    }
  }
}

function flacPicture(block: Uint8Array): Blob | null {
  if (block.length < 32) return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  let at = 4;
  const mimeLen = dv.getUint32(at);
  at += 4;
  const mime = new TextDecoder("latin1").decode(block.subarray(at, at + mimeLen));
  at += mimeLen;
  const descLen = dv.getUint32(at);
  at += 4 + descLen + 16;
  if (at + 4 > block.length) return null;
  const dataLen = dv.getUint32(at);
  at += 4;
  if (at + dataLen > block.length) return null;
  return new Blob([block.slice(at, at + dataLen)], { type: mime || "image/jpeg" });
}

async function flacTags(file: File): Promise<TagData> {
  const v = await head(file, Math.min(file.size, 8 * HEAD_BYTES));
  if (ascii(v, 0, 4) !== "fLaC") return {};
  const tags: TagData = {};
  let at = 4;
  while (at + 4 <= v.length) {
    const last = (v[at] & 0x80) !== 0;
    const type = v[at] & 0x7f;
    const len = (v[at + 1] << 16) | (v[at + 2] << 8) | v[at + 3];
    const body = v.subarray(at + 4, at + 4 + len);
    if (body.length < len) break;
    if (type === 4) applyVorbisComment(body, tags);
    else if (type === 6 && !tags.artwork) {
      const art = flacPicture(body);
      if (art) tags.artwork = art;
    }
    at += 4 + len;
    if (last) break;
  }
  return tags;
}

function oggPackets(v: Uint8Array): Uint8Array[] {
  const packets: Uint8Array[] = [];
  let pending: Uint8Array[] = [];
  let at = 0;
  while (at + 27 <= v.length && ascii(v, at, 4) === "OggS") {
    const segCount = v[at + 26];
    const table = at + 27;
    if (table + segCount > v.length) break;
    let body = table + segCount;
    for (let i = 0; i < segCount; i++) {
      const len = v[table + i];
      if (body + len > v.length) return packets;
      pending.push(v.subarray(body, body + len));
      body += len;
      if (len !== 255) {
        let n = 0;
        for (const p of pending) n += p.length;
        const packet = new Uint8Array(n);
        let o = 0;
        for (const p of pending) {
          packet.set(p, o);
          o += p.length;
        }
        packets.push(packet);
        pending = [];
        if (packets.length >= 3) return packets;
      }
    }
    at = body;
  }
  return packets;
}

async function oggTags(file: File): Promise<TagData> {
  const v = await head(file, Math.min(file.size, 4 * HEAD_BYTES));
  if (ascii(v, 0, 4) !== "OggS") return {};
  const tags: TagData = {};
  for (const packet of oggPackets(v)) {
    if (packet.length > 7 && packet[0] === 3 && ascii(packet, 1, 6) === "vorbis") {
      applyVorbisComment(packet.subarray(7), tags);
    } else if (packet.length > 8 && ascii(packet, 0, 8) === "OpusTags") {
      applyVorbisComment(packet.subarray(8), tags);
    }
  }
  return tags;
}

export async function readTags(file: File): Promise<TagData> {
  try {
    const probe = await head(file, 16);
    if (probe.length >= 4 && ascii(probe, 0, 4) === "fLaC") return await flacTags(file);
    if (probe.length >= 4 && ascii(probe, 0, 4) === "OggS") return await oggTags(file);
    if (probe.length >= 3 && ascii(probe, 0, 3) === "ID3") return await id3Tags(file);
    if (probe.length >= 8 && ascii(probe, 4, 4) === "ftyp") return await mp4Tags(file);
    return {};
  } catch {
    return {};
  }
}
