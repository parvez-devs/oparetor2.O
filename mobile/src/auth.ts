import * as SecureStore from "expo-secure-store";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { Session } from "./types";

const AUTH_KEY = "uidzone_auth_session";

type AuthBody = Partial<Session> & {
  session?: Session | null;
  user?: Session["user"] | null;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...(extra || {})
  };
}

async function parseError(res: Response) {
  let message = "Request failed (" + res.status + ")";
  try {
    const body = (await res.json()) as AuthBody;
    message = body.error_description || body.msg || body.message || body.error || message;
  } catch {}
  return new Error(message);
}

function normalize(body: AuthBody): Session | null {
  if (body.session && body.session.access_token) return body.session;
  if (!body.access_token || !body.refresh_token || !body.user) return null;
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    expires_at:
      body.expires_at ||
      (body.expires_in ? Math.floor(Date.now() / 1000) + body.expires_in : undefined),
    token_type: body.token_type,
    user: body.user
  };
}

export async function saveSession(session: Session | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    return;
  }
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(session));
}

export async function readSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.access_token || !session.refresh_token || !session.user?.id) return null;
    return session;
  } catch {
    return null;
  }
}

export async function refreshSession(current: Session): Promise<Session | null> {
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ refresh_token: current.refresh_token })
  });
  if (!res.ok) {
    await saveSession(null);
    return null;
  }
  const body = (await res.json()) as AuthBody;
  const session = normalize(body);
  await saveSession(session);
  return session;
}

export async function restoreSession(): Promise<Session | null> {
  const session = await readSession();
  if (!session) return null;
  const expiresAt = session.expires_at || 0;
  if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + 90) {
    return refreshSession(session);
  }
  return session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as AuthBody;
  const session = normalize(body);
  if (!session) throw new Error("Login succeeded but no session was returned");
  await saveSession(session);
  return session;
}

export async function signUp(email: string, password: string) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/signup", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as AuthBody;
  const session = normalize(body);
  if (session) await saveSession(session);
  return { session, user: body.user || session?.user || null };
}

export async function signOut(session: Session | null) {
  try {
    if (session?.access_token) {
      await fetch(SUPABASE_URL + "/auth/v1/logout", {
        method: "POST",
        headers: headers({ Authorization: "Bearer " + session.access_token })
      });
    }
  } catch {}
  await saveSession(null);
}
