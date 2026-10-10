import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { UIDCard } from "../components/UIDCard";
import { ProfileInspector } from "../components/ProfileInspector";
import { matchesCommandQuery, sortUIDs } from "../search";
import type { Preferences, UIDEntry, VaultConfig } from "../types";
import type { Theme } from "../theme";

interface Props {
  userId: string;
  uids: UIDEntry[];
  prefs: Preferences;
  theme: Theme;
  vault: VaultConfig;
  fetchingIds: Set<string>;
  onAuthorizeSensitive: () => Promise<boolean>;
  onFetch: (entries: UIDEntry[]) => void;
  onDelete: (id: string) => void;
  onSaved: (id: string) => void;
  onCollection: (id: string, collection?: string) => void;
  onGoHome: () => void;
}

export function SavedScreen(props: Props) {
  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [collection, setCollection] = useState("All");
  const [inspector, setInspector] = useState<UIDEntry | null>(null);

  const saved = useMemo(() => props.uids.filter((u) => u.saved), [props.uids]);
  const collections = useMemo(
    () => ["All", ...Array.from(new Set(saved.map((u) => u.collection).filter(Boolean) as string[]))],
    [saved]
  );

  const data = useMemo(() => {
    const filtered = saved.filter(
      (u) =>
        matchesCommandQuery(u, search) &&
        (collection === "All" || u.collection === collection)
    );
    return sortUIDs(filtered, "newest");
  }, [saved, search, collection]);

  const togglePasswords = async () => {
    if (showPassword) return setShowPassword(false);
    if (props.vault.requireForPassword && !(await props.onAuthorizeSensitive())) return;
    setShowPassword(true);
    if (props.prefs.haptics) await Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.starIcon, { backgroundColor: props.theme.warning + "12", borderColor: props.theme.warning + "44" }]}>
                  <MaterialCommunityIcons name="star" size={18} color={props.theme.warning} />
                </View>
                <View>
                  <Text style={[styles.title, { color: props.theme.text }]}>Saved Workspace</Text>
                  <Text style={{ color: props.theme.muted, fontSize: 9, marginTop: 2 }}>{saved.length} saved profiles</Text>
                </View>
              </View>

              {saved.length ? (
                <Pressable
                  onPress={togglePasswords}
                  style={[
                    styles.eye,
                    {
                      borderColor: showPassword ? props.theme.cyan : props.theme.border,
                      backgroundColor: showPassword ? props.theme.cyan + "12" : props.theme.card
                    }
                  ]}
                >
                  <Feather name={showPassword ? "eye-off" : "eye"} size={15} color={showPassword ? props.theme.cyan : props.theme.muted} />
                </Pressable>
              ) : null}
            </View>

            {saved.length ? (
              <>
                <View style={[styles.searchWrap, { backgroundColor: props.theme.input, borderColor: props.theme.border }]}>
                  <Feather name="search" size={14} color={props.theme.muted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search saved or use commands..."
                    placeholderTextColor={props.theme.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.search, { color: props.theme.text }]}
                  />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collections}>
                  {collections.map((item) => {
                    const active = collection === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => setCollection(item)}
                        style={[
                          styles.collection,
                          {
                            borderColor: active ? props.theme.cyan : props.theme.border,
                            backgroundColor: active ? props.theme.cyan + "12" : props.theme.card
                          }
                        ]}
                      >
                        <Feather name={item === "All" ? "grid" : "folder"} size={11} color={active ? props.theme.cyan : props.theme.muted} />
                        <Text style={{ color: active ? props.theme.cyan : props.theme.secondary, fontSize: 10, fontWeight: "800" }}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
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
            onOpen={setInspector}
            fetching={props.fetchingIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
            <View style={[styles.emptyIcon, { borderColor: props.theme.edge }]}>
              <MaterialCommunityIcons name="bookmark-multiple-outline" size={30} color={props.theme.primary} />
            </View>
            <Text style={{ color: props.theme.text, fontSize: 16, fontWeight: "900", marginTop: 12 }}>No saved profiles</Text>
            <Text style={{ color: props.theme.muted, fontSize: 12, textAlign: "center", marginTop: 5, maxWidth: 260 }}>
              {saved.length ? "No profiles match this collection or search." : "Star any UID from Home, then organize it into a workspace collection."}
            </Text>
            {!saved.length ? (
              <Pressable style={[styles.homeButton, { backgroundColor: props.theme.primary }]} onPress={props.onGoHome}>
                <Feather name="home" size={13} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Browse Home</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

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

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 34 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  starIcon: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 19, fontWeight: "900", letterSpacing: -0.35 },
  eye: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  searchWrap: { height: 43, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, marginBottom: 9 },
  search: { flex: 1, minWidth: 0, height: 43, fontSize: 12 },
  collections: { gap: 7, paddingBottom: 12, paddingRight: 14 },
  collection: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  empty: { minHeight: 250, borderWidth: 1, borderStyle: "dashed", borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  homeButton: { height: 38, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 15 }
});
