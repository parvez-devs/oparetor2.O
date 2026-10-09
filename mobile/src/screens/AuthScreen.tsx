import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true })
    ]).start();
  }, [opacity, scale]);

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
          setMessage("Account created. Confirm your email, then login.");
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View style={[styles.panel, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>2.O</Text>
        </View>
        <Text style={styles.title}>{mode === "login" ? "UID 2.O" : "Create account"}</Text>
        <Text style={styles.sub}>{mode === "login" ? "Login to continue" : "Create your UID 2.O account"}</Text>

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
          style={({ pressed }) => [styles.primary, pressed && { transform: [{ scale: 0.98 }] }, busy && { opacity: 0.65 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "login" ? "Login" : "Register"}</Text>}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setMessage("");
          }}
          style={styles.switchMode}
        >
          <Text style={styles.switchText}>
            {mode === "login" ? "No account? Register" : "Already registered? Login"}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080d14", alignItems: "center", justifyContent: "center", padding: 22 },
  panel: { width: "100%", maxWidth: 420 },
  logo: {
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#1677ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1677ff",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 9
  },
  logoText: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub: { color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 28 },
  label: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 6, marginTop: 12 },
  input: {
    height: 48,
    backgroundColor: "#111927",
    borderWidth: 1,
    borderColor: "#202a3a",
    borderRadius: 11,
    paddingHorizontal: 13,
    color: "#fff"
  },
  primary: {
    height: 48,
    borderRadius: 11,
    backgroundColor: "#1677ff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  switchMode: { padding: 16, alignItems: "center" },
  switchText: { color: "#3b9dff", fontSize: 13, fontWeight: "700" },
  error: { color: "#f87171", textAlign: "center", marginTop: 12, fontSize: 12 },
  ok: { color: "#4ade80", textAlign: "center", marginTop: 12, fontSize: 12 }
});
