import * as SecureStore from "expo-secure-store";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { Session } from "./types";

const AUTH_KEY = "uidzone_auth_session";
export const NATIVE_AUTH_REDIRECT = "uidzone://auth/callback";
export const AUTH_REDIRECT_URL = "uidzone://auth/callback";

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
    }
  );
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as AuthBody;
  const session = normalize(body);
  if (!session) throw new Error("Login succeeded but no session was returned");
  await saveSession(session);
  return session;
}

export async function signUp(email: string, password: string) {
  const res = await fetch(
    SUPABASE_URL + "/auth/v1/signup?redirect_to=" + encodeURIComponent(AUTH_REDIRECT_URL),
    {
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


export async function resendConfirmation(email: string) {
  const res = await fetch(
    SUPABASE_URL + "/auth/v1/resend?redirect_to=" + encodeURIComponent(AUTH_REDIRECT_URL),
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ type: "signup", email: email.trim().toLowerCase() })
    }
  );
  if (!res.ok) throw await parseError(res);
}

function parseAuthParams(url: string) {
  const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const query = url.includes("?")
    ? url.slice(url.indexOf("?") + 1, url.includes("#") ? url.indexOf("#") : undefined)
    : "";
  return new URLSearchParams(fragment || query);
}

export async function sessionFromAuthUrl(url: string): Promise<Session | null> {
  if (!url.startsWith("uidzone://")) return null;

  const params = parseAuthParams(url);
  const error = params.get("error_description") || params.get("error");
  if (error) throw new Error(decodeURIComponent(error.replace(/\+/g, " ")));

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const userRes = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: headers({ Authorization: "Bearer " + accessToken })
  });
  if (!userRes.ok) throw await parseError(userRes);
  const user = (await userRes.json()) as Session["user"];

  const expiresIn = Number(params.get("expires_in") || "3600");
  const session: Session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600,
    expires_at: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    token_type: params.get("token_type") || "bearer",
    user
  };
  await saveSession(session);
  return session;
}

export async function sessionFromAuthUrl(url: string): Promise<Session | null> {
  if (!url || !url.startsWith("uidzone://auth/callback")) return null;

  const hash = url.includes("#") ? url.split("#")[1] : "";
  const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
  const params = new URLSearchParams([query, hash].filter(Boolean).join("&"));

  const error = params.get("error_description") || params.get("error");
  if (error) throw new Error(decodeURIComponent(error));

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const userRes = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: headers({ Authorization: "Bearer " + accessToken })
  });
  if (!userRes.ok) throw await parseError(userRes);
  const user = (await userRes.json()) as Session["user"];

  const expiresInRaw = params.get("expires_in");
  const expiresAtRaw = params.get("expires_at");
  const expiresIn = expiresInRaw ? Number(expiresInRaw) : undefined;
  const expiresAt = expiresAtRaw
    ? Number(expiresAtRaw)
    : expiresIn
      ? Math.floor(Date.now() / 1000) + expiresIn
      : undefined;

  const session: Session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: params.get("token_type") || "bearer",
    user
  };
  await saveSession(session);
  return session;
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
