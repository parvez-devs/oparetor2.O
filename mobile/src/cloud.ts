import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { refreshSession, saveSession } from "./auth";
import { DEFAULT_PREFS, type CloudUIDRow, type Preferences, type Session, type UIDEntry } from "./types";

async function authedFetch(
  sessionRef: { current: Session | null },
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  let session = sessionRef.current;
  if (!session) throw new Error("Not signed in");
  const make = (token: string) =>
    fetch(SUPABASE_URL + path, {
      ...init,
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(init.headers || {})
      }
    });
  let res = await make(session.access_token);
  if (res.status === 401) {
    const refreshed = await refreshSession(session);
    sessionRef.current = refreshed;
    if (!refreshed) throw new Error("Session expired");
    await saveSession(refreshed);
    res = await make(refreshed.access_token);
  }
  return res;
}

function toCloud(entry: UIDEntry, userId: string): Omit<CloudUIDRow, "created_at" | "updated_at"> {
  return {
    id: entry.id,
    user_id: userId,
    uid: entry.uid,
    name: entry.name || null,
    username: entry.username || null,
    profile_pic: entry.profilePic || null,
    follower_count: entry.followerCount ?? null,
    has_instagram: Boolean(entry.hasInstagram),
    status: entry.status,
    fetched_at: entry.fetchedAt || null,
    saved: Boolean(entry.saved),
    re_input: Boolean(entry.reInput),
    collection: entry.collection || null,
    tags: entry.tags || []
  };
}

export async function pullUIDs(sessionRef: { current: Session | null }): Promise<CloudUIDRow[]> {
  const res = await authedFetch(
    sessionRef,
    "/rest/v1/uid_entries?select=*&order=created_at.desc"
  );
  if (!res.ok) throw new Error("Cloud UID load failed (" + res.status + ")");
  return res.json();
}

export async function upsertUIDs(
  sessionRef: { current: Session | null },
  entries: UIDEntry[]
) {
  const session = sessionRef.current;
  if (!session || entries.length === 0) return;
  const rows = entries.map((entry) => toCloud(entry, session.user.id));
  const res = await authedFetch(sessionRef, "/rest/v1/uid_entries?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error("Cloud UID sync failed (" + res.status + ")");
}

export async function deleteCloudUID(
  sessionRef: { current: Session | null },
  id: string
) {
  const res = await authedFetch(
    sessionRef,
    "/rest/v1/uid_entries?id=eq." + encodeURIComponent(id),
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Cloud delete failed");
}

export async function clearCloudUIDs(sessionRef: { current: Session | null }) {
  const session = sessionRef.current;
  if (!session) return;
  const res = await authedFetch(
    sessionRef,
    "/rest/v1/uid_entries?user_id=eq." + encodeURIComponent(session.user.id),
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Cloud clear failed");
}

export async function pullPrefs(sessionRef: { current: Session | null }): Promise<Preferences | null> {
  const res = await authedFetch(
    sessionRef,
    "/rest/v1/user_preferences?select=*&limit=1"
  );
  if (!res.ok) throw new Error("Preference load failed");
  const rows = (await res.json()) as Array<{
    theme: "dark" | "light";
    font_size: Preferences["fontSize"];
    view_mode: Preferences["viewMode"];
    swipe_to_delete: boolean;
    auto_retry: boolean;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    ...DEFAULT_PREFS,
    theme: row.theme,
    fontSize: row.font_size,
    viewMode: row.view_mode,
    swipeToDelete: row.swipe_to_delete,
    autoRetry: row.auto_retry
  };
}

export async function upsertPrefs(
  sessionRef: { current: Session | null },
  prefs: Preferences
) {
  const session = sessionRef.current;
  if (!session) return;
  const cloudTheme = prefs.theme === "light" ? "light" : "dark";
  const res = await authedFetch(
    sessionRef,
    "/rest/v1/user_preferences?on_conflict=user_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: session.user.id,
        theme: cloudTheme,
        font_size: prefs.fontSize,
        view_mode: prefs.viewMode,
        swipe_to_delete: prefs.swipeToDelete,
        auto_retry: prefs.autoRetry
      })
    }
  );
  if (!res.ok) throw new Error("Preference sync failed");
}
