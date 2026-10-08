export async function fetchFBProfiles(uids: { uid: string; password?: string }[]) {
  if (uids.length === 0) return { results: [] };

  // Passwords are intentionally never sent to the server. They remain local-only.
  const res = await fetch("/api/fb/uid/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uids: uids.map(({ uid }) => ({ uid })) }),
  });

  if (!res.ok) throw new Error(`API returned ${res.status}`);

  return res.json() as Promise<{
    results: {
      uid: string;
      result: {
        status: string;
        name?: string;
        username?: string;
        profile_pic?: string;
        follower_count?: number;
        has_instagram?: boolean;
      };
    }[];
  }>;
}
