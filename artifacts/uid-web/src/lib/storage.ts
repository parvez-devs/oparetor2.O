import {
  clearCloudUIDs,
  deleteCloudUID,
  getSession,
  pullCloudPreferences,
  pullCloudUIDs,
  readStoredSession,
  upsertCloudPreferences,
  upsertCloudUIDs,
  type CloudUIDRow,
} from "./supabase";

export interface UIDEntry {
  id: string;
  uid: string;
  password?: string;
  name?: string;
  username?: string;
  profilePic?: string;
  followerCount?: number;
  hasInstagram?: boolean;
  status: "pending" | "success" | "error";
  fetchedAt?: string;
  saved?: boolean;
  reInput?: boolean;
}

export interface AppPreferences {
  theme: "dark" | "light";
  fontSize: "sm" | "md" | "lg";
  viewMode: "full" | "compact";
  swipeToDelete: boolean;
  autoRetry: boolean;
}

const STORAGE_KEY = "uid-operator-uids";
const COOKIE_KEY = "uid-operator-fb-cookie";
const PREFS_KEY = "uid-operator-prefs";

function scopedKey(baseKey: string): string {
  const userId = readStoredSession()?.user.id;
  return userId ? `${baseKey}:${userId}` : baseKey;
}

function migrateLegacyValue(baseKey: string, targetKey: string): void {
  if (baseKey === targetKey || localStorage.getItem(targetKey) !== null) return;
  const legacy = localStorage.getItem(baseKey);
  if (legacy === null) return;
  localStorage.setItem(targetKey, legacy);
  localStorage.removeItem(baseKey);
}

function readScoped(baseKey: string): string | null {
  const key = scopedKey(baseKey);
  migrateLegacyValue(baseKey, key);
  return localStorage.getItem(key);
}

function writeScoped(baseKey: string, value: string): void {
  const key = scopedKey(baseKey);
  migrateLegacyValue(baseKey, key);
  localStorage.setItem(key, value);
}

function removeScoped(baseKey: string): void {
  const key = scopedKey(baseKey);
  localStorage.removeItem(key);
}

const DEFAULT_PREFS: AppPreferences = {
  theme: "dark",
  fontSize: "md",
  viewMode: "compact",
  swipeToDelete: false,
  autoRetry: false,
};

export function getFBCookie(): string {
  return readScoped(COOKIE_KEY) || "";
}

export function saveFBCookie(cookie: string): void {
  writeScoped(COOKIE_KEY, cookie);
}

