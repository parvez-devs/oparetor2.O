import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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
  onClear: () => void;
  onGoImport: () => void;
}

export function HomeScreen(props: Props) {
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

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
      pending: props.uids.filter((u) => u.status === "pending").length,
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
    setMenuOpen(false);
  };

  const menuAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const header = (
    <View>
      <View style={[styles.statsBar, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsLeft}
          style={{ flex: 1 }}
        >
          <Text style={[styles.statMain, { color: props.theme.text }]}>Total: {stats.total}</Text>
          <Text style={{ color: props.theme.success, fontSize: 12 }}>✓ {stats.success}</Text>
          <Text style={{ color: props.theme.primary, fontSize: 12 }}>▣ {stats.pic}</Text>
          <Text style={{ color: "#d946ef", fontSize: 12, fontWeight: "800" }}>IG {stats.ig}</Text>
          <Text style={{ color: props.theme.error, fontSize: 12 }}>! {stats.error}</Text>
        </ScrollView>

        <View style={[styles.statsActions, { borderLeftColor: props.theme.border }]}>
          <Pressable
            onPress={() => setShowPasswords((value) => !value)}
            style={[
              styles.iconButton,
              { borderColor: showPasswords ? props.theme.primary : props.theme.border },
              showPasswords && { backgroundColor: props.theme.primary }
            ]}
          >
            <Text style={{ color: showPasswords ? "#fff" : props.theme.muted, fontSize: 14 }}>
              {showPasswords ? "◉" : "◎"}
            </Text>
          </Pressable>

          {stats.error > 0 ? (
            <Pressable
              onPress={() => props.onFetch(props.uids.filter((u) => u.status === "error"))}
              style={[styles.retryButton, { backgroundColor: props.theme.border }]}
            >
              <Text style={{ color: props.theme.text, fontSize: 11 }}>↻ Retry</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => setMenuOpen(true)} style={styles.moreButton}>
            <Text style={{ color: props.theme.muted, fontSize: 20, lineHeight: 20 }}>•••</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
        <Text style={[styles.searchIcon, { color: props.theme.muted }]}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by UID, name, or username..."
          placeholderTextColor={props.theme.muted}
          style={[styles.search, { color: props.theme.text }]}
        />
      </View>
    </View>
  );

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
            fetching={props.fetchingIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: props.theme.border, backgroundColor: props.theme.card }]}>
            <Text style={{ color: props.theme.muted, fontSize: 34, opacity: 0.55 }}>♙</Text>
            <Text style={{ color: props.theme.text, fontWeight: "700", fontSize: 16, marginTop: 8 }}>No UIDs found</Text>
            <Text style={{ color: props.theme.muted, marginTop: 5, textAlign: "center", maxWidth: 250, fontSize: 13 }}>
              {props.uids.length ? "No UIDs match your search." : "Your list is empty. Import some UIDs to get started."}
            </Text>
            {!props.uids.length ? (
              <Pressable style={[styles.importButton, { backgroundColor: props.theme.primary }]} onPress={props.onGoImport}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>＋  Import Now</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.menu, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}
          >
            {stats.pending > 0 ? (
              <MenuRow
                theme={props.theme}
                text={"Fetch All Pending (" + stats.pending + ")"}
                onPress={() => menuAction(() => props.onFetch(props.uids.filter((u) => u.status === "pending")))}
              />
            ) : null}
            {stats.error > 0 ? (
              <MenuRow
                theme={props.theme}
                text={"Retry All Failed (" + stats.error + ")"}
                onPress={() => menuAction(() => props.onFetch(props.uids.filter((u) => u.status === "error")))}
              />
            ) : null}
            {(stats.pending > 0 || stats.error > 0) ? <View style={[styles.menuDivider, { backgroundColor: props.theme.border }]} /> : null}
            <MenuRow theme={props.theme} text="Select All" onPress={() => menuAction(() => setSelected(new Set(props.uids.map((u) => u.id))))} />
            <MenuRow theme={props.theme} text="Deselect All" onPress={() => menuAction(() => setSelected(new Set()))} />
            <MenuRow
              theme={props.theme}
              text="Copy Selected (UID only)"
              disabled={!selected.size}
              onPress={() => copySelected(false)}
            />
            <MenuRow
              theme={props.theme}
              text="Copy Selected (uid|pass)"
              disabled={!selected.size}
              onPress={() => copySelected(true)}
            />
            <View style={[styles.menuDivider, { backgroundColor: props.theme.border }]} />
            <MenuRow
              theme={props.theme}
              text="Delete All"
              danger
              onPress={() => {
                setMenuOpen(false);
                Alert.alert("Delete all UIDs?", undefined, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete All", style: "destructive", onPress: props.onClear }
                ]);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuRow({
  text,
  theme,
  onPress,
  disabled,
  danger
}: {
  text: string;
  theme: Theme;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}>
      <Text style={{ color: danger ? theme.error : theme.text, fontSize: 12, opacity: disabled ? 0.4 : 1 }}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 24 },
  statsBar: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12
  },
  statsLeft: { alignItems: "center", gap: 12, paddingRight: 8 },
  statMain: { fontSize: 12, fontWeight: "700", fontFamily: "monospace" },
  statsActions: { flexDirection: "row", alignItems: "center", gap: 6, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 8 },
  iconButton: { width: 28, height: 28, borderWidth: 1, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  retryButton: { height: 28, borderRadius: 7, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  moreButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  searchWrap: {
    height: 42,
    borderWidth: 1,
    borderRadius: 9,
    marginBottom: 12,
    position: "relative",
    justifyContent: "center"
  },
  searchIcon: { position: "absolute", left: 11, fontSize: 17, zIndex: 1 },
  search: { height: 42, paddingLeft: 35, paddingRight: 12, fontSize: 13 },
  empty: {
    minHeight: 220,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  importButton: { borderRadius: 7, height: 36, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginTop: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "flex-end", paddingTop: 92, paddingRight: 12 },
  menu: { width: 218, borderWidth: 1, borderRadius: 10, paddingVertical: 5, elevation: 16 },
  menuRow: { minHeight: 36, paddingHorizontal: 12, justifyContent: "center" },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 }
});
