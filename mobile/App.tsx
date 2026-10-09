import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ImportScreen } from "./src/screens/ImportScreen";
import { SavedScreen } from "./src/screens/SavedScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AnimatedSplash } from "./src/components/AnimatedSplash";
import { AuroraBackground } from "./src/components/AuroraBackground";
import { VaultGate } from "./src/components/VaultGate";
import { restoreSession } from "./src/auth";
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
import { authenticateBiometric, loadVaultConfig, saveVaultConfig } from "./src/security";
import type { BackupPayload } from "./src/backup";
import {
  DEFAULT_PREFS,
  DEFAULT_VAULT,
  type CloudUIDRow,
  type Preferences,
  type Session,
  type SyncStatus,
  type UIDEntry,
  type VaultConfig
} from "./src/types";
import { getTheme } from "./src/theme";
import { uuid } from "./src/utils";

type Tab = "home" | "import" | "saved" | "settings";

function fromCloud(row: CloudUIDRow, local?: UIDEntry): UIDEntry {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name || undefined,
    username: row.username || undefined,
    profilePic: row.profile_pic || undefined,
    followerCount: row.follower_count ?? undefined,
    hasInstagram: row.has_instagram,
    status: row.status,
    fetchedAt: row.fetched_at || undefined,
    saved: row.saved,
    reInput: row.re_input,
    hasPassword: local?.hasPassword,
    collection: row.collection || local?.collection,
    tags: row.tags?.length ? row.tags : local?.tags,
    updatedAt: row.updated_at || local?.updatedAt
  };
}

