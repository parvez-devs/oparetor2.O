import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { authenticateBiometric, verifyVaultPin } from "../security";

export function VaultGate({
  userId,
  biometric,
  onUnlock
}: {
  userId: string;
  biometric: boolean;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const useBiometric = async () => {
    setBusy(true);
    setError("");
    try {
      if (await authenticateBiometric("Unlock UID 2.O Vault")) onUnlock();
      else setError("Biometric unlock cancelled or unavailable");
    } finally {
      setBusy(false);
    }
  };

  const usePin = async () => {
    if (!pin) return;
    setBusy(true);
    setError("");
    try {
      if (await verifyVaultPin(userId, pin)) onUnlock();
      else setError("Wrong PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.orb} />
      <View style={styles.lock}>
        <Text style={styles.lockIcon}>◈</Text>
      </View>
      <Text style={styles.title}>Vault Locked</Text>
      <Text style={styles.sub}>Sensitive UID data is hidden until you unlock.</Text>

      <TextInput
        value={pin}
        onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 8))}
        keyboardType="number-pad"
        secureTextEntry
        placeholder="Enter PIN"
        placeholderTextColor="#4d617a"
        style={styles.input}
        onSubmitEditing={usePin}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primary} onPress={usePin} disabled={busy || !pin}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Unlock with PIN</Text>}
      </Pressable>

      {biometric ? (
        <Pressable style={styles.secondary} onPress={useBiometric} disabled={busy}>
          <Text style={styles.secondaryText}>◎  Use biometrics</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  orb: { position: "absolute", top: "22%", width: 240, height: 240, borderRadius: 120, backgroundColor: "#168cff", opacity: 0.08 },
  lock: { width: 76, height: 76, borderRadius: 24, borderWidth: 1, borderColor: "#174366", backgroundColor: "#07111b", alignItems: "center", justifyContent: "center" },
  lockIcon: { color: "#35dfff", fontSize: 34 },
  title: { color: "#f2f9ff", fontSize: 22, fontWeight: "900", marginTop: 22 },
  sub: { color: "#60738e", fontSize: 12, textAlign: "center", maxWidth: 260, marginTop: 7, marginBottom: 22 },
  input: { width: "100%", maxWidth: 340, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#18304a", backgroundColor: "#07101a", color: "#fff", textAlign: "center", letterSpacing: 5, fontSize: 16 },
  error: { color: "#ff6472", fontSize: 11, marginTop: 10 },
  primary: { width: "100%", maxWidth: 340, height: 46, borderRadius: 11, backgroundColor: "#168cff", alignItems: "center", justifyContent: "center", marginTop: 14 },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: { width: "100%", maxWidth: 340, height: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
  secondaryText: { color: "#39a7ff", fontSize: 13, fontWeight: "700" }
});
