import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { BottomSheet } from "./BottomSheet";
import { getPassword } from "../storage";
import type { Preferences, UIDEntry, VaultConfig } from "../types";
import type { Theme } from "../theme";

const BUILTIN_COLLECTIONS = ["Important", "Clients", "Retry"];

export function ProfileInspector({
  visible,
  onClose,
  entry,
  userId,
  theme,
  prefs,
  vault,
  authorizeSensitive,
  onSaved,
  onFetch,
  onDelete,
  onCollection
}: {
  visible: boolean;
  onClose: () => void;
  entry: UIDEntry | null;
  userId: string;
  theme: Theme;
  prefs: Preferences;
  vault: VaultConfig;
  authorizeSensitive: () => Promise<boolean>;
  onSaved: (id: string) => void;
  onFetch: (entry: UIDEntry) => void;
  onDelete: (id: string) => void;
  onCollection: (id: string, collection?: string) => void;
}) {
  const [password, setPassword] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [preview, setPreview] = useState(false);
  const [customCollection, setCustomCollection] = useState("");

  useEffect(() => {
    setShowPass(false);
    setPassword(null);
    setCustomCollection("");
  }, [entry?.id]);

  if (!entry) return null;

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    if (prefs.haptics) await Haptics.selectionAsync().catch(() => {});
  };

  const revealPassword = async () => {
    if (vault.requireForPassword && !(await authorizeSensitive())) return;
    const value = await getPassword(userId, entry.id);
    setPassword(value);
    setShowPass(true);
  };

  const collectionOptions = Array.from(new Set([
    ...BUILTIN_COLLECTIONS,
    ...(entry.collection ? [entry.collection] : [])
  ]));

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} theme={theme}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Pressable onPress={() => entry.profilePic && setPreview(true)}>
              {entry.profilePic ? (
                <Image source={entry.profilePic} style={[styles.avatar, { borderColor: theme.edge }]} contentFit="cover" transition={180} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { borderColor: theme.edge, backgroundColor: theme.input }]}>
                  <Text style={{ color: theme.secondary, fontWeight: "900", fontSize: 26 }}>{(entry.name || entry.uid).slice(0,2).toUpperCase()}</Text>
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: theme.text }]}>{entry.name || entry.uid}</Text>
              {entry.username ? <Text style={{ color: theme.secondary, marginTop: 4 }}>@{entry.username}</Text> : null}
              <View style={styles.chips}>
                <Chip text={entry.status === "success" ? "OK" : entry.status === "error" ? "FAILED" : "WAIT"} color={entry.status === "success" ? theme.success : entry.status === "error" ? theme.error : theme.muted} />
                {entry.hasInstagram ? <Chip text="INSTAGRAM" color="#d946ef" /> : null}
                {entry.followerCount !== undefined ? <Chip text={entry.followerCount.toLocaleString() + " FOLLOWERS"} color={theme.primary} /> : null}
              </View>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: theme.card2, borderColor: theme.border }]}>
            <DetailRow label="UID" value={entry.uid} theme={theme} onCopy={() => copy(entry.uid)} />
            {entry.username ? <DetailRow label="USERNAME" value={"@" + entry.username} theme={theme} onCopy={() => copy(entry.username || "")} /> : null}
            <DetailRow label="FETCHED" value={entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleString() : "Not fetched"} theme={theme} />
            {entry.hasPassword ? (
              <DetailRow
                label="PASSWORD"
                value={showPass ? password || "No password found" : "••••••••"}
                theme={theme}
                onCopy={showPass && password ? () => copy(password) : undefined}
                actionLabel={showPass ? "HIDE" : "REVEAL"}
                onAction={() => showPass ? setShowPass(false) : revealPassword()}
              />
            ) : null}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.muted }]}>WORKSPACE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRow}>
            <CollectionPill active={!entry.collection} label="None" theme={theme} onPress={() => onCollection(entry.id, undefined)} />
            {collectionOptions.map((item) => (
              <CollectionPill key={item} active={entry.collection === item} label={item} theme={theme} onPress={() => onCollection(entry.id, item)} />
            ))}
          </ScrollView>
          <View style={[styles.customRow, { borderColor: theme.border, backgroundColor: theme.input }]}>
            <TextInput
              value={customCollection}
              onChangeText={setCustomCollection}
              placeholder="Custom collection..."
              placeholderTextColor={theme.muted}
              style={{ flex: 1, color: theme.text, fontSize: 12 }}
            />
            <Pressable
              onPress={() => {
                const value = customCollection.trim();
                if (value) onCollection(entry.id, value);
                setCustomCollection("");
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: "800", fontSize: 12 }}>SAVE</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Action label={entry.saved ? "★ Saved" : "☆ Save"} color={entry.saved ? theme.warning : theme.text} border={theme.border} onPress={() => onSaved(entry.id)} />
            <Action label="↻ Fetch" color={theme.primary} border={theme.border} onPress={() => onFetch(entry)} />
          </View>
          <View style={styles.actions}>
            <Action label="Facebook" color={theme.primary} border={theme.border} onPress={() => Linking.openURL("https://www.facebook.com/" + encodeURIComponent(entry.uid))} />
            <Action label="Instagram" color="#d946ef" border={theme.border} disabled={!entry.username} onPress={() => entry.username && Linking.openURL("https://www.instagram.com/" + entry.username + "/")} />
          </View>

          <Pressable
            style={[styles.delete, { borderColor: theme.error + "55" }]}
            onPress={() => {
              onClose();
              onDelete(entry.id);
            }}
          >
            <Text style={{ color: theme.error, fontWeight: "800" }}>Delete UID</Text>
          </Pressable>
        </ScrollView>
      </BottomSheet>

      <Modal visible={preview} transparent animationType="fade" onRequestClose={() => setPreview(false)}>
        <Pressable style={[styles.previewRoot, { backgroundColor: theme.overlay }]} onPress={() => setPreview(false)}>
          {entry.profilePic ? <Image source={entry.profilePic} style={styles.previewImage} contentFit="contain" transition={160} /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

function Chip({ text, color }: { text: string; color: string }) {
  return <View style={[styles.chip, { borderColor: color + "55", backgroundColor: color + "12" }]}><Text style={{ color, fontSize: 9, fontWeight: "800" }}>{text}</Text></View>;
}

function DetailRow({
  label, value, theme, onCopy, actionLabel, onAction
}: {
  label: string; value: string; theme: Theme; onCopy?: () => void; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
      <Text style={{ color: theme.muted, width: 78, fontSize: 10, fontWeight: "800" }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: theme.text, flex: 1, fontFamily: "monospace", fontSize: 12 }}>{value}</Text>
      {actionLabel && onAction ? <Pressable onPress={onAction}><Text style={{ color: theme.primary, fontSize: 10, fontWeight: "800" }}>{actionLabel}</Text></Pressable> : null}
      {onCopy ? <Pressable onPress={onCopy}><Text style={{ color: theme.primary, fontSize: 15 }}>⧉</Text></Pressable> : null}
    </View>
  );
}

function CollectionPill({ active, label, theme, onPress }: { active: boolean; label: string; theme: Theme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.collectionPill, { borderColor: active ? theme.cyan : theme.border, backgroundColor: active ? theme.cyan + "14" : theme.card2 }]}>
      <Text style={{ color: active ? theme.cyan : theme.secondary, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Action({ label, color, border, onPress, disabled }: { label: string; color: string; border: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.action, { borderColor: border, opacity: disabled ? 0.35 : 1 }]}>
      <Text style={{ color, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 12 },
  hero: { flexDirection: "row", gap: 14, alignItems: "center", paddingTop: 4, paddingBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 24, borderWidth: 1.5 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 19, fontWeight: "900", lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  panel: { borderWidth: 1, borderRadius: 15, overflow: "hidden" },
  detailRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  collectionRow: { gap: 7, paddingRight: 12 },
  collectionPill: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  customRow: { height: 42, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, marginTop: 9, gap: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  action: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  delete: { height: 42, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 12 },
  previewRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  previewImage: { width: "100%", height: "72%", borderRadius: 24 }
});