export default function App() {
  const systemScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [splash, setSplash] = useState(true);
  const [uids, setUids] = useState<UIDEntry[]>([]);
  const uidsRef = useRef<UIDEntry[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [vault, setVault] = useState<VaultConfig>(DEFAULT_VAULT);
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [lastSync, setLastSync] = useState<string | undefined>();
  const [online, setOnline] = useState(true);
  const [appError, setAppError] = useState("");
  const autoFetchDone = useRef(false);
  const autoRetryDone = useRef(false);
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const tabY = useRef(new Animated.Value(0)).current;

  const theme = useMemo(() => getTheme(prefs, systemScheme), [prefs, systemScheme]);
  const isLight = theme.bg === "#eff5ff";

  const setSessionBoth = (value: Session | null) => {
    sessionRef.current = value;
    setSession(value);
  };

  const cloudSuccess = () => {
    const now = new Date().toISOString();
    setLastSync(now);
    setSyncStatus("synced");
  };

  const commit = async (next: UIDEntry[], cloudChanged?: UIDEntry[]) => {
    const current = sessionRef.current;
    if (!current) return;
    uidsRef.current = next;
    setUids(next);
    await saveUIDs(current.user.id, next);

    if (!cloudChanged?.length) return;
    if (!online) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("syncing");
    try {
      await upsertUIDs(sessionRef, cloudChanged);
      cloudSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const conflict = message.includes("(409)") || message.toLowerCase().includes("conflict");
      setSyncStatus(conflict ? "conflict" : "error");
      setAppError(
        conflict
          ? "A cloud conflict was detected. Local data is preserved; refresh to reconcile with the newest cloud copy."
          : "Cloud sync is temporarily unavailable. Local changes are safe and will be retried."
      );
    }
  };

  const hydrate = async (current: Session, showSpinner = true) => {
    if (showSpinner) setSyncing(true);
    const userId = current.user.id;

    try {
      const local = await loadUIDs(userId);
      const localMap = new Map(local.map((u) => [u.id, u]));
      uidsRef.current = local;
      setUids(local);

      const localHadPrefs = await hasPrefs(userId);
      const localPrefs = await loadPrefs(userId);
      setPrefs(localPrefs);

      if (!online) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("syncing");

      try {
        if (local.length) await upsertUIDs(sessionRef, local);
        const remote = await pullUIDs(sessionRef);
        const remoteIds = new Set(remote.map((r) => r.id));
        const merged = [
          ...remote.map((row) => fromCloud(row, localMap.get(row.id))),
          ...local.filter((u) => !remoteIds.has(u.id))
        ];
        uidsRef.current = merged;
        setUids(merged);
        await saveUIDs(userId, merged);

        if (localHadPrefs) {
          await upsertPrefs(sessionRef, localPrefs);
        } else {
          const cloudPrefs = await pullPrefs(sessionRef).catch(() => null);
          const finalPrefs = cloudPrefs || localPrefs;
          setPrefs(finalPrefs);
          await savePrefs(userId, finalPrefs);
          if (!cloudPrefs) await upsertPrefs(sessionRef, finalPrefs);
        }

        cloudSuccess();
        setAppError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const conflict = message.includes("(409)") || message.toLowerCase().includes("conflict");
        setSyncStatus(conflict ? "conflict" : "error");
        setAppError(
          conflict
            ? "Cloud and local versions need reconciliation. UID 2.O kept the local copy safe."
            : "Cloud service could not be reached. UID 2.O is using local data."
        );
      }
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
        if (value) {
          const config = await loadVaultConfig(value.user.id);
          if (!active) return;
          setVault(config);
          setLocked(config.enabled);
          await hydrate(value, false);
        }
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if ((state === "background" || state === "inactive") && vault.enabled && sessionRef.current) {
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [vault.enabled]);

  useEffect(() => {
    const key = "uid2-vault-capture";
    if (session && vault.blockScreenshots) {
      ScreenCapture.preventScreenCaptureAsync(key).catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
    }
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
    };
  }, [session, vault.blockScreenshots]);

  const syncNow = async () => {
    const current = sessionRef.current;
    if (current) await hydrate(current, true);
  };

  useEffect(() => {
    let previous = true;
    const unsub = NetInfo.addEventListener((state) => {
      const next = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(next);
      if (!next) {
        setSyncStatus("offline");
      } else if (!previous && sessionRef.current) {
        void syncNow();
        const pending = uidsRef.current.filter((u) => u.status === "pending" || u.status === "error");
        if (pending.length) void batchFetch(pending);
      }
      previous = next;
    });
    return unsub;
  }, []);

  const onAuthenticated = async (value: Session) => {
    setSessionBoth(value);
    setBooting(true);
    try {
      const config = await loadVaultConfig(value.user.id);
      setVault(config);
      setLocked(false);
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
    if (online) {
      upsertPrefs(sessionRef, next)
        .then(cloudSuccess)
        .catch(() => setSyncStatus("error"));
    }
    if (!next.autoRetry) autoRetryDone.current = false;
  };

  const updateVault = async (next: VaultConfig) => {
    const current = sessionRef.current;
    setVault(next);
    if (current) await saveVaultConfig(current.user.id, next);
  };

  const authorizeSensitive = async () => {
    if (!vault.requireForPassword) return true;
    if (vault.biometric && (await authenticateBiometric("Reveal UID 2.O password"))) {
      if (prefs.haptics) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return true;
    }
    if (vault.enabled) {
      setLocked(true);
      return false;
    }
    return true;
  };

  const batchFetch = async (entries: UIDEntry[]) => {
    if (!entries.length) return;
    if (!online) {
      setSyncStatus("offline");
      setAppError("You're offline. Profile fetch will be available when the connection returns.");
      return;
    }

    const ids = entries.map((e) => e.id);
    setFetchingIds((old) => new Set([...old, ...ids]));
    try {
      let working = uidsRef.current.map((u) =>
        ids.includes(u.id) ? { ...u, status: "pending" as const, updatedAt: new Date().toISOString() } : u
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
            const next: UIDEntry = result
              ? {
                  ...entry,
                  status: result.status === "success" || result.name ? "success" : "error",
                  name: result.name || entry.name,
                  username: result.username || entry.username,
                  profilePic: result.profile_pic || entry.profilePic,
                  followerCount: result.follower_count ?? entry.followerCount,
                  hasInstagram: result.has_instagram ?? entry.hasInstagram,
                  fetchedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              : {
                  ...entry,
                  status: "error",
                  fetchedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
            changed.push(next);
            return next;
          });

          await commit(working, changed);
          if (prefs.haptics && changed.some((u) => u.status === "success")) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        } catch {
          const changed: UIDEntry[] = [];
          working = working.map((entry) => {
            if (!chunk.some((c) => c.id === entry.id)) return entry;
            const next = {
              ...entry,
              status: "error" as const,
              fetchedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            changed.push(next);
            return next;
          });
          await commit(working, changed);
          setAppError("Profile API did not respond correctly. Failed items are marked for Retry.");
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
    if (!session || booting || autoFetchDone.current || !online) return;
    const pending = uidsRef.current.filter((u) => u.status === "pending" && !u.fetchedAt);
    autoFetchDone.current = true;
    if (pending.length) void batchFetch(pending);
  }, [session, booting, online]);

  useEffect(() => {
    if (!session || booting || !prefs.autoRetry || autoRetryDone.current || !online) return;
    const failed = uidsRef.current.filter((u) => u.status === "error");
    autoRetryDone.current = true;
    if (failed.length) void batchFetch(failed);
  }, [session, booting, prefs.autoRetry, online]);

  const importText = async (text: string, fetchAfter: boolean) => {
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
      .filter((row) => /^\d{5,}$/.test(row.uid));

    if (!rows.length) throw new Error("No valid numeric UID lines found");

    const now = new Date().toISOString();
    const created: UIDEntry[] = rows.map((row) => ({
      id: uuid(),
      uid: row.uid,
      status: "pending",
      hasPassword: Boolean(row.password),
      updatedAt: now
    }));

    await Promise.all(
      created.map((entry, index) =>
        savePassword(current.user.id, entry.id, rows[index]?.password || undefined)
      )
    );

    const next = [...created, ...uidsRef.current];
    await commit(next, created);
    if (fetchAfter) await batchFetch(created);
    changeTab("home");
    if (prefs.haptics) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return created.length;
  };

  const deleteOne = async (id: string) => {
    const current = sessionRef.current;
    if (!current) return;
    const target = uidsRef.current.find((u) => u.id === id);
    const next = uidsRef.current.filter((u) => u.id !== id);
    await commit(next);
    if (target?.hasPassword) await deletePassword(current.user.id, id).catch(() => {});
    if (online) deleteCloudUID(sessionRef, id).catch(() => setSyncStatus("error"));
  };

  const deleteMany = async (ids: string[]) => {
    const current = sessionRef.current;
    if (!current || !ids.length) return;
    const set = new Set(ids);
    const targets = uidsRef.current.filter((u) => set.has(u.id));
    const next = uidsRef.current.filter((u) => !set.has(u.id));
    await commit(next);
    await Promise.all(targets.filter((u) => u.hasPassword).map((u) => deletePassword(current.user.id, u.id).catch(() => {})));
    if (online) {
      await Promise.all(ids.map((id) => deleteCloudUID(sessionRef, id).catch(() => {})));
      cloudSuccess();
    }
  };

  const toggleSaved = async (id: string) => {
    const changed: UIDEntry[] = [];
    const next = uidsRef.current.map((u) => {
      if (u.id !== id) return u;
      const value = { ...u, saved: !u.saved, updatedAt: new Date().toISOString() };
      changed.push(value);
      return value;
    });
    await commit(next, changed);
  };

  const saveMany = async (ids: string[]) => {
    const set = new Set(ids);
    const changed: UIDEntry[] = [];
    const next = uidsRef.current.map((u) => {
      if (!set.has(u.id) || u.saved) return u;
      const value = { ...u, saved: true, updatedAt: new Date().toISOString() };
      changed.push(value);
      return value;
    });
    await commit(next, changed);
  };

  const setCollection = async (id: string, collection?: string) => {
    const next = uidsRef.current.map((u) =>
      u.id === id ? { ...u, collection, updatedAt: new Date().toISOString() } : u
    );
    await commit(next);
  };

  const clearAll = async () => {
    const current = sessionRef.current;
    if (!current) return;
    const old = uidsRef.current;
    await clearPasswords(current.user.id, old).catch(() => {});
    await commit([]);
    if (online) {
      clearCloudUIDs(sessionRef)
        .then(cloudSuccess)
        .catch(() => setSyncStatus("error"));
    }
  };

  const restoreBackupData = async (payload: BackupPayload) => {
    const current = sessionRef.current;
    if (!current) throw new Error("Not signed in");

    await clearPasswords(current.user.id, uidsRef.current).catch(() => {});
    const restored = payload.uids.map((u) => ({
      ...u,
      hasPassword: Boolean(payload.passwords[u.id]),
      updatedAt: new Date().toISOString()
    }));

    await Promise.all(
      restored.map((entry) =>
        savePassword(current.user.id, entry.id, payload.passwords[entry.id])
      )
    );

    uidsRef.current = restored;
    setUids(restored);
    await saveUIDs(current.user.id, restored);
    await updatePrefs({ ...DEFAULT_PREFS, ...payload.prefs });
    if (online && restored.length) {
      setSyncStatus("syncing");
      await upsertUIDs(sessionRef, restored);
      cloudSuccess();
    }
  };

  const changeTab = (next: Tab) => {
    if (next === tab) return;
    tabOpacity.setValue(0);
    tabY.setValue(7);
    setTab(next);
    Animated.parallel([
      Animated.timing(tabOpacity, { toValue: 1, duration: prefs.reduceMotion ? 0 : 180, useNativeDriver: true }),
      Animated.spring(tabY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 210 })
    ]).start();
    if (prefs.haptics) Haptics.selectionAsync().catch(() => {});
  };

  const tabs: Array<{ id: Tab; label: string; icon: any; lib?: "mci" }> = [
    { id: "home", label: "HOME", icon: "home" },
    { id: "import", label: "IMPORT", icon: "upload-cloud" },
    { id: "saved", label: "SAVED", icon: "star" },
    { id: "settings", label: "SETTINGS", icon: "settings" }
  ];

  let body: React.ReactNode;

  if (booting) {
    body = (
      <View style={[styles.loader, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={{ color: theme.secondary, marginTop: 12, fontWeight: "800" }}>Securing workspace…</Text>
      </View>
    );
  } else if (!session) {
    body = <AuthScreen onSession={onAuthenticated} />;
  } else if (locked) {
    body = <VaultGate userId={session.user.id} biometric={vault.biometric} onUnlock={() => setLocked(false)} />;
  } else {
    body = (
      <View
        style={[
          styles.safe,
          {
            backgroundColor: theme.bg,
            paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0
          }
        ]}
      >
        <AuroraBackground theme={theme} reduceMotion={prefs.reduceMotion} />
        <StatusBar barStyle={isLight ? "dark-content" : "light-content"} backgroundColor={theme.bg} />

        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { borderColor: theme.edge, backgroundColor: theme.primary + "10" }]}>
              <Text style={{ color: theme.cyan, fontSize: 10, fontWeight: "900" }}>U2</Text>
            </View>
            <View>
              <Text style={[styles.brand, { color: theme.text }]}>UID <Text style={{ color: theme.primary }}>2.O</Text></Text>
              <Text style={{ color: theme.muted, fontSize: 7, letterSpacing: 1.2, fontWeight: "800" }}>CYBER MINIMAL</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <View style={[styles.syncPill, { borderColor: theme.border, backgroundColor: theme.input }]}>
              <View
                style={[
                  styles.syncDot,
                  {
                    backgroundColor:
                      syncStatus === "synced" ? theme.success :
                      syncStatus === "offline" ? theme.warning :
                      syncStatus === "error" || syncStatus === "conflict" ? theme.error :
                      theme.primary
                  }
                ]}
              />
              <Text style={{ color: theme.secondary, fontSize: 8, fontWeight: "900" }}>
                {syncStatus === "syncing" ? "SYNC" : syncStatus.toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={() => changeTab("home")} style={styles.headerButton}>
              <Feather name="search" size={17} color={theme.muted} />
            </Pressable>
          </View>
        </View>

        {appError ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.error + "12", borderBottomColor: theme.error + "35" }]}>
            <Feather name="alert-triangle" size={13} color={theme.error} />
            <Text numberOfLines={2} style={{ color: theme.error, flex: 1, fontSize: 10, lineHeight: 14 }}>{appError}</Text>
            <Pressable hitSlop={8} onPress={() => setAppError("")}>
              <Feather name="x" size={14} color={theme.error} />
            </Pressable>
          </View>
        ) : null}

        <Animated.View style={{ flex: 1, opacity: tabOpacity, transform: [{ translateY: tabY }] }}>
          {tab === "home" ? (
            <HomeScreen
              userId={session.user.id}
              uids={uids}
              prefs={prefs}
              theme={theme}
              fetchingIds={fetchingIds}
              syncing={syncing}
              syncStatus={syncStatus}
              online={online}
              vault={vault}
              onAuthorizeSensitive={authorizeSensitive}
              onSync={syncNow}
              onFetch={batchFetch}
              onDelete={deleteOne}
              onDeleteMany={deleteMany}
              onSaved={toggleSaved}
              onSaveMany={saveMany}
              onCollection={setCollection}
              onClear={clearAll}
              onGoImport={() => changeTab("import")}
            />
          ) : null}

          {tab === "import" ? (
            <ImportScreen
              theme={theme}
              prefs={prefs}
              existingUIDs={uids.map((u) => u.uid)}
              onImport={importText}
            />
          ) : null}

          {tab === "saved" ? (
            <SavedScreen
              userId={session.user.id}
              uids={uids}
              prefs={prefs}
              theme={theme}
              vault={vault}
              fetchingIds={fetchingIds}
              onAuthorizeSensitive={authorizeSensitive}
              onFetch={batchFetch}
              onDelete={deleteOne}
              onSaved={toggleSaved}
              onCollection={setCollection}
              onGoHome={() => changeTab("home")}
            />
          ) : null}

          {tab === "settings" ? (
            <SettingsScreen
              userId={session.user.id}
              theme={theme}
              prefs={prefs}
              vault={vault}
              uids={uids}
              online={online}
              syncStatus={syncStatus}
              lastSync={lastSync}
              onPrefs={updatePrefs}
              onVault={updateVault}
              onClear={clearAll}
              onRestoreBackup={restoreBackupData}
            />
          ) : null}
        </Animated.View>

        <View style={[styles.nav, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          {tabs.map((item) => {
            const active = item.id === tab;
            return (
              <Pressable
                key={item.id}
                onPress={() => changeTab(item.id)}
                style={({ pressed }) => [styles.navItem, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                {active ? <View style={[styles.activeLine, { backgroundColor: theme.cyan }]} /> : null}
                <View style={[styles.navIconWrap, active && { backgroundColor: theme.primary + "12" }]}>
                  <Feather name={item.icon} size={18} color={active ? theme.cyan : theme.muted} />
                </View>
                <Text style={{ color: active ? theme.cyan : theme.muted, fontSize: 8.5, fontWeight: "900", marginTop: 2, letterSpacing: 0.3 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {body}
      {(splash || booting) ? <AnimatedSplash onDone={() => setSplash(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: "hidden" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  syncPill: { height: 28, borderRadius: 9, borderWidth: 1, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  headerButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  errorBanner: { minHeight: 38, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  nav: {
    height: Platform.OS === "android" ? 76 : 66,
    paddingBottom: Platform.OS === "android" ? 9 : 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row"
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  activeLine: { position: "absolute", top: 3, width: 28, height: 3, borderRadius: 2 },
  navIconWrap: { width: 36, height: 29, borderRadius: 10, alignItems: "center", justifyContent: "center" }
});
