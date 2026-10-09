import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration
} from "react-native";
import * as Clipboard from "expo-clipboard";
import type { Preferences, UIDEntry } from "../types";
import type { Theme } from "../theme";
import { getPassword } from "../storage";

function decodeProfileName(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

interface Props {
  entry: UIDEntry;
  userId: string;
  theme: Theme;
  prefs: Preferences;
  showPassword: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onSaved: (id: string) => void;
  onFetch: (entry: UIDEntry) => void;
  onDelete: (id: string) => void;
  fetching?: boolean;
}

export function UIDCard({
  entry,
  userId,
  theme,
  prefs,
  showPassword,
  selected,
  onSelect,
  onSaved,
  onFetch,
  onDelete,
  fetching
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(7)).current;
  const x = useRef(new Animated.Value(0)).current;
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<"uid" | "pass" | "user" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true })
    ]).start();
  }, [opacity, y]);

  useEffect(() => {
    let active = true;
    if (showPassword && entry.hasPassword) {
      getPassword(userId, entry.id).then((value) => {
        if (active) setPassword(value);
      });
    } else {
      setPassword(null);
    }
    return () => {
      active = false;
    };
  }, [showPassword, entry.hasPassword, entry.id, userId]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          prefs.swipeToDelete && g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => {
          if (prefs.swipeToDelete) x.setValue(Math.max(-100, Math.min(0, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          if (prefs.swipeToDelete && g.dx < -60) {
            Animated.timing(x, { toValue: -420, duration: 170, useNativeDriver: true }).start(() => onDelete(entry.id));
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
      }),
    [entry.id, onDelete, prefs.swipeToDelete, x]
  );

  const copy = async (value: string, type: "uid" | "pass" | "user") => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(type);
    Vibration.vibrate(8);
    setTimeout(() => setCopied((current) => (current === type ? null : current)), 1600);
  };

  const copyPass = async () => {
    const value = password || (await getPassword(userId, entry.id));
    if (value) await copy(value, "pass");
  };

  const openFB = () => {
    Linking.openURL("fb://profile/" + entry.uid).catch(() =>
      Linking.openURL("https://www.facebook.com/" + encodeURIComponent(entry.uid))
    );
  };

  const displayName = decodeProfileName(entry.name || entry.uid);
  const initials = entry.name
    ? decodeProfileName(entry.name)
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : entry.uid.slice(0, 2);

  const statusText = fetching ? "Wait" : entry.status === "success" ? "OK" : entry.status === "error" ? "Err" : "Wait";
  const statusColor = entry.status === "success" ? theme.success : entry.status === "error" ? theme.error : theme.muted;

  return (
    <View style={styles.swipeWrap}>
      {prefs.swipeToDelete ? (
        <View style={[styles.deleteBehind, { backgroundColor: theme.error + "24" }]}>
          <Text style={{ color: theme.error, fontSize: 18 }}>⌫</Text>
        </View>
      ) : null}

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: selected ? theme.primary : theme.border,
            opacity,
            transform: [{ translateY: y }, { translateX: x }]
          }
        ]}
      >
        <View style={styles.body}>
          {onSelect ? (
            <View style={styles.checkColumn}>
              <Pressable
                onPress={() => onSelect(entry.id)}
                style={[
                  styles.check,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primary : "transparent"
                  }
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 10 }}>{selected ? "✓" : ""}</Text>
              </Pressable>
            </View>
          ) : null}

          {entry.profilePic ? (
            <Image source={{ uri: entry.profilePic }} style={[styles.avatar, { borderColor: theme.border }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { borderColor: theme.border, backgroundColor: theme.bg }]}>
              <Text style={{ color: theme.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 12 }}>{initials}</Text>
            </View>
          )}

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <View style={styles.nameLeft}>
                <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>{displayName}</Text>
                {entry.hasInstagram && entry.username ? (
                  <Pressable onPress={() => Linking.openURL("https://www.instagram.com/" + entry.username + "/")}>
                    <Text style={{ color: "#d946ef", fontSize: 16, lineHeight: 17 }}>◎</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.topActions}>
                <Pressable onPress={() => onSaved(entry.id)} hitSlop={8}>
                  <Text style={{ color: entry.saved ? theme.warning : theme.muted, fontSize: 20, lineHeight: 21 }}>
                    {entry.saved ? "★" : "☆"}
                  </Text>
                </Pressable>

                <View style={[styles.status, { borderColor: statusColor + "38", backgroundColor: statusColor + "14" }]}>
                  <View style={[styles.dot, { backgroundColor: statusColor }]} />
                  <Text style={{ color: statusColor, fontSize: 9, fontWeight: "700" }}>{statusText}</Text>
                </View>

                <Pressable onPress={() => setMenuOpen((value) => !value)} hitSlop={8}>
                  <Text style={{ color: theme.muted, fontSize: 21, lineHeight: 21 }}>⋮</Text>
                </Pressable>
              </View>

              {menuOpen ? (
                <View style={[styles.cardMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Pressable
                    disabled={fetching}
                    onPress={() => {
                      setMenuOpen(false);
                      onFetch(entry);
                    }}
                    style={styles.cardMenuRow}
                  >
                    <Text style={{ color: theme.text, fontSize: 12 }}>{fetching ? "↻  Fetching…" : "↻  Fetch"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      openFB();
                    }}
                    style={styles.cardMenuRow}
                  >
                    <Text style={{ color: theme.text, fontSize: 12 }}>↗  Open FB Profile</Text>
                  </Pressable>
                  <View style={[styles.cardMenuDivider, { backgroundColor: theme.border }]} />
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onDelete(entry.id);
                    }}
                    style={styles.cardMenuRow}
                  >
                    <Text style={{ color: theme.error, fontSize: 12 }}>⌫  Delete</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {(entry.username || entry.followerCount !== undefined) ? (
              <View style={styles.metaRow}>
                {entry.username ? (
                  <Pressable onPress={() => copy(entry.username || "", "user")} style={styles.usernameRow}>
                    <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 11, maxWidth: 115 }}>
                      {"@" + entry.username}
                    </Text>
                    <Text style={{ color: copied === "user" ? theme.success : theme.muted, fontSize: 10 }}>
                      {copied === "user" ? "✓" : "⧉"}
                    </Text>
                  </Pressable>
                ) : null}
                {entry.username && entry.followerCount !== undefined ? (
                  <Text style={{ color: theme.muted, fontSize: 10 }}>•</Text>
                ) : null}
                {entry.followerCount !== undefined ? (
                  <Text style={{ color: theme.muted, fontSize: 11 }}>{entry.followerCount.toLocaleString()} followers</Text>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.valueRow}>
              <Text style={[styles.label, { color: theme.muted }]}>UID</Text>
              <Pressable style={styles.valuePress} onPress={() => copy(entry.uid, "uid")}>
                <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>{entry.uid}</Text>
              </Pressable>
              <Pressable onPress={() => copy(entry.uid, "uid")} hitSlop={8} style={styles.copyButton}>
                <Text style={{ color: copied === "uid" ? theme.success : theme.muted, fontSize: 19 }}>
                  {copied === "uid" ? "✓" : "⧉"}
                </Text>
              </Pressable>
            </View>

            {entry.hasPassword ? (
              <View style={styles.valueRow}>
                <Text style={[styles.label, { color: theme.muted }]}>Pass</Text>
                <Pressable style={styles.valuePress} onPress={copyPass}>
                  <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>
                    {showPassword ? password || "Loading…" : "••••••••"}
                  </Text>
                </Pressable>
                <Pressable onPress={copyPass} hitSlop={8} style={styles.copyButton}>
                  <Text style={{ color: copied === "pass" ? theme.success : theme.muted, fontSize: 19 }}>
                    {copied === "pass" ? "✓" : "⧉"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeWrap: { marginBottom: 8, position: "relative" },
  deleteBehind: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 18
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    position: "relative",
    elevation: 1
  },
  body: { flexDirection: "row", gap: 12, padding: 12, alignItems: "flex-start" },
  checkColumn: { height: 72, justifyContent: "center" },
  check: {
    width: 17,
    height: 17,
    borderWidth: 1.3,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  avatar: { width: 72, height: 72, borderRadius: 12, borderWidth: 2 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, position: "relative" },
  nameLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flex: 1, fontSize: 14, fontWeight: "800", lineHeight: 17 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 },
  status: { minHeight: 20, borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  cardMenu: {
    position: "absolute",
    right: 0,
    top: 26,
    width: 150,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 4,
    zIndex: 100,
    elevation: 20
  },
  cardMenuRow: { minHeight: 36, paddingHorizontal: 12, justifyContent: "center" },
  cardMenuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 16 },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 2 },
  valueRow: { minHeight: 27, flexDirection: "row", alignItems: "center", gap: 6 },
  label: { width: 28, fontSize: 10, fontFamily: "monospace" },
  valuePress: { flex: 1, minWidth: 0 },
  value: { fontSize: 12, fontFamily: "monospace" },
  copyButton: { width: 28, height: 27, alignItems: "center", justifyContent: "center" }
});
