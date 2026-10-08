import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSession, signIn as supabaseSignIn, signOut as supabaseSignOut, signUp as supabaseSignUp, type SupabaseSession } from "@/lib/supabase";
import { hydrateFromCloud } from "@/lib/storage";

interface AuthContextValue {
  session: SupabaseSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (next: SupabaseSession | null) => {
    setSession(next);
    if (!next) return;
    try {
      await hydrateFromCloud();
    } catch (err) {
      console.warn("Cloud hydration failed", err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getSession().then(async (next) => {
      if (!active) return;
      await hydrate(next);
      if (active) setLoading(false);
    }).catch(() => {
      if (active) {
        setSession(null);
        setLoading(false);
      }
    });

    const onSession = (event: Event) => {
      const next = (event as CustomEvent<SupabaseSession | null>).detail ?? null;
      setSession(next);
    };
    window.addEventListener("auth-session-updated", onSession);
    return () => {
      active = false;
      window.removeEventListener("auth-session-updated", onSession);
    };
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await supabaseSignIn(email.trim().toLowerCase(), password);
    await hydrate(next);
  }, [hydrate]);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await supabaseSignUp(email.trim().toLowerCase(), password);
    if (result.session) await hydrate(result.session);
    return { needsConfirmation: !result.session };
  }, [hydrate]);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ session, loading, signIn, signUp, signOut }), [session, loading, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
