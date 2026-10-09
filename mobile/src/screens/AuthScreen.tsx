import React, { useEffect, useRef, useState } from "react";
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
import { signIn, signUp } from "../auth";
import type { Session } from "../types";

export function AuthScreen({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const phase = useRef(new Animated.Value(0)).current;
  const panel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(panel, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(phase, { toValue: 1, duration: 5000, useNativeDriver: true }),
          Animated.timing(phase, { toValue: 0, duration: 5000, useNativeDriver: true })
        ])
      )
    ]).start();
  }, [panel, phase]);

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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbA,
          {
            transform: [{
              translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-28, 36] })
            }]
          }
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbB,
          {
            transform: [{
              translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [24, -30] })
            }]
          }
        ]}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.panel,
            {
              opacity: panel,
              transform: [{
                translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [14, 0] })
              }]
            }
          ]}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logo}>
              <View style={styles.logoRing}>
                <Text style={styles.logoText}>U2</Text>
              </View>
            </View>
            <Text style={styles.title}>{mode === "login" ? "UID 2.O" : "Create account"}</Text>
            <Text style={styles.cyber}>CYBER MINIMAL</Text>
            <Text style={styles.sub}>{mode === "login" ? "Secure native UID workspace" : "Create your UID 2.O cloud account"}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={15} color="#526681" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="name@example.com"
                placeholderTextColor="#526681"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={15} color="#526681" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                placeholderTextColor="#526681"
                style={styles.input}
                onSubmitEditing={submit}
              />
              <Pressable hitSlop={8} onPress={() => setShowPass((v) => !v)}>
                <Feather name={showPass ? "eye-off" : "eye"} size={15} color="#60738e" />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={12} color="#ff5e6c" />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}
            {message ? <Text style={styles.ok}>{message}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.primary,
                pressed && { transform: [{ scale: 0.98 }] },
                busy && { opacity: 0.62 }
              ]}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <MaterialCommunityIcons name="shield-check-outline" size={17} color="#fff" />}
              <Text style={styles.primaryText}>{mode === "login" ? "Enter workspace" : "Create account"}</Text>
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchMuted}>{mode === "login" ? "New to UID 2.O?" : "Already registered?"} </Text>
            <Pressable
              onPress={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setMessage("");
              }}
            >
              <Text style={styles.switchText}>{mode === "login" ? "Create account" : "Login"}</Text>
            </Pressable>
          </View>

          <View style={styles.securityNote}>
            <Feather name="shield" size={11} color="#36e0ff" />
            <Text style={styles.securityText}>Supabase auth · local SecureStore · encrypted transport</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  orbA: { position: "absolute", top: -100, left: -120, width: 330, height: 330, borderRadius: 165, backgroundColor: "#168cff", opacity: 0.1 },
  orbB: { position: "absolute", top: 180, right: -180, width: 360, height: 360, borderRadius: 180, backgroundColor: "#21e6ff", opacity: 0.055 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 34 },
  panel: { width: "100%", maxWidth: 390, alignSelf: "center" },
  brandBlock: { alignItems: "center", marginBottom: 24 },
  logo: { width: 72, height: 72, borderRadius: 23, borderWidth: 1, borderColor: "#17496c", backgroundColor: "#061019", alignItems: "center", justifyContent: "center", shadowColor: "#168cff", shadowOpacity: 0.32, shadowRadius: 24, elevation: 12 },
  logoRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#36e0ff", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#45a9ff", fontSize: 18, fontWeight: "900" },
  title: { color: "#f3fbff", fontSize: 24, fontWeight: "900", letterSpacing: -0.65, marginTop: 14 },
  cyber: { color: "#36e0ff", fontSize: 8, fontWeight: "900", letterSpacing: 2.8, marginTop: 4 },
  sub: { color: "#60738e", fontSize: 11, marginTop: 8 },
  formCard: { borderWidth: 1, borderColor: "#15243a", borderRadius: 18, backgroundColor: "#060a0f", padding: 15 },
  label: { color: "#60738e", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6, marginTop: 10 },
  inputWrap: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#18304a", backgroundColor: "#03070b", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11 },
  input: { flex: 1, minWidth: 0, height: 46, color: "#f3fbff", fontSize: 13 },
  primary: { height: 46, borderRadius: 12, backgroundColor: "#168cff", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 11, padding: 9, borderRadius: 9, backgroundColor: "#ff5e6c12" },
  error: { color: "#ff5e6c", fontSize: 10, flex: 1 },
  ok: { color: "#31d17c", textAlign: "center", marginTop: 11, fontSize: 10 },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  switchMuted: { color: "#60738e", fontSize: 11 },
  switchText: { color: "#39a7ff", fontSize: 11, fontWeight: "800" },
  securityNote: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20 },
  securityText: { color: "#526681", fontSize: 8.5, fontWeight: "700" }
});
