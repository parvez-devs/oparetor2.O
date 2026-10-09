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
import { formatCount } from "../utils";

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
  const y = useRef(new Animated.Value(8)).current;
  const x = useRef(new Animated.Value(0)).current;
  const [password, setPassword] = useState<string | null>(null);

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
          prefs.swipeToDelete &&
          g.dx < -12 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => {
          if (!prefs.swipeToDelete) return;
          x.setValue(Math.max(-110, Math.min(0, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          if (prefs.swipeToDelete && g.dx < -78) {
            Animated.timing(x, {
              toValue: -420,
              duration: 180,
              useNativeDriver: true
            }).start(() => onDelete(entry.id));
          } else {
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 5
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        }
      }),
    [entry.id, onDelete, prefs.swipeToDelete, x]
  );

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Vibration.vibrate(8);
  };

  const copyPass = async () => {
    const value = password || (await getPassword(userId, entry.id));
    if (value) await copy(value);
  };

  const initials = (entry.name || entry.uid).slice(0, 2).toUpperCase();
  const compact = prefs.viewMode === "compact";

  return (
    <View style={styles.swipeWrap}>
      {prefs.swipeToDelete ? (
        <View style={[styles.deleteBehind, { backgroundColor: theme.error + "22" }]}>
          <Text style={{ color: theme.error, fontWeight: "800" }}>DELETE</Text>
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
        <View style={styles.topRow}>
          {onSelect ? (
            <Pressable
              onPress={() => onSelect(entry.id)}
              style={[
                styles.check,
                { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : "transparent" }
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{selected ? "✓" : ""}</Text>
            </Pressable>
          ) : null}

          {entry.profilePic ? (
            <Image
              source={{ uri: entry.profilePic }}
              style={[
                styles.avatar,
                compact && styles.avatarCompact,
                { borderColor: theme.border }
              ]}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                compact && styles.avatarCompact,
                styles.avatarFallback,
                { borderColor: theme.border, backgroundColor: theme.input }
              ]}
            >
              <Text style={{ color: theme.muted, fontWeight: "800" }}>{initials}</Text>
            </View>
          )}

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                {entry.name || entry.uid}
              </Text>
              <Pressable onPress={() => onSaved(entry.id)} hitSlop={8}>
                <Text style={{ color: entry.saved ? theme.warning : theme.muted, fontSize: 20 }}>
                  {entry.saved ? "★" : "☆"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.badge,
                  {
                    color:
                      entry.status === "success"
                        ? theme.success
                        : entry.status === "error"
                          ? theme.error
                          : theme.muted,
                    borderColor:
                      entry.status === "success"
                        ? theme.success + "44"
                        : entry.status === "error"
                          ? theme.error + "44"
                          : theme.border
                  }
                ]}
              >
                {fetching ? "FETCHING" : entry.status === "success" ? "OK" : entry.status === "error" ? "ERR" : "WAIT"}
              </Text>
              {entry.username ? (
                <Pressable onPress={() => copy(entry.username || "")}>
                  <Text numberOfLines={1} style={{ color: theme.secondary, fontSize: 12 }}>
                    {"@" + entry.username}
                  </Text>
                </Pressable>
              ) : null}
              {entry.followerCount !== undefined ? (
                <Text style={{ color: theme.muted, fontSize: 11 }}>
                  {formatCount(entry.followerCount) + " followers"}
                </Text>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.valueRow}>
              <Text style={[styles.label, { color: theme.muted }]}>UID</Text>
              <Pressable style={styles.valuePress} onPress={() => copy(entry.uid)}>
                <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>
                  {entry.uid}
                </Text>
              </Pressable>
              <Pressable onPress={() => copy(entry.uid)} hitSlop={8}>
                <Text style={{ color: theme.primary, fontWeight: "700" }}>COPY</Text>
              </Pressable>
            </View>

            {entry.hasPassword ? (
              <View style={styles.valueRow}>
                <Text style={[styles.label, { color: theme.muted }]}>PASS</Text>
                <Pressable style={styles.valuePress} onPress={copyPass}>
                  <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>
                    {showPassword ? password || "Loading…" : "••••••••"}
                  </Text>
                </Pressable>
                <Pressable onPress={copyPass} hitSlop={8}>
                  <Text style={{ color: theme.primary, fontWeight: "700" }}>COPY</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.actions, { borderTopColor: theme.border }]}>
          <Pressable style={styles.action} onPress={() => onFetch(entry)}>
            <Text style={{ color: theme.primary, fontWeight: "700" }}>{fetching ? "Fetching…" : "↻ Fetch"}</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => Linking.openURL("https://www.facebook.com/" + encodeURIComponent(entry.uid))}
          >
            <Text style={{ color: theme.secondary, fontWeight: "700" }}>Facebook</Text>
          </Pressable>
          {entry.username && entry.hasInstagram ? (
            <Pressable
              style={styles.action}
              onPress={() => Linking.openURL("https://www.instagram.com/" + entry.username + "/")}
            >
              <Text style={{ color: "#d946ef", fontWeight: "700" }}>Instagram</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.action} onPress={() => onDelete(entry.id)}>
            <Text style={{ color: theme.error, fontWeight: "700" }}>Delete</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeWrap: { marginBottom: 9, position: "relative" },
  deleteBehind: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 20
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden"
  },
  topRow: { flexDirection: "row", padding: 12, gap: 10, alignItems: "flex-start" },
  check: {
    width: 19,
    height: 19,
    borderWidth: 1.5,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 2
  },
  avatarCompact: { width: 54, height: 54 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" },
  badge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "800"
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 24 },
  label: { width: 34, fontSize: 10, fontWeight: "700" },
  valuePress: { flex: 1 },
  value: { fontSize: 12, fontFamily: "monospace" },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  action: { paddingHorizontal: 8, paddingVertical: 7 }
});
