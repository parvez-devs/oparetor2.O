import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { UIDCard } from "../components/UIDCard";
import { ProfileInspector } from "../components/ProfileInspector";
import { filterByChip, matchesCommandQuery, sortUIDs, type FilterKey } from "../search";
import type { Preferences, SortMode, SyncStatus, UIDEntry, VaultConfig } from "../types";
import type { Theme } from "../theme";

interface Props {
  userId: string;
  uids: UIDEntry[];
  prefs: Preferences;
  theme: Theme;
  fetchingIds: Set<string>;
  syncing: boolean;
  syncStatus: SyncStatus;
  online: boolean;
  vault: VaultConfig;
  onAuthorizeSensitive: () => Promise<boolean>;
  onSync: () => void;
  onFetch: (entries: UIDEntry[]) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onSaved: (id: string) => void;
  onSaveMany: (ids: string[]) => void;
  onCollection: (id: string, collection?: string) => void;
  onClear: () => void;
  onGoImport: () => void;
}

const FILTERS: Array<{ id: FilterKey; label: string; icon: any }> = [
  { id: "all", label: "All", icon: "layers" },
  { id: "ok", label: "OK", icon: "check-circle" },
  { id: "failed", label: "Failed", icon: "alert-circle" },
  { id: "ig", label: "IG", icon: "instagram" },
  { id: "saved", label: "Saved", icon: "star" },
  { id: "password", label: "With Password", icon: "key" }
];

const SORTS: SortMode[] = ["newest", "name", "status"];

