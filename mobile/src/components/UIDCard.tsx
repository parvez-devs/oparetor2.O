import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import type { Preferences, UIDEntry } from "../types";
import type { Theme } from "../theme";
import { getPassword } from "../storage";

function decodeName(value: string) {
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
  onOpen: (entry: UIDEntry) => void;
  fetching?: boolean;
}

function UIDCardImpl({
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
  onOpen,
  fetching
}: Props) {
  const appear = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;
  const starScale = useRef(new Animated.Value(1)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [password, setPassword] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  const compact = prefs.viewMode === "compact";
  const displayName = decodeName(entry.name || entry.uid);
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (prefs.reduceMotion) {
      appear.setValue(1);
      return;
    }
    Animated.spring(appear, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 190,
      mass: 0.8
    }).start();
  }, [appear, prefs.reduceMotion]);

  useEffect(() => {
    if (entry.status === "error" && !prefs.reduceMotion) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse, { toValue: 0.45, duration: 560, useNativeDriver: true }),
          Animated.timing(statusPulse, { toValue: 1, duration: 560, useNativeDriver: true })
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    statusPulse.setValue(1);
  }, [entry.status, prefs.reduceMotion, statusPulse]);

  useEffect(() => {
    let active = true;
    if (showPassword && entry.hasPassword) {
      getPassword(userId, entry.id).then((value) => active && setPassword(value));
    } else {
      setPassword(null);
    }
    return () => { active = false; };
  }, [showPassword, entry.hasPassword, entry.id, userId]);

  useEffect(() => {
    if (prefs.reduceMotion) return;
    starScale.setValue(0.76);
    Animated.spring(starScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 9,
      stiffness: 280
    }).start();
  }, [entry.saved, prefs.reduceMotion, starScale]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          prefs.swipeToDelete &&
          g.dx < -10 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.7,
        onPanResponderMove: (_, g) => {
          const resistance = Math.max(-106, Math.min(0, g.dx * 0.82));
          x.setValue(resistance);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -72) {
            Animated.spring(x, {
              toValue: -390,
              useNativeDriver: true,
              damping: 20,
              stiffness: 220
            }).start(() => onDelete(entry.id));
          } else {
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: true,
              damping: 16,
              stiffness: 210
            }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
      }),
    [entry.id, onDelete, prefs.swipeToDelete, x]
  );

  const haptic = async () => {
    if (prefs.haptics) await Haptics.selectionAsync().catch(() => {});
  };

  const showToast = (message: string) => {
    setToast(message);
    toastOpacity.stopAnimation();
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.delay(760),
      Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true })
    ]).start();
  };

  const copy = async (value: string, label: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    await haptic();
    showToast(label + " copied");
  };

  const copyPassword = async () => {
    const value = password || (await getPassword(userId, entry.id));
    if (value) await copy(value, "Password");
  };

  const openFacebook = async () => {
    const appUrl = "fb://profile/" + entry.uid;
    try {
      await Linking.openURL(appUrl);
    } catch {
      await Linking.openURL("https://www.facebook.com/" + encodeURIComponent(entry.uid));
    }
  };

  const statusColor =
    entry.status === "success" ? theme.success :
    entry.status === "error" ? theme.error : theme.muted;

  const statusLabel = fetching ? "SYNC" : entry.status === "success" ? "OK" : entry.status === "error" ? "FAILED" : "WAIT";

  return (
    <View style={styles.wrap}>
      {prefs.swipeToDelete ? (
        <View style={[styles.deleteRail, { backgroundColor: theme.error + "1a" }]}>
          <Feather name="trash-2" size={19} color={theme.error} />
        </View>
      ) : null}

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: selected ? theme.cyan : theme.border,
            opacity: appear,
            transform: [
              { translateX: x },
              {
                translateY: appear.interpolate({
                  inputRange: [0, 1],
                  outputRange: [7, 0]
                })
              }
            ],
            shadowColor: theme.primary
          }
        ]}
      >
        <View style={[styles.edge, { backgroundColor: selected ? theme.cyan : theme.edge, opacity: selected ? 0.9 : 0.34 }]} />

        <Pressable
          onPress={() => onOpen(entry)}
          onLongPress={async () => {
            await haptic();
            setMenuOpen(true);
          }}
          delayLongPress={320}
          style={[styles.body, compact && styles.bodyCompact]}
        >
          {onSelect ? (
            <Pressable
              hitSlop={9}
              onPress={() => onSelect(entry.id)}
              style={[
                styles.check,
                {
                  borderColor: selected ? theme.cyan : theme.border,
                  backgroundColor: selected ? theme.cyan : "transparent"
                }
              ]}
            >
              {selected ? <Feather name="check" size={11} color="#00131a" /> : null}
            </Pressable>
          ) : null}

          {entry.profilePic ? (
            <Image
              source={entry.profilePic}
              recyclingKey={entry.profilePic}
              cachePolicy="memory-disk"
              contentFit="cover"
              transition={120}
              style={[
                styles.avatar,
                compact && styles.avatarCompact,
                { borderColor: theme.edge }
              ]}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                compact && styles.avatarCompact,
                styles.avatarFallback,
                { borderColor: theme.edge, backgroundColor: theme.input }
              ]}
            >
              <Text style={{ color: theme.secondary, fontSize: compact ? 11 : 13, fontWeight: "900" }}>
                {initials || "UID"}
              </Text>
            </View>
          )}

          <View style={styles.info}>
            <View style={styles.topLine}>
              <View style={styles.nameWrap}>
                <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact, { color: theme.text }]}>
                  {displayName}
                </Text>
                {entry.hasInstagram && entry.username ? (
                  <MaterialCommunityIcons name="instagram" size={14} color="#e04cf3" />
                ) : null}
              </View>

              <View style={styles.topActions}>
                <Animated.View style={{ transform: [{ scale: starScale }] }}>
                  <Pressable
                    hitSlop={8}
                    onPress={async () => {
                      await haptic();
                      onSaved(entry.id);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={entry.saved ? "star" : "star-outline"}
                      size={19}
                      color={entry.saved ? theme.warning : theme.muted}
                    />
                  </Pressable>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.status,
                    {
                      borderColor: statusColor + "55",
                      backgroundColor: statusColor + "12",
                      opacity: statusPulse
                    }
                  ]}
                >
                  {entry.status === "success" && !fetching ? <Feather name="check" size={9} color={statusColor} /> : null}
                  {fetching ? <MaterialCommunityIcons name="sync" size={10} color={statusColor} /> : null}
                  <Text style={{ color: statusColor, fontSize: 8, fontWeight: "900" }}>{statusLabel}</Text>
                </Animated.View>

                <Pressable
                  hitSlop={8}
                  onPress={async () => {
                    await haptic();
                    setMenuOpen(true);
                  }}
                >
                  <Feather name="more-vertical" size={17} color={theme.muted} />
                </Pressable>
              </View>
            </View>

            {(entry.username || entry.followerCount !== undefined || entry.collection) ? (
              <View style={styles.meta}>
                {entry.username ? (
                  <Text numberOfLines={1} style={{ color: theme.secondary, fontSize: 11, maxWidth: 126 }}>
                    @{entry.username}
                  </Text>
                ) : null}
                {entry.followerCount !== undefined ? (
                  <Text style={{ color: theme.muted, fontSize: 10 }}>
                    {entry.followerCount.toLocaleString()} followers
                  </Text>
                ) : null}
                {entry.collection ? (
                  <View style={[styles.collection, { borderColor: theme.cyan + "44", backgroundColor: theme.cyan + "0d" }]}>
                    <Text style={{ color: theme.cyan, fontSize: 8, fontWeight: "800" }}>{entry.collection}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.valueRow}>
              <Text style={[styles.label, { color: theme.muted }]}>UID</Text>
              <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>{entry.uid}</Text>
              <Pressable hitSlop={7} onPress={() => copy(entry.uid, "UID")}>
                <Feather name="copy" size={16} color={theme.primary} />
              </Pressable>
            </View>

            {entry.hasPassword ? (
              <View style={styles.valueRow}>
                <Text style={[styles.label, { color: theme.muted }]}>PASS</Text>
                <Text numberOfLines={1} style={[styles.value, { color: theme.text }]}>
                  {showPassword ? password || "Loading…" : "••••••••"}
                </Text>
                <Pressable hitSlop={7} onPress={copyPassword}>
                  <Feather name="copy" size={16} color={theme.primary} />
                </Pressable>
              </View>
            ) : null}

            {entry.status === "error" ? (
              <Pressable
                onPress={() => onFetch(entry)}
                style={[styles.inlineRetry, { borderColor: theme.error + "42", backgroundColor: theme.error + "0d" }]}
              >
                <Feather name="refresh-cw" size={11} color={theme.error} />
                <Text style={{ color: theme.error, fontSize: 10, fontWeight: "800" }}>Retry failed profile</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>

        <Animated.View pointerEvents="none" style={[styles.toast, { opacity: toastOpacity, backgroundColor: theme.text }]}>
          <Feather name="check" size={11} color={theme.bg} />
          <Text style={{ color: theme.bg, fontSize: 10, fontWeight: "800" }}>{toast}</Text>
        </Animated.View>
      </Animated.View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} maxHeight={420}>
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={{ color: theme.muted, fontFamily: "monospace", fontSize: 11, marginTop: 3 }}>{entry.uid}</Text>

          <SheetAction icon="user" label="Open profile inspector" color={theme.text} onPress={() => { setMenuOpen(false); onOpen(entry); }} />
          <SheetAction icon="refresh-cw" label={fetching ? "Fetching…" : "Fetch profile"} color={theme.primary} disabled={fetching} onPress={() => { setMenuOpen(false); onFetch(entry); }} />
          <SheetAction icon="facebook" label="Open Facebook" color={theme.primary} onPress={() => { setMenuOpen(false); openFacebook(); }} />
          {entry.username ? (
            <SheetAction icon="instagram" label="Open Instagram" color="#e04cf3" onPress={() => { setMenuOpen(false); Linking.openURL("https://www.instagram.com/" + entry.username + "/"); }} />
          ) : null}
          <SheetAction icon="copy" label="Copy UID" color={theme.text} onPress={() => { setMenuOpen(false); copy(entry.uid, "UID"); }} />
          <SheetAction icon={entry.saved ? "star" : "star-outline"} label={entry.saved ? "Remove from Saved" : "Save UID"} color={entry.saved ? theme.warning : theme.text} onPress={() => { setMenuOpen(false); onSaved(entry.id); }} />
          <View style={[styles.sheetDivider, { backgroundColor: theme.border }]} />
          <SheetAction icon="trash-can-outline" label="Delete" color={theme.error} onPress={() => { setMenuOpen(false); onDelete(entry.id); }} />
        </View>
      </BottomSheet>
    </View>
  );
}

function SheetAction({
  icon,
  label,
  color,
  onPress,
  disabled
}: {
  icon: any;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.6 }, disabled && { opacity: 0.35 }]}>
      <MaterialCommunityIcons name={icon} size={19} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 9, position: "relative" },
  deleteRail: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 22
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowOpacity: 0.11,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3
  },
  edge: { position: "absolute", top: 0, bottom: 0, left: 0, width: 2 },
  body: { flexDirection: "row", gap: 11, padding: 12, alignItems: "flex-start" },
  bodyCompact: { paddingVertical: 10 },
  check: { width: 18, height: 18, borderWidth: 1.4, borderRadius: 5, alignItems: "center", justifyContent: "center", marginTop: 25 },
  avatar: { width: 72, height: 72, borderRadius: 15, borderWidth: 1.5 },
  avatarCompact: { width: 56, height: 56, borderRadius: 13 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0, gap: 4 },
  topLine: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  nameWrap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 },
  name: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "900", letterSpacing: -0.15 },
  nameCompact: { fontSize: 13 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  status: { minHeight: 19, borderWidth: 1, borderRadius: 7, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, minHeight: 16 },
  collection: { height: 18, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 2 },
  valueRow: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 7 },
  label: { width: 31, fontSize: 9, fontWeight: "800", fontFamily: "monospace" },
  value: { flex: 1, minWidth: 0, fontSize: 11.5, fontFamily: "monospace" },
  inlineRetry: { height: 30, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 3 },
  toast: { position: "absolute", alignSelf: "center", bottom: 8, borderRadius: 13, paddingHorizontal: 9, height: 26, flexDirection: "row", alignItems: "center", gap: 5 },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 6 },
  sheetTitle: { fontSize: 16, fontWeight: "900", paddingTop: 2 },
  sheetAction: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 2 },
  sheetDivider: { height: StyleSheet.hairlineWidth, marginVertical: 3 }
});

export const UIDCard = memo(UIDCardImpl, (a, b) =>
  a.entry.id === b.entry.id &&
  a.entry.uid === b.entry.uid &&
  a.entry.name === b.entry.name &&
  a.entry.username === b.entry.username &&
  a.entry.profilePic === b.entry.profilePic &&
  a.entry.followerCount === b.entry.followerCount &&
  a.entry.hasInstagram === b.entry.hasInstagram &&
  a.entry.status === b.entry.status &&
  a.entry.saved === b.entry.saved &&
  a.entry.collection === b.entry.collection &&
  a.entry.hasPassword === b.entry.hasPassword &&
  a.showPassword === b.showPassword &&
  a.selected === b.selected &&
  a.fetching === b.fetching &&
  a.prefs.viewMode === b.prefs.viewMode &&
  a.prefs.swipeToDelete === b.prefs.swipeToDelete &&
  a.prefs.reduceMotion === b.prefs.reduceMotion
);
