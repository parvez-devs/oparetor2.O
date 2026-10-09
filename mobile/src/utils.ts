export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 3) | 8;
    return v.toString(16);
  });
}

export function formatCount(value?: number) {
  if (value === undefined) return "";
  if (value >= 1000000) return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(value >= 100000 ? 0 : 1) + "K";
  return String(value);
}

export function decodeHtml(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function cleanUsername(value?: string | null): string | undefined {
  const normalized = decodeHtml(value).trim().replace(/^@+/, "");
  if (!normalized) return undefined;
  return normalized.split(/[\s/]/)[0] || undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cleanProfileName(
  value?: string | null,
  username?: string | null
): string | undefined {
  let name = decodeHtml(value)
    .replace(/\s*[•|·-]\s*Facebook.*$/i, "")
    .replace(/\s+Facebook\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const user = cleanUsername(username);
  if (user) {
    const escaped = escapeRegExp(user);
    name = name
      .replace(new RegExp("\\s*\\(@?" + escaped + "\\)\\s*", "ig"), " ")
      .replace(new RegExp("\\s*\\[?@?" + escaped + "\\]?\\s*$", "ig"), "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return name || undefined;
}

export function normalizeProfileFields(
  name?: string | null,
  username?: string | null
) {
  const cleanUser = cleanUsername(username);
  return {
    name: cleanProfileName(name, cleanUser),
    username: cleanUser
  };
}