export function getPreferences(): AppPreferences {
  try {
    const raw = readScoped(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePreferencesLocal(prefs: AppPreferences): void {
  writeScoped(PREFS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new Event("prefs-updated"));
}

export function savePreferences(prefs: Partial<AppPreferences>): void {
  const next = { ...getPreferences(), ...prefs };
  savePreferencesLocal(next);

  const session = readStoredSession();
  if (session) {
    void upsertCloudPreferences({
      user_id: session.user.id,
      theme: next.theme,
      font_size: next.fontSize,
      view_mode: next.viewMode,
      swipe_to_delete: next.swipeToDelete,
      auto_retry: next.autoRetry,
    }).catch((err) => console.warn("Preference cloud sync failed", err));
  }
}

export function getUIDs(): UIDEntry[] {
  try {
    const data = readScoped(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveUIDsLocal(uids: UIDEntry[]): boolean {
  try {
    writeScoped(STORAGE_KEY, JSON.stringify(uids));
    window.dispatchEvent(new Event("uids-updated"));
    return true;
  } catch (err) {
    console.error("Failed to save UIDs", err);
    return false;
  }
}

export function saveUIDs(uids: UIDEntry[]): boolean {
  return saveUIDsLocal(uids);
}

function toCloudRow(entry: UIDEntry, userId: string): Omit<CloudUIDRow, "created_at" | "updated_at"> {
  return {
    id: entry.id,
    user_id: userId,
    uid: entry.uid,
    name: entry.name ?? null,
    username: entry.username ?? null,
    profile_pic: entry.profilePic ?? null,
    follower_count: entry.followerCount ?? null,
    has_instagram: Boolean(entry.hasInstagram),
    status: entry.status,
    fetched_at: entry.fetchedAt ?? null,
    saved: Boolean(entry.saved),
    re_input: Boolean(entry.reInput),
  };
}

function syncRows(entries: UIDEntry[]) {
  const session = readStoredSession();
  if (!session || entries.length === 0) return;
  void upsertCloudUIDs(entries.map((entry) => toCloudRow(entry, session.user.id)))
    .catch((err) => console.warn("UID cloud sync failed", err));
}

// Append every entry as-is (no dedup/merge) — keep all pasted lines.
// Passwords remain local-only and are never sent to Supabase or the profile API.
export function appendUIDs(newUIDs: UIDEntry[]): { added: number; saved: boolean } {
  if (newUIDs.length === 0) return { added: 0, saved: true };
  const existing = getUIDs();
  const saved = saveUIDsLocal([...newUIDs, ...existing]);
  if (saved) syncRows(newUIDs);
  return { added: saved ? newUIDs.length : 0, saved };
}

export function updateUIDs(updates: (Partial<UIDEntry> & { id: string })[]): void {
  const existing = getUIDs();
  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const next = existing.map((e) =>
    updateMap.has(e.id) ? { ...e, ...updateMap.get(e.id) } : e
  );
  saveUIDsLocal(next);
  const changed = next.filter((e) => updateMap.has(e.id));
  syncRows(changed);
}

export function deleteUID(id: string): void {
  saveUIDsLocal(getUIDs().filter((e) => e.id !== id));
  void deleteCloudUID(id).catch((err) => console.warn("Cloud delete failed", err));
}

export function toggleSaved(id: string): void {
  const existing = getUIDs();
  const next = existing.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e));
  saveUIDsLocal(next);
  const changed = next.find((e) => e.id === id);
  if (changed) syncRows([changed]);
}

export function clearAllUIDs(): void {
  removeScoped(STORAGE_KEY);
  window.dispatchEvent(new Event("uids-updated"));
  void clearCloudUIDs().catch((err) => console.warn("Cloud clear failed", err));
}

export async function hydrateFromCloud(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const localUIDs = getUIDs();
  if (localUIDs.length > 0) {
    await upsertCloudUIDs(localUIDs.map((entry) => toCloudRow(entry, session.user.id)));
  }

  const remoteUIDs = await pullCloudUIDs();
  const localById = new Map(localUIDs.map((entry) => [entry.id, entry]));
  const remoteIds = new Set(remoteUIDs.map((row) => row.id));
  const mergedRemote: UIDEntry[] = remoteUIDs.map((row) => {
    const local = localById.get(row.id);
    return {
      id: row.id,
      uid: row.uid,
      password: local?.password,
      name: row.name ?? undefined,
      username: row.username ?? undefined,
      profilePic: row.profile_pic ?? undefined,
      followerCount: row.follower_count ?? undefined,
      hasInstagram: row.has_instagram,
      status: row.status,
      fetchedAt: row.fetched_at ?? undefined,
      saved: row.saved,
      reInput: row.re_input,
    };
  });
  const localOnly = localUIDs.filter((entry) => !remoteIds.has(entry.id));
  saveUIDsLocal([...mergedRemote, ...localOnly]);

  const hadLocalPreferences = readScoped(PREFS_KEY) !== null;
  const localPrefs = getPreferences();
  if (hadLocalPreferences) {
    await upsertCloudPreferences({
      user_id: session.user.id,
      theme: localPrefs.theme,
      font_size: localPrefs.fontSize,
      view_mode: localPrefs.viewMode,
      swipe_to_delete: localPrefs.swipeToDelete,
      auto_retry: localPrefs.autoRetry,
    });
  }

  const remotePrefs = await pullCloudPreferences();
  if (remotePrefs) {
    savePreferencesLocal({
      theme: remotePrefs.theme,
      fontSize: remotePrefs.font_size,
      viewMode: remotePrefs.view_mode,
      swipeToDelete: remotePrefs.swipe_to_delete,
      autoRetry: remotePrefs.auto_retry,
    });
  } else if (!hadLocalPreferences) {
    await upsertCloudPreferences({
      user_id: session.user.id,
      theme: localPrefs.theme,
      font_size: localPrefs.fontSize,
      view_mode: localPrefs.viewMode,
      swipe_to_delete: localPrefs.swipeToDelete,
      auto_retry: localPrefs.autoRetry,
    });
  }
}
