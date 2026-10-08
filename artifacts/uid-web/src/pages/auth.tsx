import { useState } from "react";
import { UserRound, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email.includes("@")) return setError("Valid email required");
    if (password.length < 6) return setError("Password must be at least 6 characters");

    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result.needsConfirmation) {
          setMessage("Account created. Check your email, confirm it, then login.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0e1a] text-white flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#1677ff] flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
            <UserRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{mode === "login" ? "UID Operator" : "Create account"}</h1>
          <p className="text-xs text-[#6b7280] mt-1">{mode === "login" ? "Login to continue" : "Create your UID Operator account"}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#6b7280]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1.5 w-full h-11 rounded-md border border-[#202a3a] bg-[#171c27] px-3 text-sm outline-none focus:border-[#1677ff]"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#6b7280]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="mt-1.5 w-full h-11 rounded-md border border-[#202a3a] bg-[#171c27] px-3 text-sm outline-none focus:border-[#1677ff]"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="text-xs text-red-400 text-center">{error}</div>}
          {message && <div className="text-xs text-emerald-400 text-center">{message}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-md bg-[#1677ff] hover:bg-[#126be6] disabled:opacity-60 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        <div className="text-center text-xs text-[#6b7280] mt-5">
          {mode === "login" ? "Account নেই?" : "Already have an account?"}{" "}
          <button className="text-[#1677ff] font-medium" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>
            {mode === "login" ? "Register" : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
