import React, { useMemo, useState } from "react";
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
  const [message, setMessage] = useState("");
  const lines = useMemo(() => input.split("\n").filter((x) => x.trim()).length, [input]);

  const run = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const count = await onImport(input);
      setMessage("Imported " + count + " UID" + (count === 1 ? "" : "s") + ".");
      setInput("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]}>Import UIDs</Text>
        <View style={[styles.info, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: "800", marginBottom: 6 }}>Format examples</Text>
          <Text style={[styles.mono, { color: theme.secondary }]}>100012345678901</Text>
          <Text style={[styles.mono, { color: theme.secondary }]}>100012345678901|MySecretPass123</Text>
          <Text style={{ color: theme.muted, marginTop: 8, fontSize: 11 }}>
            Every pasted line is kept. Passwords stay encrypted on this device and are never sent to the profile API or Supabase.
          </Text>
        </View>

        <TextInput
          multiline
          value={input}
          onChangeText={setInput}
          editable={!busy}
          textAlignVertical="top"
          placeholder="Paste UIDs here…"
          placeholderTextColor={theme.muted}
          style={[
            styles.area,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              color: theme.text
            }
          ]}
        />

        <View style={styles.footer}>
          <Text style={{ color: theme.muted, fontFamily: "monospace" }}>{lines + " lines"}</Text>
          <Pressable
            disabled={!input.trim() || busy}
            onPress={run}
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              (!input.trim() || busy) && { opacity: 0.5 }
            ]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Import & Fetch</Text>}
          </Pressable>
        </View>
        {message ? <Text style={{ color: theme.secondary, textAlign: "center", marginTop: 12 }}>{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 14 },
  info: { borderWidth: 1, borderRadius: 13, padding: 13, marginBottom: 12 },
  mono: { fontFamily: "monospace", fontSize: 12, marginVertical: 2 },
  area: {
    minHeight: 330,
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    fontFamily: "monospace",
    fontSize: 13
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  button: { minWidth: 135, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: "#fff", fontWeight: "800" }
});
