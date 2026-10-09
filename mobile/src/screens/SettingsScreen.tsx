import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { Preferences } from "../types";
import type { Theme } from "../theme";

function Segment({
  values,
  value,
  onChange,
  theme,
  icons
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
  icons?: Record<string, string>;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.border }]}>
      {values.map((item) => {
        const active = item === value;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={[styles.segmentItem, active && { backgroundColor: theme.bg }]}
          >
            <Text style={{ color: active ? theme.text : theme.secondary, fontWeight: "700", textTransform: "capitalize", fontSize: 13 }}>
              {icons?.[item] ? icons[item] + "  " : ""}{item}
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
  total,
  onPrefs,
  onClear
}: {
  theme: Theme;
  prefs: Preferences;
  total: number;
  onPrefs: (prefs: Preferences) => void;
  onClear: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <SectionTitle theme={theme}>THEME</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Segment
          values={["dark", "light"]}
          value={prefs.theme}
          theme={theme}
          icons={{ dark: "☾", light: "☀" }}
          onChange={(value) => onPrefs({ ...prefs, theme: value as Preferences["theme"] })}
        />
      </View>

      <SectionTitle theme={theme}>FONT SIZE</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Segment
          values={["sm", "md", "lg"]}
          value={prefs.fontSize}
          theme={theme}
          onChange={(value) => onPrefs({ ...prefs, fontSize: value as Preferences["fontSize"] })}
        />
      </View>

      <SectionTitle theme={theme}>VIEW MODE</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Segment
          values={["full", "compact"]}
          value={prefs.viewMode}
          theme={theme}
          onChange={(value) => onPrefs({ ...prefs, viewMode: value as Preferences["viewMode"] })}
        />
      </View>

      <SectionTitle theme={theme}>PREFERENCES</SectionTitle>
      <View style={[styles.card, styles.preferenceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Swipe to delete</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>প্রতিটি card-এ Delete বাটন দেখাবে।</Text>
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
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Auto-retry failed fetches</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>Failed UID গুলো manually refresh করতে হবে।</Text>
          </View>
          <Switch
            value={prefs.autoRetry}
            onValueChange={(value) => onPrefs({ ...prefs, autoRetry: value })}
            trackColor={{ false: theme.border, true: theme.primaryDim }}
            thumbColor={prefs.autoRetry ? theme.primary : "#b8c2d2"}
          />
        </View>
      </View>

      <SectionTitle theme={theme}>STORAGE</SectionTitle>
      <View style={[styles.storageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.storageLeft}>
          <View style={[styles.dbIcon, { backgroundColor: theme.border }]}>
            <Text style={{ color: theme.muted, fontSize: 18 }}>▣</Text>
          </View>
          <View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Local data</Text>
            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>{total} UID সংরক্ষিত</Text>
          </View>
        </View>

        <Pressable
          style={[styles.clearButton, { backgroundColor: theme.error }]}
          onPress={() =>
            Alert.alert("সব UID ডিলিট হয়ে যাবে। নিশ্চিত?", undefined, [
              { text: "Cancel", style: "cancel" },
              { text: "Clear all", style: "destructive", onPress: onClear }
            ])
          }
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>⌫  Clear all</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SectionTitle({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return <Text style={[styles.sectionTitle, { color: theme.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 96 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.1, fontWeight: "700", marginTop: 10, marginBottom: 8, paddingLeft: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  segment: { flexDirection: "row", borderRadius: 7, padding: 4 },
  segmentItem: { flex: 1, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  preferenceCard: { padding: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 22 },
  storageCard: {
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  storageLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  dbIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  clearButton: { height: 34, borderRadius: 7, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }
});
