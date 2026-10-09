import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Preferences } from "../types";
import type { Theme } from "../theme";

interface ParsedLine {
  raw: string;
  uid: string;
  password?: string;
  valid: boolean;
  duplicate: boolean;
}

export function ImportScreen({
  theme,
  prefs,
  existingUIDs,
  onImport
}: {
  theme: Theme;
  prefs: Preferences;
  existingUIDs: string[];
  onImport: (text: string, fetchAfter: boolean) => Promise<number>;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fetchAfter, setFetchAfter] = useState(true);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const shine = useRef(new Animated.Value(-1)).current;

  const parsed = useMemo<ParsedLine[]>(() => {
    const existing = new Set(existingUIDs);
    const seen = new Set<string>();
    return input
      .split("\n")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw) => {
        const pipe = raw.indexOf("|");
        const uid = (pipe >= 0 ? raw.slice(0, pipe) : raw).trim();
        const password = pipe >= 0 ? raw.slice(pipe + 1).trim() || undefined : undefined;
        const valid = /^\d{5,}$/.test(uid);
        const duplicate = valid && (existing.has(uid) || seen.has(uid));
        if (valid) seen.add(uid);
        return { raw, uid, password, valid, duplicate };
      });
  }, [existingUIDs, input]);

  const validCount = parsed.filter((r) => r.valid).length;
  const invalidCount = parsed.filter((r) => !r.valid).length;
  const duplicateCount = parsed.filter((r) => r.duplicate).length;
  const passwordCount = parsed.filter((r) => Boolean(r.password)).length;

  useEffect(() => {
    if (!busy) {
      shine.stopAnimation();
      shine.setValue(-1);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [busy, shine]);

  useEffect(() => {
    if (!busy) {
      setProgress(0);
      return;
    }
    const timer = setInterval(() => {
      setProgress((value) => Math.min(94, value + Math.max(1, Math.round((100 - value) / 10))));
    }, 360);
    return () => clearInterval(timer);
  }, [busy]);

  const run = async () => {
    if (!validCount || busy) return;
    setBusy(true);
    setMessage("");
    setProgress(4);
    if (prefs.haptics) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const count = await onImport(input, fetchAfter);
      setProgress(100);
      setMessage("Imported " + count + " UID" + (count === 1 ? "" : "s") + ".");
      setInput("");
      if (prefs.haptics) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
      if (prefs.haptics) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View style={[styles.titleIcon, { borderColor: theme.edge, backgroundColor: theme.primary + "10" }]}>
            <Feather name="upload-cloud" size={19} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Import Pro</Text>
            <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>Validate before saving · passwords stay on device</Text>
          </View>
        </View>

        <View style={[styles.formatCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialCommunityIcons name="shield-key-outline" size={18} color={theme.cyan} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 11, fontWeight: "800" }}>Accepted format</Text>
            <Text style={[styles.mono, { color: theme.secondary }]}>100012345678901</Text>
            <Text style={[styles.mono, { color: theme.secondary }]}>100012345678901|MySecretPass123</Text>
          </View>
        </View>

        <TextInput
          multiline
          value={input}
          onChangeText={setInput}
          editable={!busy}
          textAlignVertical="top"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="Paste UID list here..."
          placeholderTextColor={theme.muted}
          style={[styles.area, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
        />

        <View style={styles.counterRow}>
          <Counter label="VALID" value={validCount} color={theme.success} />
          <Counter label="INVALID" value={invalidCount} color={theme.error} />
          <Counter label="DUPLICATE" value={duplicateCount} color={theme.warning} />
          <Counter label="PASSWORD" value={passwordCount} color={theme.cyan} />
        </View>

        {parsed.length ? (
          <View style={[styles.preview, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.previewHeader}>
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: "900" }}>PREVIEW</Text>
              <Text style={{ color: theme.muted, fontSize: 9 }}>first {Math.min(8, parsed.length)} of {parsed.length}</Text>
            </View>
            {parsed.slice(0, 8).map((row, index) => (
              <View key={index + ":" + row.raw} style={[styles.previewRow, { borderTopColor: theme.border }]}>
                <View
                  style={[
                    styles.stateDot,
                    { backgroundColor: !row.valid ? theme.error : row.duplicate ? theme.warning : theme.success }
                  ]}
                />
                <Text numberOfLines={1} style={[styles.previewUID, { color: row.valid ? theme.text : theme.error }]}>
                  {row.uid || row.raw}
                </Text>
                {row.password ? <Feather name="key" size={11} color={theme.cyan} /> : null}
                <Text style={{ color: theme.muted, fontSize: 9 }}>
                  {!row.valid ? "INVALID" : row.duplicate ? "DUPLICATE" : "READY"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.modeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={{ color: theme.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>IMPORT MODE</Text>
          <View style={[styles.segment, { backgroundColor: theme.input }]}>
            <Pressable
              onPress={() => setFetchAfter(false)}
              style={[styles.segmentItem, !fetchAfter && { backgroundColor: theme.card2, borderColor: theme.edge }]}
            >
              <Feather name="inbox" size={13} color={!fetchAfter ? theme.cyan : theme.muted} />
              <Text style={{ color: !fetchAfter ? theme.cyan : theme.secondary, fontSize: 11, fontWeight: "800" }}>Import only</Text>
            </Pressable>
            <Pressable
              onPress={() => setFetchAfter(true)}
              style={[styles.segmentItem, fetchAfter && { backgroundColor: theme.card2, borderColor: theme.edge }]}
            >
              <Feather name="zap" size={13} color={fetchAfter ? theme.primary : theme.muted} />
              <Text style={{ color: fetchAfter ? theme.primary : theme.secondary, fontSize: 11, fontWeight: "800" }}>Import & Fetch</Text>
            </Pressable>
          </View>
        </View>

        {busy ? (
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.primary, width: (progress + "%") as any }]} />
            <Animated.View
              style={[
                styles.shine,
                {
                  backgroundColor: theme.cyan + "55",
                  transform: [
                    {
                      translateX: shine.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-140, 280]
                      })
                    }
                  ]
                }
              ]}
            />
          </View>
        ) : null}

        <View style={styles.footer}>
          <View>
            <Text style={{ color: busy ? theme.primary : theme.muted, fontSize: 11, fontFamily: "monospace" }}>
              {busy ? (fetchAfter ? "Fetching profiles... " + progress + "%" : "Importing...") : validCount + " ready"}
            </Text>
            {duplicateCount ? <Text style={{ color: theme.warning, fontSize: 9, marginTop: 2 }}>Duplicates are kept, but flagged before import.</Text> : null}
          </View>

          <Pressable
            disabled={!validCount || busy}
            onPress={run}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              (!validCount || busy) && { opacity: 0.4 },
              pressed && { transform: [{ scale: 0.96 }] }
            ]}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="arrow-right" size={14} color="#fff" />}
            <Text style={styles.buttonText}>{busy ? "Working" : "Import"}</Text>
          </Pressable>
        </View>

        {message ? <Text style={{ color: message.startsWith("Imported") ? theme.success : theme.error, textAlign: "center", fontSize: 11 }}>{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.counter}>
      <Text style={{ color, fontSize: 15, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color, fontSize: 8, fontWeight: "800", opacity: 0.86 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 14, paddingBottom: 28, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleIcon: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  formatCard: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  mono: { fontFamily: "monospace", fontSize: 11, marginTop: 3 },
  area: { minHeight: 210, borderWidth: 1, borderRadius: 14, padding: 12, fontFamily: "monospace", fontSize: 12 },
  counterRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  counter: { flex: 1, alignItems: "center", paddingVertical: 7 },
  preview: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  previewHeader: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11 },
  previewRow: { minHeight: 34, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  previewUID: { flex: 1, minWidth: 0, fontSize: 10.5, fontFamily: "monospace" },
  modeCard: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  segmentItem: { flex: 1, height: 36, borderRadius: 8, borderWidth: 1, borderColor: "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", position: "relative" },
  progressFill: { height: 6, borderRadius: 3 },
  shine: { position: "absolute", top: 0, bottom: 0, width: 80 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  button: { minWidth: 112, height: 40, borderRadius: 11, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  buttonText: { color: "#fff", fontWeight: "900", fontSize: 12 }
});
