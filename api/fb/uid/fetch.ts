const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const SAMSUNG_UA =
  "Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/10.1 Chrome/71.0.3578.99 Mobile Safari/537.36";

const BAD_TITLES = new Set([
  "facebook",
  "error",
  "log in to facebook",
  "log in",
  "log into facebook",
  "login",
  "sign up",
  "create an account",
  "",
]);
const BAD_SLUGS = new Set(["profile.php", "home.php", "login", "sharer", ""]);

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attr(html: string, property: string, attrName = "content"): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+${attrName}=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+${attrName}=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return "";
}

function canonical(html: string): string {
  const re = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i;
  const re2 = /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*>/i;
  return decodeHtml((html.match(re)?.[1] || html.match(re2)?.[1] || "").trim());
}

function title(html: string): string {
  return decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim());
}

function parseCount(text: string): number | null {
  const m = text.match(/([\d,.]+)\s*([KMBkmb])?\s*(?:likes?|followers?|people follow)/i);
  if (!m) return null;
  const raw = Number.parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(raw)) return null;
  const suffix = (m[2] || "").toLowerCase();
  const factor = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return Math.round(raw * factor);
}

function parseCookies(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const i = pair.indexOf("=");
    if (i <= 0) continue;
    out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchHtml(url: string, headers: Record<string, string>, cookies?: Record<string, string>): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9_000);
  try {
    const h = new Headers(headers);
    if (cookies && Object.keys(cookies).length) h.set("cookie", cookieHeader(cookies));
    const res = await fetch(url, { headers: h, redirect: "follow", signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Result = {
  status: "success" | "error";
  name: string | null;
  username: string | null;
  profile_pic: string | null;
  follower_count: number | null;
  has_instagram: boolean;
};

async function getOne(uid: string, cookies: Record<string, string>): Promise<Result> {
  const publicHtmlPromise = fetchHtml(`https://m.facebook.com/profile.php?id=${encodeURIComponent(uid)}`, {
    "user-agent": IPHONE_UA,
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  });
  const basicHtmlPromise = Object.keys(cookies).length
    ? fetchHtml(`https://mbasic.facebook.com/profile.php?id=${encodeURIComponent(uid)}`, {
        "user-agent": SAMSUNG_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      }, cookies)
    : Promise.resolve(null);

  const [publicHtml, basicHtml] = await Promise.all([publicHtmlPromise, basicHtmlPromise]);
  let name: string | null = null;
  let username: string | null = null;
  let profilePic: string | null = null;
  let followerCount: number | null = null;

  if (publicHtml) {
    const rawTitle = title(publicHtml).replace(/\s*\|\s*Facebook\s*$/i, "").trim();
    const ogTitle = attr(publicHtml, "og:title");
    const candidate = !BAD_TITLES.has(rawTitle.toLowerCase()) ? rawTitle : ogTitle;
    if (candidate && !BAD_TITLES.has(candidate.toLowerCase())) name = candidate;

    const image = attr(publicHtml, "og:image");
    if (/fbcdn\.net|scontent/i.test(image)) profilePic = image;

    const description = attr(publicHtml, "og:description");
    followerCount = parseCount(description);

    for (const src of [attr(publicHtml, "og:url"), canonical(publicHtml)]) {
      const m = src.match(/facebook\.com\/([^/?#]+)/i);
      if (m?.[1] && !BAD_SLUGS.has(m[1])) {
        username = m[1];
        break;
      }
    }
  }

  if (basicHtml) {
    const rawTitle = title(basicHtml).trim();
    if (!name && rawTitle && !BAD_TITLES.has(rawTitle.toLowerCase())) name = rawTitle;
    const image = attr(basicHtml, "og:image");
    if (!profilePic && /fbcdn\.net|scontent/i.test(image)) profilePic = image;
    const count = parseCount(attr(basicHtml, "og:description"));
    if (count != null) followerCount = count;
  }

  return {
    status: name || profilePic ? "success" : "error",
    name,
    username,
    profile_pic: profilePic,
    follower_count: followerCount,
    has_instagram: Boolean(username),
  };
}

async function pool<T>(items: string[], limit: number, work: (item: string) => Promise<T>): Promise<T[]> {
  const result = new Array<T>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      result[i] = await work(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return result;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { uids?: Array<{ uid?: unknown }>; cookie?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.uids)) {
    return Response.json({ success: false, error: "Missing uids list" }, { status: 400 });
  }

  const clean = body.uids
    .map((item) => String(item?.uid ?? "").trim())
    .filter(Boolean)
    .slice(0, 60);

  if (!clean.length) return Response.json({ success: true, results: [], total: 0, timestamp: new Date().toISOString() });

  const cookieRaw = String(body.cookie || process.env.FB_DEFAULT_COOKIE || "");
  const cookies = parseCookies(cookieRaw);
  const values = await pool(clean, 8, async (uid) => ({ uid, result: await getOne(uid, cookies) }));

  return Response.json({ success: true, results: values, total: values.length, timestamp: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export function GET() {
  return Response.json({ status: "ok", endpoint: "uid-fetch" });
}
