import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { UIDCard } from "../components/UIDCard";
import { getPassword } from "../storage";
import type { Preferences, UIDEntry } from "../types";
import type { Theme } from "../theme";

interface Props {
  userId: string;
  uids: UIDEntry[];
  prefs: Preferences;
  theme: Theme;
  fetchingIds: Set<string>;
  syncing: boolean;
  onSync: () => void;
  onFetch: (entries: UIDEntry[]) => void;
  onDelete: (id: string) => void;
  onSaved: (id: string) => void;
  onGoImport: () => void;
}

export function HomeScreen(props: Props) {
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.uids
      .filter(
        (u) =>
          !q ||
          u.uid.toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q) ||
          (u.username || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (b.fetchedAt || "").localeCompare(a.fetchedAt || ""));
  }, [props.uids, search]);

  const stats = useMemo(
    () => ({
      total: props.uids.length,
      success: props.uids.filter((u) => u.status === "success").length,
      error: props.uids.filter((u) => u.status === "error").length,
      pic: props.uids.filter((u) => Boolean(u.profilePic)).length,
      ig: props.uids.filter((u) => Boolean(u.hasInstagram)).length
    }),
    [props.uids]
  );

  const toggleSelect = (id: string) => {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySelected = async (withPass: boolean) => {
    const rows = props.uids.filter((u) => selected.has(u.id));
    if (!rows.length) return;
    const lines = await Promise.all(
      rows.map(async (u) => {
        if (!withPass) return u.uid;
        const pass = u.hasPassword ? await getPassword(props.userId, u.id) : "";
        return u.uid + "|" + (pass || "");
      })
    );
    await Clipboard.setStringAsync(lines.join("\n"));
  };

  const failed = props.uids.filter((u) => u.status === "error");

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={props.syncing}
            onRefresh={props.onSync}
            tintColor={props.theme.primary}
            colors={[props.theme.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={[styles.stats, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
              <Text style={[styles.statMain, { color: props.theme.text }]}>Total {stats.total}</Text>
              <Text style={{ color: props.theme.success }}>✓ {stats.success}</Text>
              <Text style={{ color: props.theme.primary }}>▣ {stats.pic}</Text>
              <Text style={{ color: "#d946ef", fontWeight: "800" }}>IG {stats.ig}</Text>
              <Text style={{ color: props.theme.error }}>! {stats.error}</Text>
              <View style={{ flexGrow: 1 }} />
              <Pressable onPress={() => setShowPasswords((v) => !v)} style={styles.smallButton}>
                <Text style={{ color: showPasswords ? props.theme.primary : props.theme.secondary }}>
                  {showPasswords ? "Hide pass" : "Show pass"}
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search UID, name or username…"
              placeholderTextColor={props.theme.muted}
              style={[
                styles.search,
                {
                  backgroundColor: props.theme.card,
                  borderColor: props.theme.border,
                  color: props.theme.text
                }
              ]}
            />

            <View style={styles.toolbar}>
              {failed.length ? (
                <Pressable style={[styles.tool, { borderColor: props.theme.border }]} onPress={() => props.onFetch(failed)}>
                  <Text style={{ color: props.theme.primary }}>↻ Retry {failed.length}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.tool, { borderColor: props.theme.border }]}
                onPress={() =>
                  setSelected(
                    selected.size === props.uids.length ? new Set() : new Set(props.uids.map((u) => u.id))
                  )
                }
              >
                <Text style={{ color: props.theme.secondary }}>
                  {selected.size ? selected.size + " selected" : "Select"}
                </Text>
              </Pressable>
              {selected.size ? (
                <>
                  <Pressable style={[styles.tool, { borderColor: props.theme.border }]} onPress={() => copySelected(false)}>
                    <Text style={{ color: props.theme.primary }}>Copy UID</Text>
                  </Pressable>
                  <Pressable style={[styles.tool, { borderColor: props.theme.border }]} onPress={() => copySelected(true)}>
                    <Text style={{ color: props.theme.primary }}>UID|Pass</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </>
        }
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
            fetching={props.fetchingIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: props.theme.border, backgroundColor: props.theme.card }]}>
            <Text style={{ color: props.theme.text, fontWeight: "800", fontSize: 17 }}>No UIDs found</Text>
            <Text style={{ color: props.theme.muted, marginTop: 5, textAlign: "center" }}>
              {props.uids.length ? "No UID matches your search." : "Import UIDs to get started."}
            </Text>
            {!props.uids.length ? (
              <Pressable style={[styles.importButton, { backgroundColor: props.theme.primary }]} onPress={props.onGoImport}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Import now</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 24 },
  stats: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10
  },
  statMain: { fontWeight: "800" },
  smallButton: { paddingVertical: 4, paddingHorizontal: 5 },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    marginBottom: 9
  },
  toolbar: { flexDirection: "row", gap: 7, flexWrap: "wrap", marginBottom: 10 },
  tool: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  empty: {
    minHeight: 220,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  importButton: { borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 }
});