export function HomeScreen(props: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showPasswords, setShowPasswords] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const [inspector, setInspector] = useState<UIDEntry | null>(null);
  const toolbarY = useRef(new Animated.Value(90)).current;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 180);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    Animated.spring(toolbarY, {
      toValue: selected.size ? 0 : 90,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220
    }).start();
  }, [selected.size, toolbarY]);

  const stats = useMemo(
    () => ({
      total: props.uids.length,
      success: props.uids.filter((u) => u.status === "success").length,
      error: props.uids.filter((u) => u.status === "error").length,
      pending: props.uids.filter((u) => u.status === "pending").length,
      pic: props.uids.filter((u) => Boolean(u.profilePic)).length,
      ig: props.uids.filter((u) => Boolean(u.hasInstagram)).length,
      saved: props.uids.filter((u) => Boolean(u.saved)).length,
      pass: props.uids.filter((u) => Boolean(u.hasPassword)).length
    }),
    [props.uids]
  );

  const data = useMemo(() => {
    const filtered = props.uids.filter(
      (u) => matchesCommandQuery(u, debounced) && filterByChip(u, filter)
    );
    return sortUIDs(filtered, sortMode);
  }, [props.uids, debounced, filter, sortMode]);

  const toggleSelect = (id: string) => {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const haptic = async () => {
    if (props.prefs.haptics) await Haptics.selectionAsync().catch(() => {});
  };

  const togglePasswords = async () => {
    if (showPasswords) {
      setShowPasswords(false);
      return;
    }
    if (props.vault.requireForPassword && !(await props.onAuthorizeSensitive())) return;
    setShowPasswords(true);
    await haptic();
  };

  const cycleSort = async () => {
    const index = SORTS.indexOf(sortMode);
    setSortMode(SORTS[(index + 1) % SORTS.length]);
    await haptic();
  };

  const clearSelection = () => setSelected(new Set());

  const selectedEntries = () => props.uids.filter((u) => selected.has(u.id));

  const copySelected = async () => {
    const entries = selectedEntries();
    if (!entries.length) return;
    await Clipboard.setStringAsync(entries.map((u) => u.uid).join("\n"));
    await haptic();
  };

  const bulkRetry = () => {
    const targets = selectedEntries().filter((u) => u.status !== "success");
    if (targets.length) props.onFetch(targets);
  };

  const bulkDelete = () => {
    const ids = Array.from(selected);
    Alert.alert("Delete selected UIDs?", ids.length + " item(s) will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          props.onDeleteMany(ids);
          clearSelection();
        }
      }
    ]);
  };

  const header = (
    <View>
      <View style={[styles.dashboard, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
        <View style={styles.dashboardTop}>
          <View>
            <Text style={[styles.dashboardLabel, { color: props.theme.muted }]}>SMART DASHBOARD</Text>
            <Text style={[styles.dashboardTitle, { color: props.theme.text }]}>
              {stats.total} UID <Text style={{ color: props.theme.cyan }}>workspace</Text>
            </Text>
          </View>

          <View style={styles.dashboardActions}>
            <Pressable
              onPress={togglePasswords}
              style={[styles.squareButton, { borderColor: showPasswords ? props.theme.cyan : props.theme.border }]}
            >
              <Feather name={showPasswords ? "eye-off" : "eye"} size={15} color={showPasswords ? props.theme.cyan : props.theme.secondary} />
            </Pressable>
            <Pressable onPress={cycleSort} style={[styles.sortButton, { borderColor: props.theme.border }]}>
              <Feather name="sliders" size={13} color={props.theme.primary} />
              <Text style={{ color: props.theme.secondary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>{sortMode}</Text>
            </Pressable>
            <Pressable onPress={() => setStatsCollapsed((v) => !v)} style={styles.collapse}>
              <Feather name={statsCollapsed ? "chevron-down" : "chevron-up"} size={17} color={props.theme.muted} />
            </Pressable>
          </View>
        </View>

        {!statsCollapsed ? (
          <View style={styles.statGrid}>
            <Stat icon="check-circle" label="OK" value={stats.success} color={props.theme.success} />
            <Stat icon="image" label="PIC" value={stats.pic} color={props.theme.primary} />
            <Stat icon="instagram" label="IG" value={stats.ig} color="#e04cf3" />
            <Stat icon="alert-circle" label="FAILED" value={stats.error} color={props.theme.error} />
            <Stat icon="star" label="SAVED" value={stats.saved} color={props.theme.warning} />
            <Stat icon="key" label="PASS" value={stats.pass} color={props.theme.cyan} />
          </View>
        ) : null}

        <View style={[styles.syncStrip, { borderTopColor: props.theme.border }]}>
          <View style={styles.syncLeft}>
            <View
              style={[
                styles.syncDot,
                {
                  backgroundColor:
                    props.syncStatus === "synced" ? props.theme.success :
                    props.syncStatus === "offline" ? props.theme.warning :
                    props.syncStatus === "error" || props.syncStatus === "conflict" ? props.theme.error :
                    props.theme.primary
                }
              ]}
            />
            <Text style={{ color: props.theme.secondary, fontSize: 10, fontWeight: "700" }}>
              {!props.online ? "OFFLINE" : props.syncStatus.toUpperCase()}
            </Text>
          </View>
          {stats.error > 0 ? (
            <Pressable onPress={() => props.onFetch(props.uids.filter((u) => u.status === "error"))} style={styles.retryMini}>
              <Feather name="refresh-cw" size={11} color={props.theme.error} />
              <Text style={{ color: props.theme.error, fontSize: 10, fontWeight: "800" }}>Retry {stats.error}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: props.theme.input, borderColor: props.theme.border }]}>
        <Feather name="search" size={15} color={props.theme.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search or command: status:error saved:true @user"
          placeholderTextColor={props.theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: props.theme.text }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={15} color={props.theme.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          const count =
            item.id === "all" ? stats.total :
            item.id === "ok" ? stats.success :
            item.id === "failed" ? stats.error :
            item.id === "ig" ? stats.ig :
            item.id === "saved" ? stats.saved : stats.pass;
          return (
            <Pressable
              key={item.id}
              onPress={async () => {
                setFilter(item.id);
                await haptic();
              }}
              style={[
                styles.filterChip,
                {
                  borderColor: active ? props.theme.cyan : props.theme.border,
                  backgroundColor: active ? props.theme.cyan + "12" : props.theme.card
                }
              ]}
            >
              <Feather name={item.icon} size={12} color={active ? props.theme.cyan : props.theme.muted} />
              <Text style={{ color: active ? props.theme.cyan : props.theme.secondary, fontSize: 10, fontWeight: "800" }}>{item.label}</Text>
              <Text style={{ color: props.theme.muted, fontSize: 9 }}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={props.syncing}
            onRefresh={props.onSync}
            tintColor={props.theme.primary}
            colors={[props.theme.primary]}
          />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <UIDCard
            entry={item}
            userId={props.userId}
            theme={props.theme}
            prefs={props.prefs}
            showPassword={showPasswords}
            selected={selected.has(item.id)}
            onSelect={toggleSelect}
            onSaved={props.onSaved}
            onFetch={(entry) => props.onFetch([entry])}
            onDelete={props.onDelete}
            onOpen={setInspector}
            fetching={props.fetchingIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
            <View style={[styles.emptyIcon, { borderColor: props.theme.edge, backgroundColor: props.theme.primary + "0d" }]}>
              <MaterialCommunityIcons name="database-search-outline" size={30} color={props.theme.primary} />
            </View>
            <Text style={{ color: props.theme.text, fontWeight: "900", fontSize: 16, marginTop: 12 }}>No matching UIDs</Text>
            <Text style={{ color: props.theme.muted, fontSize: 12, marginTop: 5, textAlign: "center", maxWidth: 270 }}>
              {props.uids.length ? "Try another filter or command." : "Import your first UID list to start the workspace."}
            </Text>
            {!props.uids.length ? (
              <Pressable style={[styles.importButton, { backgroundColor: props.theme.primary }]} onPress={props.onGoImport}>
                <Feather name="upload" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Import UIDs</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Animated.View
        pointerEvents={selected.size ? "auto" : "none"}
        style={[
          styles.bulkBar,
          {
            backgroundColor: props.theme.card,
            borderColor: props.theme.edge,
            transform: [{ translateY: toolbarY }]
          }
        ]}
      >
        <View style={[styles.bulkCount, { backgroundColor: props.theme.cyan + "16" }]}>
          <Text style={{ color: props.theme.cyan, fontSize: 11, fontWeight: "900" }}>{selected.size}</Text>
        </View>
        <BulkAction icon="copy" label="Copy" color={props.theme.text} onPress={copySelected} />
        <BulkAction icon="star" label="Save" color={props.theme.warning} onPress={() => props.onSaveMany(Array.from(selected))} />
        <BulkAction icon="refresh-cw" label="Retry" color={props.theme.primary} onPress={bulkRetry} />
        <BulkAction icon="trash-2" label="Delete" color={props.theme.error} onPress={bulkDelete} />
        <Pressable hitSlop={8} onPress={clearSelection} style={styles.bulkClose}>
          <Feather name="x" size={17} color={props.theme.muted} />
        </Pressable>
      </Animated.View>

      <ProfileInspector
        visible={Boolean(inspector)}
        onClose={() => setInspector(null)}
        entry={inspector}
        userId={props.userId}
        theme={props.theme}
        prefs={props.prefs}
        vault={props.vault}
        authorizeSensitive={props.onAuthorizeSensitive}
        onSaved={props.onSaved}
        onFetch={(entry) => props.onFetch([entry])}
        onDelete={props.onDelete}
        onCollection={props.onCollection}
      />
    </View>
  );
}

function Stat({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    scale.setValue(0.88);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 250 }).start();
  }, [scale, value]);

  return (
    <View style={styles.stat}>
      <Feather name={icon} size={12} color={color} />
      <Text style={{ color, fontSize: 9, fontWeight: "800" }}>{label}</Text>
      <Animated.Text style={{ color, fontSize: 13, fontWeight: "900", transform: [{ scale }] }}>{value}</Animated.Text>
    </View>
  );
}

function BulkAction({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bulkAction, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={{ color, fontSize: 8, fontWeight: "800", marginTop: 2 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 92 },
  dashboard: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 11, overflow: "hidden" },
  dashboardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  dashboardLabel: { fontSize: 8, letterSpacing: 1.5, fontWeight: "900" },
  dashboardTitle: { fontSize: 15, fontWeight: "900", marginTop: 2 },
  dashboardActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  squareButton: { width: 32, height: 32, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sortButton: { height: 32, borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  collapse: { width: 26, height: 32, alignItems: "center", justifyContent: "center" },
  statGrid: { flexDirection: "row", justifyContent: "space-between", gap: 5, marginTop: 14 },
  stat: { alignItems: "center", gap: 2, minWidth: 42 },
  syncStrip: { minHeight: 31, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  syncLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  retryMini: { flexDirection: "row", alignItems: "center", gap: 5 },
  searchWrap: { height: 44, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, gap: 8, marginBottom: 9 },
  searchInput: { flex: 1, minWidth: 0, height: 44, fontSize: 12 },
  filters: { gap: 7, paddingBottom: 12, paddingRight: 14 },
  filterChip: { height: 32, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  empty: { minHeight: 250, borderWidth: 1, borderStyle: "dashed", borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  importButton: { height: 38, borderRadius: 10, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16 },
  bulkBar: { position: "absolute", left: 12, right: 12, bottom: 10, height: 62, borderWidth: 1, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 9, elevation: 28, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
  bulkCount: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 4 },
  bulkAction: { flex: 1, alignItems: "center", justifyContent: "center" },
  bulkClose: { width: 28, height: 36, alignItems: "center", justifyContent: "center" }
});
