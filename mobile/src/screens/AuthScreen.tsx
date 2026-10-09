import React, { useState } from "react";
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
import { signIn, signUp } from "../auth";
import type { Session } from "../types";

export function AuthScreen({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setMessage("");
    if (!email.includes("@")) return setError("Valid email required");
    if (password.length < 6) return setError("Password must be at least 6 characters");

    setBusy(true);
    try {
      if (mode === "login") {
        onSession(await signIn(email, password));
      } else {
        const result = await signUp(email, password);
        if (result.session) onSession(result.session);
        else {
          setMessage("Account created. Check your email, confirm it, then login.");
          setMode("login");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <View style={styles.brandBlock}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>♙</Text>
            </View>
            <Text style={styles.title}>{mode === "login" ? "UID 2.O" : "Create account"}</Text>
            <Text style={styles.sub}>{mode === "login" ? "Login to continue" : "Create your UID 2.O account"}</Text>
          </View>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="name@example.com"
            placeholderTextColor="#506079"
            style={styles.input}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            placeholderTextColor="#506079"
            style={styles.input}
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.ok}>{message}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && { transform: [{ scale: 0.98 }] }, busy && { opacity: 0.6 }]}
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : null}
            <Text style={styles.primaryText}>{mode === "login" ? "Login" : "Register"}</Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchMuted}>{mode === "login" ? "Account নেই?" : "Already have an account?"} </Text>
            <Pressable
              onPress={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setMessage("");
              }}
            >
              <Text style={styles.switchText}>{mode === "login" ? "Register" : "Login"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0e1a" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 32 },
  panel: { width: "100%", maxWidth: 384, alignSelf: "center" },
  brandBlock: { alignItems: "center", marginBottom: 28 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#1677ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 8
  },
  logoText: { color: "#fff", fontSize: 26 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  sub: { color: "#6b7280", fontSize: 12, marginTop: 4 },
  label: { color: "#6b7280", fontSize: 10, letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: {
    height: 44,
    backgroundColor: "#171c27",
    borderWidth: 1,
    borderColor: "#202a3a",
    borderRadius: 7,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 13
  },
  primary: {
    height: 44,
    borderRadius: 7,
    backgroundColor: "#1677ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 16
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  switchMuted: { color: "#6b7280", fontSize: 12 },
  switchText: { color: "#1677ff", fontSize: 12, fontWeight: "600" },
  error: { color: "#f87171", textAlign: "center", marginTop: 12, fontSize: 12 },
  ok: { color: "#4ade80", textAlign: "center", marginTop: 12, fontSize: 12 }
});
