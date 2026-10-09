import { PROFILE_API_URL } from "./config";

export interface ProfileResult {
  status: string;
  name?: string | null;
  username?: string | null;
  profile_pic?: string | null;
  follower_count?: number | null;
  has_instagram?: boolean;
}

export async function fetchProfiles(uids: string[]) {
  const res = await fetch(PROFILE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uids: uids.map((uid) => ({ uid })) })
  });
  if (!res.ok) throw new Error("Profile API returned " + res.status);
  return (await res.json()) as {
    results: Array<{ uid: string; result: ProfileResult }>;
  };
}
