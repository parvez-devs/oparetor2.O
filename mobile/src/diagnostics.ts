import { PROFILE_API_URL, SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { SyncStatus, UIDEntry } from "./types";

async function probe(url: string, init?: RequestInit) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function runDiagnostics() {
  const [api, supabase] = await Promise.all([
    probe(PROFILE_API_URL),
    probe(SUPABASE_URL + "/rest/v1/", { headers: { apikey: SUPABASE_KEY } })
  ]);
  return { api, supabase, checkedAt: new Date().toISOString() };
}

export function diagnosticReport(args: {
  version: string;
  build: number;
  online: boolean;
  syncStatus: SyncStatus;
  lastSync?: string;
  uids: UIDEntry[];
  api?: { ok: boolean; status: number; ms: number };
  supabase?: { ok: boolean; status: number; ms: number };
}) {
  const ok = args.uids.filter((u) => u.status === "success").length;
  const error = args.uids.filter((u) => u.status === "error").length;
  return [
    "UID 2.O diagnostics",
    "Version: " + args.version + " (" + args.build + ")",
    "Network: " + (args.online ? "online" : "offline"),
    "Sync: " + args.syncStatus,
    "Last sync: " + (args.lastSync || "never"),
    "Local UIDs: " + args.uids.length,
    "Success: " + ok,
    "Failed: " + error,
    "Profile API: " + (args.api ? (args.api.ok ? "OK" : "FAIL") + " " + args.api.status + " " + args.api.ms + "ms" : "not checked"),
    "Supabase: " + (args.supabase ? (args.supabase.ok ? "OK" : "FAIL") + " " + args.supabase.status + " " + args.supabase.ms + "ms" : "not checked"),
    "Generated: " + new Date().toISOString()
  ].join("\n");
}
