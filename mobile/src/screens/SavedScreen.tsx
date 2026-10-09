import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
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
}

export function SavedScreen(props: Props) {
  const [search, setSearch] = useState("");
  const [showPassword] = useState(false);
  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.uids.filter(
      (u) =>
        u.saved &&
        (!q ||
          u.uid.toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q) ||
          (u.username || "").toLowerCase().includes(q))
    );
  }, [props.uids, search]);

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <Text style={[styles.title, { color: props.theme.text }]}>★ Saved UIDs</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search saved UIDs…"
            placeholderTextColor={props.theme.muted}
            style={[
              styles.search,
              {
                color: props.theme.text,
                backgroundColor: props.theme.card,
                borderColor: props.theme.border
              }
            ]}
          />
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
        <View style={styles.empty}>
          <Text style={{ color: props.theme.muted }}>No saved UIDs yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 24 },
  title: { fontSize: 21, fontWeight: "900", marginBottom: 12 },
  search: { height: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, marginBottom: 11 },
  empty: { paddingVertical: 70, alignItems: "center" }
});
