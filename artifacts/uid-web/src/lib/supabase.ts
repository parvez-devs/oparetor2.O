const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";

const SESSION_KEY = "uid-operator-supabase-session";

export interface SupabaseUser {
  id: string;
  email?: string;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: SupabaseUser;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: SupabaseUser | null;
  session?: SupabaseSession | null;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
}

export interface CloudUIDRow {
  id: string;
  user_id: string;
  uid: string;
  name: string | null;
  username: string | null;
  profile_pic: string | null;
  follower_count: number | null;
  has_instagram: boolean;
  status: "pending" | "success" | "error";
  fetched_at: string | null;
  saved: boolean;
  re_input: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudPreferences {
  user_id: string;
  theme: "dark" | "light";
  font_size: "sm" | "md" | "lg";
  view_mode: "full" | "compact";
  swipe_to_delete: boolean;
  auto_retry: boolean;
  updated_at?: string;
}

function ensureConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase is not configured");
  }
}

function baseHeaders(extra?: HeadersInit): HeadersInit {
  return {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function parseError(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json() as AuthResponse;
    message = body.error_description || body.msg || body.message || body.error || message;
  } catch {
    // keep generic error
  }
  return new Error(message);
}

function normalizeSession(body: AuthResponse): SupabaseSession | null {
  if (body.session?.access_token) return body.session;
  if (!body.access_token || !body.refresh_token || !body.user) return null;
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    expires_at: body.expires_at ?? (body.expires_in ? Math.floor(Date.now() / 1000) + body.expires_in : undefined),
    token_type: body.token_type,
    user: body.user,
  };
}

function saveSession(session: SupabaseSession | null) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("auth-session-updated", { detail: session }));
}

export function readStoredSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as SupabaseSession;
    if (!value?.access_token || !value?.refresh_token || !value?.user?.id) return null;
    return value;
  } catch {
    return null;
  }
}

export async function signUp(email: string, password: string) {
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await parseError(res);
  const body = await res.json() as AuthResponse;
  const session = normalizeSession(body);
  if (session) saveSession(session);
  return { session, user: body.user ?? session?.user ?? null };
}

export async function signIn(email: string, password: string): Promise<SupabaseSession> {
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await parseError(res);
  const body = await res.json() as AuthResponse;
  const session = normalizeSession(body);
  if (!session) throw new Error("Login succeeded but no session was returned");
  saveSession(session);
  return session;
}

export async function refreshSession(current = readStoredSession()): Promise<SupabaseSession | null> {
  if (!current?.refresh_token) return null;
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!res.ok) {
    saveSession(null);
    return null;
  }
  const body = await res.json() as AuthResponse;
  const session = normalizeSession(body);
  saveSession(session);
  return session;
}

export async function getSession(): Promise<SupabaseSession | null> {
  const session = readStoredSession();
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + 90) {
    return refreshSession(session);
  }
  return session;
}

export async function signOut(): Promise<void> {
  const session = readStoredSession();
  if (session?.access_token && SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: baseHeaders({ Authorization: `Bearer ${session.access_token}` }),
      });
    } catch {
      // Always clear local session even if network logout fails.
    }
  }
  saveSession(null);
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  ensureConfigured();
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: baseHeaders({ Authorization: `Bearer ${session.access_token}`, ...(init.headers ?? {}) }),
  });
  if (res.status === 401) {
    const refreshed = await refreshSession(session);
    if (!refreshed) throw new Error("Session expired");
    return fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: baseHeaders({ Authorization: `Bearer ${refreshed.access_token}`, ...(init.headers ?? {}) }),
    });
  }
  return res;
}

export async function pullCloudUIDs(): Promise<CloudUIDRow[]> {
  const res = await authedFetch("/rest/v1/uid_entries?select=*&order=created_at.desc");
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<CloudUIDRow[]>;
}

export async function upsertCloudUIDs(rows: Omit<CloudUIDRow, "created_at" | "updated_at">[]): Promise<void> {
  if (rows.length === 0 || !readStoredSession()) return;
  const res = await authedFetch("/rest/v1/uid_entries?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw await parseError(res);
}

export async function deleteCloudUID(id: string): Promise<void> {
  if (!readStoredSession()) return;
  const res = await authedFetch(`/rest/v1/uid_entries?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res);
}

export async function clearCloudUIDs(): Promise<void> {
  const session = readStoredSession();
  if (!session) return;
  const res = await authedFetch(`/rest/v1/uid_entries?user_id=eq.${encodeURIComponent(session.user.id)}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res);
}

export async function pullCloudPreferences(): Promise<CloudPreferences | null> {
  const res = await authedFetch("/rest/v1/user_preferences?select=*&limit=1");
  if (!res.ok) throw await parseError(res);
  const rows = await res.json() as CloudPreferences[];
  return rows[0] ?? null;
}

export async function upsertCloudPreferences(prefs: Omit<CloudPreferences, "updated_at">): Promise<void> {
  if (!readStoredSession()) return;
  const res = await authedFetch("/rest/v1/user_preferences?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw await parseError(res);
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
