export interface ReleaseInfo {
  tag: string;
  url: string;
  name: string;
}

function parts(version: string) {
  return version.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
}

export function isNewerVersion(current: string, incoming: string) {
  const a = parts(current);
  const b = parts(incoming);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}

export async function checkLatestRelease(currentVersion: string): Promise<ReleaseInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch("https://api.github.com/repos/parvez-devs/oparetor2.O/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json() as { tag_name?: string; html_url?: string; name?: string };
    if (!data.tag_name || !data.html_url || !isNewerVersion(currentVersion, data.tag_name)) return null;
    return { tag: data.tag_name, url: data.html_url, name: data.name || data.tag_name };
  } finally {
    clearTimeout(timer);
  }
}
