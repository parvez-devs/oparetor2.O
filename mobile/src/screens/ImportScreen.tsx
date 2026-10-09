import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { Theme } from "../theme";

export function ImportScreen({
  theme,
  onImport
}: {
  theme: Theme;
  onImport: (text: string) => Promise<number>;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const lines = useMemo(() => input.split("\n").filter((line) => line.trim()).length, [input]);

  useEffect(() => {
    if (!busy) {
      setProgress(0);
      return;
    }
    const timer = setInterval(() => {
      setProgress((value) => Math.min(92, value + Math.max(2, Math.round((100 - value) / 8))));
    }, 420);
    return () => clearInterval(timer);
  }, [busy]);

  const run = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setProgress(4);
    try {
      await onImport(input);
      setProgress(100);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={{ color: theme.primary, fontSize: 20 }}>⇧</Text>
          <Text style={[styles.title, { color: theme.text }]}>Import UIDs</Text>
        </View>

        <View style={[styles.info, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={{ color: theme.primary, fontSize: 16, marginTop: 1 }}>ⓘ</Text>
          <View>
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Format Examples:</Text>
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
          placeholder="Paste UIDs here..."
          placeholderTextColor={theme.muted}
          style={[styles.area, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        />

        <View style={styles.footerArea}>
          {busy ? (
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.primary, width: progress + "%" }]} />
            </View>
          ) : null}

          <View style={styles.footer}>
            {busy ? (
              <View style={styles.fetching}>
                <ActivityIndicator color={theme.primary} size="small" />
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>Fetching... {progress}%</Text>
              </View>
            ) : (
              <Text style={{ color: theme.muted, fontFamily: "monospace", fontSize: 13 }}>{lines} lines</Text>
            )}

            <Pressable
              disabled={!input.trim() || busy}
              onPress={run}
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                (!input.trim() || busy) && { opacity: 0.5 }
              ]}
            >
              <Text style={styles.buttonText}>{busy ? "Processing..." : "Import"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 16, paddingBottom: 20, gap: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "800" },
  info: { borderWidth: 1, borderRadius: 9, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  mono: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  area: {
    flexGrow: 1,
    minHeight: 300,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontFamily: "monospace",
    fontSize: 13
  },
  footerArea: { gap: 12, paddingTop: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fetching: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: { minWidth: 120, height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 }
});
