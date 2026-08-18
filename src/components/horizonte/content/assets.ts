const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const usingRemoteMedia = BASE.length > 0;

const isAbsolute = (p: string) => /^(https?:)?\/\//i.test(p) || p.startsWith("data:");

export function mediaUrl(path: string): string {
  if (!path) return path;
  if (isAbsolute(path)) return path;
  const rel = path.startsWith("/") ? path : `/${path}`;
  return BASE ? `${BASE}${rel}` : rel;
}

export const needsCors = (url: string) => isAbsolute(url);
