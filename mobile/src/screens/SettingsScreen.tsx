import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { Preferences } from "../types";
import type { Theme } from "../theme";

function Segment({
  values,
  value,
  onChange,
  theme
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.card2, borderColor: theme.border }]}>
      {values.map((item) => {
        const active = item === value;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[styles.segmentItem, active && { backgroundColor: theme.card }]}
          >
            <Text style={{ color: active ? theme.primary : theme.secondary, fontWeight: "800", textTransform: "capitalize" }}>
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsScreen({
  theme,
  prefs,
  email,
  total,
  onPrefs,
  onClear,
  onSignOut
}: {
  theme: Theme;
  prefs: Preferences;
  email?: string;
  total: number;
  onPrefs: (prefs: Preferences) => void;
  onClear: () => void;
  onSignOut: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>THEME</Text>
      <Segment
        values={["dark", "light"]}
        value={prefs.theme}
        theme={theme}
        onChange={(value) => onPrefs({ ...prefs, theme: value as Preferences["theme"] })}
      />

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>FONT SIZE</Text>
      <Segment
        values={["sm", "md", "lg"]}
        value={prefs.fontSize}
        theme={theme}
        onChange={(value) => onPrefs({ ...prefs, fontSize: value as Preferences["fontSize"] })}
      />

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>VIEW MODE</Text>
      <Segment
        values={["compact", "full"]}
        value={prefs.viewMode}
        theme={theme}
        onChange={(value) => onPrefs({ ...prefs, viewMode: value as Preferences["viewMode"] })}
      />

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "800" }}>Swipe to delete</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>Swipe a UID card left to remove it.</Text>
          </View>
          <Switch
            value={prefs.swipeToDelete}
            onValueChange={(value) => onPrefs({ ...prefs, swipeToDelete: value })}
            trackColor={{ false: theme.border, true: theme.primaryDim }}
            thumbColor={prefs.swipeToDelete ? theme.primary : "#b8c2d2"}
          />
        </View>
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "800" }}>Auto retry</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>Retry failed profiles once after loading.</Text>
          </View>
          <Switch
            value={prefs.autoRetry}
            onValueChange={(value) => onPrefs({ ...prefs, autoRetry: value })}
            trackColor={{ false: theme.border, true: theme.primaryDim }}
            thumbColor={prefs.autoRetry ? theme.primary : "#b8c2d2"}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.muted }]}>ACCOUNT & DATA</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={{ color: theme.text, fontWeight: "800" }}>{email || "Signed in"}</Text>
        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{total + " UID entries synced"}</Text>
      </View>

      <Pressable
        style={[styles.danger, { borderColor: theme.error + "77" }]}
        onPress={() =>
          Alert.alert("Delete all UIDs?", "This removes local and cloud UID data for this account.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete all", style: "destructive", onPress: onClear }
          ])
        }
      >
        <Text style={{ color: theme.error, fontWeight: "800" }}>Delete all UID data</Text>
      </Pressable>

      <Pressable style={[styles.logout, { backgroundColor: theme.primary }]} onPress={onSignOut}>
        <Text style={{ color: "#fff", fontWeight: "900" }}>Sign out</Text>
      </Pressable>

      <Text style={{ color: theme.muted, textAlign: "center", fontSize: 10, marginTop: 14 }}>
        UIDZone Native 1.0.0 · React Native
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 34 },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 16 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  card: { borderWidth: 1, borderRadius: 13, padding: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  danger: { borderWidth: 1, borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center", marginTop: 14 },
  logout: { borderRadius: 12, height: 48, alignItems: "center", justifyContent: "center", marginTop: 12 }
});
