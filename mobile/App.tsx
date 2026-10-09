import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Vibration
} from "react-native";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ImportScreen } from "./src/screens/ImportScreen";
import { SavedScreen } from "./src/screens/SavedScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { restoreSession, signOut as authSignOut } from "./src/auth";
import {
  clearCloudUIDs,
  deleteCloudUID,
  pullPrefs,
  pullUIDs,
  upsertPrefs,
  upsertUIDs
} from "./src/cloud";
import { fetchProfiles } from "./src/api";
import {
  clearPasswords,
  deletePassword,
  hasPrefs,
  loadPrefs,
  loadUIDs,
  savePassword,
  savePrefs,
  saveUIDs
} from "./src/storage";
import { DEFAULT_PREFS, type CloudUIDRow, type Preferences, type Session, type UIDEntry } from "./src/types";
import { getTheme } from "./src/theme";
import { normalizeProfileFields, uuid } from "./src/utils";

type Tab = "home" | "import" | "saved" | "settings";

function fromCloud(row: CloudUIDRow, local?: UIDEntry): UIDEntry {
  const profile = normalizeProfileFields(row.name, row.username);
  return {
    id: row.id,
    uid: row.uid,
    name: profile.name,
    username: profile.username,
    profilePic: row.profile_pic || undefined,
    followerCount: row.follower_count ?? undefined,
    hasInstagram: row.has_instagram,
    status: row.status,
    fetchedAt: row.fetched_at || undefined,
    saved: row.saved,
    reInput: row.re_input,
    hasPassword: local?.hasPassword
  };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [uids, setUids] = useState<UIDEntry[]>([]);
  const uidsRef = useRef<UIDEntry[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [tab, setTab] = useState<Tab>("home");
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const autoFetchDone = useRef(false);
  const autoRetryDone = useRef(false);

  const theme = useMemo(() => getTheme(prefs), [prefs]);

  const setSessionBoth = (value: Session | null) => {
    sessionRef.current = value;
    setSession(value);
  };

  const commit = async (next: UIDEntry[], cloudChanged?: UIDEntry[]) => {
    const current = sessionRef.current;
    if (!current) return;
    uidsRef.current = next;
    setUids(next);
    await saveUIDs(current.user.id, next);
    if (cloudChanged && cloudChanged.length) {
      upsertUIDs(sessionRef, cloudChanged).catch(() => {});
    }
  };

  const hydrate = async (current: Session, showSpinner = true) => {
    if (showSpinner) setSyncing(true);
    try {
      const userId = current.user.id;
      const local = await loadUIDs(userId);
      const localMap = new Map(local.map((u) => [u.id, u]));
      if (local.length) await upsertUIDs(sessionRef, local).catch(() => {});
      const remote = await pullUIDs(sessionRef).catch(() => []);
      const remoteIds = new Set(remote.map((r) => r.id));
      const merged = [
        ...remote.map((row) => fromCloud(row, localMap.get(row.id))),
        ...local.filter((u) => !remoteIds.has(u.id))
      ];
      uidsRef.current = merged;
      setUids(merged);
      await saveUIDs(userId, merged);

      const localHadPrefs = await hasPrefs(userId);
      const localPrefs = await loadPrefs(userId);
      if (localHadPrefs) await upsertPrefs(sessionRef, localPrefs).catch(() => {});
      const cloudPrefs = await pullPrefs(sessionRef).catch(() => null);
      const finalPrefs = cloudPrefs || localPrefs;
      setPrefs(finalPrefs);
      await savePrefs(userId, finalPrefs);
      if (!cloudPrefs) await upsertPrefs(sessionRef, finalPrefs).catch(() => {});
    } finally {
      if (showSpinner) setSyncing(false);
    }
  };

  useEffect(() => {
    let active = true;
    restoreSession()
      .then(async (value) => {
        if (!active) return;
        setSessionBoth(value);
        if (value) await hydrate(value, false);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onAuthenticated = async (value: Session) => {
    setSessionBoth(value);
    setBooting(true);
    try {
      await hydrate(value, false);
      autoFetchDone.current = false;
      autoRetryDone.current = false;
    } finally {
      setBooting(false);
    }
  };

  const updatePrefs = async (next: Preferences) => {
    const current = sessionRef.current;
    setPrefs(next);
    if (!current) return;
    await savePrefs(current.user.id, next);
    upsertPrefs(sessionRef, next).catch(() => {});
    if (!next.autoRetry) autoRetryDone.current = false;
  };

  const batchFetch = async (entries: UIDEntry[]) => {
    if (!entries.length) return;
    const ids = entries.map((e) => e.id);
    setFetchingIds((old) => new Set([...old, ...ids]));
    try {
      let working = uidsRef.current.map((u) =>
        ids.includes(u.id) ? { ...u, status: "pending" as const } : u
      );
      await commit(working, working.filter((u) => ids.includes(u.id)));

      for (let i = 0; i < entries.length; i += 30) {
        const chunk = entries.slice(i, i + 30);
        try {
          const response = await fetchProfiles(chunk.map((u) => u.uid));
          const resultMap = new Map(response.results.map((r) => [r.uid, r.result]));
          const changed: UIDEntry[] = [];
          working = working.map((entry) => {
            const target = chunk.find((c) => c.id === entry.id);
            if (!target) return entry;
            const result = resultMap.get(entry.uid);
            const profile = result
              ? normalizeProfileFields(result.name || entry.name, result.username || entry.username)
              : null;
            const next: UIDEntry = result
              ? {
                  ...entry,
                  status: result.status === "success" || result.name ? "success" : "error",
                  name: profile?.name,
                  username: profile?.username,
                  profilePic: result.profile_pic || entry.profilePic,
                  followerCount: result.follower_count ?? entry.followerCount,
                  hasInstagram: result.has_instagram ?? entry.hasInstagram,
                  fetchedAt: new Date().toISOString()
                }
              : { ...entry, status: "error", fetchedAt: new Date().toISOString() };
            changed.push(next);
            return next;
          });
          await commit(working, changed);
        } catch {
          const changed: UIDEntry[] = [];
          working = working.map((entry) => {
            if (!chunk.some((c) => c.id === entry.id)) return entry;
            const next = { ...entry, status: "error" as const, fetchedAt: new Date().toISOString() };
            changed.push(next);
            return next;
          });
          await commit(working, changed);
        }
      }
    } finally {
      setFetchingIds((old) => {
        const next = new Set(old);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  useEffect(() => {
    if (!session || booting || autoFetchDone.current) return;
    const pending = uidsRef.current.filter((u) => u.status === "pending" && !u.fetchedAt);
    autoFetchDone.current = true;
    if (pending.length) batchFetch(pending);
  }, [session, booting]);

  useEffect(() => {
    if (!session || booting || !prefs.autoRetry || autoRetryDone.current) return;
    const failed = uidsRef.current.filter((u) => u.status === "error");
    autoRetryDone.current = true;
    if (failed.length) batchFetch(failed);
  }, [session, booting, prefs.autoRetry]);

  const importText = async (text: string) => {
    const current = sessionRef.current;
    if (!current) throw new Error("Not signed in");
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const pipe = line.indexOf("|");
        const uid = (pipe >= 0 ? line.slice(0, pipe) : line).trim();
        const password = pipe >= 0 ? line.slice(pipe + 1).trim() : "";
        return { uid, password };
      })
      .filter((row) => row.uid);

    const created: UIDEntry[] = rows.map((row) => ({
      id: uuid(),
      uid: row.uid,
      status: "pending",
      hasPassword: Boolean(row.password)
    }));

    await Promise.all(
      created.map((entry, index) =>
        savePassword(current.user.id, entry.id, rows[index]?.password || undefined)
      )
    );
    const next = [...created, ...uidsRef.current];
    await commit(next, created);
    setTab("home");
    batchFetch(created);
    Vibration.vibrate(12);
    return created.length;
  };

  const deleteOne = async (id: string) => {
    const current = sessionRef.current;
    if (!current) return;
    const target = uidsRef.current.find((u) => u.id === id);
    const next = uidsRef.current.filter((u) => u.id !== id);
    await commit(next);
    if (target?.hasPassword) await deletePassword(current.user.id, id).catch(() => {});
    deleteCloudUID(sessionRef, id).catch(() => {});
  };

  const toggleSaved = async (id: string) => {
    const changed: UIDEntry[] = [];
    const next = uidsRef.current.map((u) => {
      if (u.id !== id) return u;
      const value = { ...u, saved: !u.saved };
      changed.push(value);
      return value;
    });
    await commit(next, changed);
  };

  const clearAll = async () => {
    const current = sessionRef.current;
    if (!current) return;
    const old = uidsRef.current;
    await clearPasswords(current.user.id, old).catch(() => {});
    await commit([]);
    clearCloudUIDs(sessionRef).catch(() => {});
  };

  const syncNow = async () => {
    const current = sessionRef.current;
    if (current) await hydrate(current, true);
  };

  const logout = async () => {
    await authSignOut(sessionRef.current);
    setSessionBoth(null);
    uidsRef.current = [];
    setUids([]);
    setPrefs(DEFAULT_PREFS);
    setTab("home");
  };

  if (booting) {
    return (
      <View style={[styles.loader, { backgroundColor: "#080d14" }]}>
        <ActivityIndicator color="#3b9dff" size="large" />
        <Text style={{ color: "#8899bb", marginTop: 12 }}>UID 2.O</Text>
      </View>
    );
  }

  if (!session) return <AuthScreen onSession={onAuthenticated} />;

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "home", label: "HOME", icon: "⌂" },
    { id: "import", label: "IMPORT", icon: "＋" },
    { id: "saved", label: "SAVED", icon: "★" },
    { id: "settings", label: "SETTINGS", icon: "⚙" }
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar
        translucent
        barStyle={prefs.theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />

      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.brand, { color: theme.text }]}>UID <Text style={{ color: theme.primary }}>2.O</Text></Text>
        <Pressable onPress={() => setTab("home")} style={styles.headerButton}>
          <Text style={{ color: theme.muted, fontSize: 18 }}>⌕</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "home" ? (
          <HomeScreen
            userId={session.user.id}
            uids={uids}
            prefs={prefs}
            theme={theme}
            fetchingIds={fetchingIds}
            syncing={syncing}
            onSync={syncNow}
            onFetch={batchFetch}
            onDelete={deleteOne}
            onSaved={toggleSaved}
            onGoImport={() => setTab("import")}
          />
        ) : null}
        {tab === "import" ? <ImportScreen theme={theme} onImport={importText} /> : null}
        {tab === "saved" ? (
          <SavedScreen
            userId={session.user.id}
            uids={uids}
            prefs={prefs}
            theme={theme}
            fetchingIds={fetchingIds}
            onFetch={batchFetch}
            onDelete={deleteOne}
            onSaved={toggleSaved}
          />
        ) : null}
        {tab === "settings" ? (
          <SettingsScreen
            theme={theme}
            prefs={prefs}
            email={session.user.email}
            total={uids.length}
            onPrefs={updatePrefs}
            onClear={clearAll}
            onSignOut={() =>
              Alert.alert("Sign out?", undefined, [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", onPress: logout }
              ])
            }
          />
        ) : null}
      </View>

      <View style={[styles.nav, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {tabs.map((item) => {
          const active = item.id === tab;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                setTab(item.id);
                Vibration.vibrate(4);
              }}
              style={({ pressed }) => [styles.navItem, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              {active ? <View style={[styles.activeLine, { backgroundColor: theme.primary }]} /> : null}
              <Text style={{ color: active ? theme.primary : theme.muted, fontSize: 20 }}>{item.icon}</Text>
              <Text style={{ color: active ? theme.primary : theme.muted, fontSize: 9, fontWeight: "800", marginTop: 2 }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center"
  },
  brand: { fontSize: 20, fontWeight: "900", flex: 1, letterSpacing: -0.3 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  nav: {
    height: 76,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingTop: 4,
    paddingBottom: 8
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  activeLine: { position: "absolute", top: 0, width: 28, height: 3, borderRadius: 10 }
});
