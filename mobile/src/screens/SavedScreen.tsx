import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UIDCard } from "../components/UIDCard";
import type { Preferences, UIDEntry } from "../types";
import type { Theme } from "../theme";

interface Props {
  userId: string;
  uids: UIDEntry[];
  prefs: Preferences;
  theme: Theme;
  fetchingIds: Set<string>;
  onFetch: (entries: UIDEntry[]) => void;
  onDelete: (id: string) => void;
  onSaved: (id: string) => void;
  onGoHome: () => void;
}

export function SavedScreen(props: Props) {
  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const saved = useMemo(() => props.uids.filter((u) => u.saved), [props.uids]);
  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return saved
      .filter(
        (u) =>
          !q ||
          u.uid.toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q) ||
          (u.username || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (b.fetchedAt || "").localeCompare(a.fetchedAt || ""));
  }, [saved, search]);

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={{ color: props.theme.warning, fontSize: 21 }}>★</Text>
              <Text style={[styles.title, { color: props.theme.text }]}>Saved UIDs</Text>
              <View style={[styles.badge, { backgroundColor: props.theme.border }]}>
                <Text style={{ color: props.theme.text, fontSize: 11 }}>{saved.length}</Text>
              </View>
            </View>

            {saved.length > 0 ? (
              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                style={[
                  styles.eyeButton,
                  { borderColor: showPassword ? props.theme.primary : props.theme.border },
                  showPassword && { backgroundColor: props.theme.primary }
                ]}
              >
                <Text style={{ color: showPassword ? "#fff" : props.theme.muted, fontSize: 15 }}>
                  {showPassword ? "◉" : "◎"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {saved.length > 0 ? (
            <View style={[styles.searchWrap, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
              <Text style={[styles.searchIcon, { color: props.theme.muted }]}>⌕</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search saved UIDs..."
                placeholderTextColor={props.theme.muted}
                style={[styles.search, { color: props.theme.text }]}
              />
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <UIDCard
          entry={item}
          userId={props.userId}
          theme={props.theme}
          prefs={props.prefs}
          showPassword={showPassword}
          onSaved={props.onSaved}
          onFetch={(entry) => props.onFetch([entry])}
          onDelete={props.onDelete}
          fetching={props.fetchingIds.has(item.id)}
        />
      )}
      ListEmptyComponent={
        <View style={[styles.empty, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
          <Text style={{ color: props.theme.muted, fontSize: 34, opacity: 0.55 }}>♧</Text>
          <Text style={{ color: props.theme.text, fontSize: 16, fontWeight: "700", marginTop: 8 }}>No saved UIDs</Text>
          <Text style={{ color: props.theme.muted, fontSize: 13, marginTop: 5, textAlign: "center", maxWidth: 250 }}>
            {saved.length === 0 ? "Star a UID on the Home tab to save it here." : "No saved UIDs match your search."}
          </Text>
          {saved.length === 0 ? (
            <Pressable style={[styles.homeButton, { backgroundColor: props.theme.primary }]} onPress={props.onGoHome}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Browse Home</Text>
            </Pressable>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 24 },
  header: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "800" },
  badge: { minWidth: 26, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  eyeButton: { width: 32, height: 32, borderWidth: 1, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  searchWrap: { height: 42, borderWidth: 1, borderRadius: 9, marginBottom: 12, position: "relative", justifyContent: "center" },
  searchIcon: { position: "absolute", left: 11, fontSize: 17, zIndex: 1 },
  search: { height: 42, paddingLeft: 35, paddingRight: 12, fontSize: 13 },
  empty: {
    minHeight: 230,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  homeButton: { height: 36, borderRadius: 7, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginTop: 16 }
});
