const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").trim().replace(/\/+$/, "");

const isRemote = (p: string) => /^(https?:)?\/\//i.test(p);

const isAbsolute = (p: string) =>
  isRemote(p) || p.startsWith("data:") || p.startsWith("blob:");

export function mediaUrl(path: string): string {
  if (!path) return path;
  if (isAbsolute(path)) return path;
  const rel = path.startsWith("/") ? path : `/${path}`;
  return BASE ? `${BASE}${rel}` : rel;
}

export const needsCors = (url: string) => isAbsolute(url) && !url.startsWith("blob:");
