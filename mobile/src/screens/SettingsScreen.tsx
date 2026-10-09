import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { exportEncryptedBackup, importEncryptedBackup, type BackupPayload } from "../backup";
import { diagnosticReport, runDiagnostics } from "../diagnostics";
import { biometricCapability, setVaultPin } from "../security";
import { checkLatestRelease, type ReleaseInfo } from "../update";
import type { Preferences, SyncStatus, UIDEntry, VaultConfig } from "../types";
import type { Theme } from "../theme";

const APP_VERSION = "3.0.0";
const BUILD_NUMBER = 4;

function Segment({
  values,
  value,
  onChange,
  theme
}: {
  values: Array<{ id: string; label: string; icon?: any }>;
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.input, borderColor: theme.border }]}>
      {values.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.card2, borderColor: theme.edge }
            ]}
          >
            {item.icon ? <MaterialCommunityIcons name={item.icon} size={13} color={active ? theme.cyan : theme.muted} /> : null}
            <Text style={{ color: active ? theme.cyan : theme.secondary, fontWeight: "800", fontSize: 10 }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsScreen({
  userId,
  theme,
  prefs,
  vault,
  uids,
  online,
  syncStatus,
  lastSync,
  onPrefs,
  onVault,
  onClear,
  onRestoreBackup
}: {
  userId: string;
  theme: Theme;
  prefs: Preferences;
  vault: VaultConfig;
  uids: UIDEntry[];
  online: boolean;
  syncStatus: SyncStatus;
  lastSync?: string;
  onPrefs: (prefs: Preferences) => void;
  onVault: (vault: VaultConfig) => Promise<void>;
  onClear: () => void;
  onRestoreBackup: (payload: BackupPayload) => Promise<void>;
}) {
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [backupMode, setBackupMode] = useState<"export" | "import" | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<Awaited<ReturnType<typeof runDiagnostics>> | null>(null);
  const [checkingDiag, setCheckingDiag] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [release, setRelease] = useState<ReleaseInfo | null | undefined>(undefined);

  const collections = useMemo(
    () => Array.from(new Set(uids.map((u) => u.collection).filter(Boolean))).length,
    [uids]
  );

  const haptic = async () => {
    if (prefs.haptics) await Haptics.selectionAsync().catch(() => {});
  };

  const savePin = async () => {
    if (!/^\d{4,8}$/.test(pin)) return Alert.alert("Invalid PIN", "Use 4–8 digits.");
    if (pin !== pin2) return Alert.alert("PIN mismatch", "Both PIN entries must match.");
    setBusy(true);
    try {
      await setVaultPin(userId, pin);
      await onVault({ ...vault, enabled: true });
      setPin("");
      setPin2("");
      setPinOpen(false);
      await haptic();
    } catch (e) {
      Alert.alert("Vault error", e instanceof Error ? e.message : "Unable to save PIN");
    } finally {
      setBusy(false);
    }
  };

  const toggleVault = async (value: boolean) => {
    if (value) {
      setPinOpen(true);
      return;
    }
    await onVault({ ...vault, enabled: false });
  };

  const toggleBiometric = async (value: boolean) => {
    if (!value) return onVault({ ...vault, biometric: false });
    const capability = await biometricCapability();
    if (!capability.available) {
      Alert.alert("Biometrics unavailable", "Set up fingerprint or face authentication in Android first.");
      return;
    }
    await onVault({ ...vault, biometric: true, enabled: true });
    await haptic();
  };

  const runBackup = async () => {
    if (passphrase.length < 8) return Alert.alert("Passphrase too short", "Use at least 8 characters.");
    if (!backupMode) return;
    setBusy(true);
    try {
      if (backupMode === "export") {
        await exportEncryptedBackup(userId, uids, prefs, passphrase);
        Alert.alert("Backup ready", "Encrypted UID 2.O backup exported.");
      } else {
        const payload = await importEncryptedBackup(passphrase);
        if (payload) {
          Alert.alert(
            "Restore encrypted backup?",
            payload.uids.length + " UID entries will replace current local data.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Restore",
                onPress: () => {
                  void onRestoreBackup(payload)
                    .then(() => Alert.alert("Restore complete", "Backup restored and queued for cloud sync."))
                    .catch((e) => Alert.alert("Restore failed", e instanceof Error ? e.message : "Unknown error"));
                }
              }
            ]
          );
        }
      }
      setBackupMode(null);
      setPassphrase("");
    } catch (e) {
      Alert.alert("Backup error", e instanceof Error ? e.message : "Backup operation failed");
    } finally {
      setBusy(false);
    }
  };

  const checkDiagnostics = async () => {
    setCheckingDiag(true);
    try {
      setDiag(await runDiagnostics());
    } finally {
      setCheckingDiag(false);
    }
  };

  const copyDiagnostics = async () => {
    const report = diagnosticReport({
      version: APP_VERSION,
      build: BUILD_NUMBER,
      online,
      syncStatus,
      lastSync,
      uids,
      api: diag?.api,
      supabase: diag?.supabase
    });
    await Clipboard.setStringAsync(report);
    await haptic();
    Alert.alert("Copied", "Diagnostic report copied without UID/password values.");
  };

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    try {
      setRelease(await checkLatestRelease(APP_VERSION));
    } catch {
      setRelease(null);
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Control Center</Text>
            <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>UID 2.O Cyber Minimal</Text>
          </View>
          <View style={[styles.versionChip, { borderColor: theme.edge, backgroundColor: theme.primary + "0d" }]}>
            <Text style={{ color: theme.cyan, fontSize: 9, fontWeight: "900" }}>v{APP_VERSION}</Text>
          </View>
        </View>

        <SectionTitle theme={theme} icon="palette-outline" title="APPEARANCE" />
        <Card theme={theme}>
          <Text style={[styles.cardLabel, { color: theme.muted }]}>THEME</Text>
          <Segment
            values={[
              { id: "dark", label: "Dark", icon: "weather-night" },
              { id: "amoled", label: "AMOLED", icon: "circle-opacity" },
              { id: "light", label: "Light", icon: "white-balance-sunny" },
              { id: "system", label: "System", icon: "cellphone-cog" }
            ]}
            value={prefs.theme}
            theme={theme}
            onChange={(value) => onPrefs({ ...prefs, theme: value as Preferences["theme"] })}
          />

          <Text style={[styles.cardLabel, { color: theme.muted, marginTop: 14 }]}>FONT SIZE</Text>
          <Segment
            values={[
              { id: "sm", label: "SM" },
              { id: "md", label: "MD" },
              { id: "lg", label: "LG" }
            ]}
            value={prefs.fontSize}
            theme={theme}
            onChange={(value) => onPrefs({ ...prefs, fontSize: value as Preferences["fontSize"] })}
          />

          <Text style={[styles.cardLabel, { color: theme.muted, marginTop: 14 }]}>CARD MODE</Text>
          <Segment
            values={[
              { id: "compact", label: "Compact", icon: "view-compact-outline" },
              { id: "full", label: "Full", icon: "view-agenda-outline" }
            ]}
            value={prefs.viewMode}
            theme={theme}
            onChange={(value) => onPrefs({ ...prefs, viewMode: value as Preferences["viewMode"] })}
          />
        </Card>

        <SectionTitle theme={theme} icon="gesture-swipe" title="INTERACTION" />
        <Card theme={theme}>
          <ToggleRow theme={theme} title="Swipe to delete" sub="Spring-resistance swipe on UID cards." value={prefs.swipeToDelete} onChange={(v) => onPrefs({ ...prefs, swipeToDelete: v })} />
          <Divider theme={theme} />
          <ToggleRow theme={theme} title="Haptic feedback" sub="Native touch confirmation for important actions." value={prefs.haptics} onChange={(v) => onPrefs({ ...prefs, haptics: v })} />
          <Divider theme={theme} />
          <ToggleRow theme={theme} title="Reduce motion" sub="Disable aurora/card micro-animations." value={prefs.reduceMotion} onChange={(v) => onPrefs({ ...prefs, reduceMotion: v })} />
          <Divider theme={theme} />
          <ToggleRow theme={theme} title="Auto-retry failed profiles" sub="Retry failed UID fetches after launch." value={prefs.autoRetry} onChange={(v) => onPrefs({ ...prefs, autoRetry: v })} />
        </Card>

        <SectionTitle theme={theme} icon="shield-lock-outline" title="SECURE VAULT" />
        <Card theme={theme}>
          <ToggleRow theme={theme} title="Vault lock" sub="Lock UID data when the app goes to background." value={vault.enabled} onChange={toggleVault} />
          <Divider theme={theme} />
          <ToggleRow theme={theme} title="Biometric unlock" sub="Use enrolled fingerprint/face authentication." value={vault.biometric} onChange={toggleBiometric} disabled={!vault.enabled} />
          <Divider theme={theme} />
          <ToggleRow theme={theme} title="Protect password reveal" sub="Require vault authentication before showing passwords." value={vault.requireForPassword} onChange={(v) => onVault({ ...vault, requireForPassword: v })} disabled={!vault.enabled} />
          <Divider theme={theme} />
          <ToggleRow theme={theme} title="Block screenshots" sub="Prevent screenshots and recent-app previews while enabled." value={vault.blockScreenshots} onChange={(v) => onVault({ ...vault, blockScreenshots: v })} />
          {vault.enabled ? (
            <Pressable onPress={() => setPinOpen(true)} style={[styles.inlineButton, { borderColor: theme.border }]}>
              <Feather name="hash" size={13} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 11, fontWeight: "800" }}>Change vault PIN</Text>
            </Pressable>
          ) : null}
        </Card>

        <SectionTitle theme={theme} icon="backup-restore" title="ENCRYPTED BACKUP" />
        <Card theme={theme}>
          <View style={styles.backupRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }}>Portable encrypted backup</Text>
              <Text style={{ color: theme.muted, fontSize: 10, marginTop: 4, lineHeight: 15 }}>
                UID data, collections, preferences and local passwords are encrypted with your passphrase before export.
              </Text>
            </View>
            <MaterialCommunityIcons name="file-lock-outline" size={28} color={theme.cyan} />
          </View>
          <View style={styles.twoButtons}>
            <SmallButton theme={theme} icon="download" label="Export" onPress={() => setBackupMode("export")} />
            <SmallButton theme={theme} icon="upload" label="Restore" onPress={() => setBackupMode("import")} />
          </View>
        </Card>

        <SectionTitle theme={theme} icon="cloud-sync-outline" title="SYNC & DIAGNOSTICS" />
        <Card theme={theme}>
          <StatusLine theme={theme} label="Network" value={online ? "Online" : "Offline"} ok={online} />
          <StatusLine theme={theme} label="Cloud sync" value={syncStatus.toUpperCase()} ok={syncStatus === "synced"} warning={syncStatus === "offline" || syncStatus === "syncing"} />
          <StatusLine theme={theme} label="Last sync" value={lastSync ? new Date(lastSync).toLocaleString() : "Never"} />
          <StatusLine theme={theme} label="Local UID entries" value={String(uids.length)} />
          <StatusLine theme={theme} label="Collections" value={String(collections)} />
          {diag ? (
            <>
              <Divider theme={theme} />
              <StatusLine theme={theme} label="Profile API" value={(diag.api.ok ? "OK" : "FAIL") + " · " + diag.api.ms + "ms"} ok={diag.api.ok} />
              <StatusLine theme={theme} label="Supabase" value={(diag.supabase.ok ? "OK" : "FAIL") + " · " + diag.supabase.ms + "ms"} ok={diag.supabase.ok} />
            </>
          ) : null}
          <View style={styles.twoButtons}>
            <SmallButton theme={theme} icon="activity" label={checkingDiag ? "Checking..." : "Run checks"} onPress={checkDiagnostics} disabled={checkingDiag} />
            <SmallButton theme={theme} icon="copy" label="Copy report" onPress={copyDiagnostics} />
          </View>
        </Card>

        <SectionTitle theme={theme} icon="update" title="UPDATE" />
        <Card theme={theme}>
          <View style={styles.updateRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: "800" }}>UID 2.O v{APP_VERSION}</Text>
              <Text style={{ color: theme.muted, fontSize: 10, marginTop: 3 }}>Build {BUILD_NUMBER} · Native Android</Text>
              {release === null ? <Text style={{ color: theme.success, fontSize: 10, marginTop: 5 }}>You're on the latest release.</Text> : null}
              {release ? <Text style={{ color: theme.warning, fontSize: 10, marginTop: 5 }}>Update available: {release.tag}</Text> : null}
            </View>
            {checkingUpdate ? (
              <ActivityIndicator color={theme.primary} />
            ) : release ? (
              <Pressable onPress={() => Linking.openURL(release.url)} style={[styles.updateButton, { backgroundColor: theme.primary }]}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>OPEN</Text>
              </Pressable>
            ) : (
              <Pressable onPress={checkUpdate} style={[styles.updateButton, { borderColor: theme.border, borderWidth: 1 }]}>
                <Text style={{ color: theme.primary, fontSize: 10, fontWeight: "900" }}>CHECK</Text>
              </Pressable>
            )}
          </View>
        </Card>

        <SectionTitle theme={theme} icon="database-outline" title="STORAGE" />
        <View style={[styles.storageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.storageLeft}>
            <View style={[styles.dbIcon, { backgroundColor: theme.card2, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="database-outline" size={20} color={theme.secondary} />
            </View>
            <View>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: "800" }}>Local data</Text>
              <Text style={{ color: theme.muted, fontSize: 10, marginTop: 3 }}>{uids.length} UID stored</Text>
            </View>
          </View>
          <Pressable
            style={[styles.clearButton, { backgroundColor: theme.error + "16", borderColor: theme.error + "44" }]}
            onPress={() =>
              Alert.alert("Delete all UIDs?", "Local passwords and cloud UID rows for this account will also be removed.", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear all", style: "destructive", onPress: onClear }
              ])
            }
          >
            <Feather name="trash-2" size={13} color={theme.error} />
            <Text style={{ color: theme.error, fontWeight: "800", fontSize: 10 }}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.about}>
          <View style={[styles.aboutLogo, { borderColor: theme.edge }]}>
            <Text style={{ color: theme.cyan, fontWeight: "900", fontSize: 15 }}>U2</Text>
          </View>
          <Text style={{ color: theme.muted, fontSize: 9, letterSpacing: 1.2, marginTop: 8 }}>UID 2.O · CYBER MINIMAL · BUILD {BUILD_NUMBER}</Text>
        </View>
      </ScrollView>

      <Modal visible={pinOpen} transparent animationType="fade" onRequestClose={() => setPinOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.cyan + "10", borderColor: theme.edge }]}>
              <MaterialCommunityIcons name="shield-key-outline" size={25} color={theme.cyan} />
            </View>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "900", marginTop: 12 }}>Set Vault PIN</Text>
            <Text style={{ color: theme.muted, fontSize: 10, textAlign: "center", marginTop: 5 }}>Use 4–8 digits. The PIN hash is stored in Android SecureStore.</Text>
            <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))} secureTextEntry keyboardType="number-pad" placeholder="PIN" placeholderTextColor={theme.muted} style={[styles.modalInput, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />
            <TextInput value={pin2} onChangeText={(v) => setPin2(v.replace(/\D/g, "").slice(0, 8))} secureTextEntry keyboardType="number-pad" placeholder="Confirm PIN" placeholderTextColor={theme.muted} style={[styles.modalInput, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPinOpen(false)} style={styles.modalAction}><Text style={{ color: theme.muted, fontWeight: "800" }}>Cancel</Text></Pressable>
              <Pressable onPress={savePin} disabled={busy} style={[styles.modalAction, { backgroundColor: theme.primary }]}>{busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Save PIN</Text>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(backupMode)} transparent animationType="fade" onRequestClose={() => setBackupMode(null)}>
        <View style={[styles.modalRoot, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.primary + "10", borderColor: theme.edge }]}>
              <MaterialCommunityIcons name={backupMode === "export" ? "file-export-outline" : "file-import-outline"} size={25} color={theme.primary} />
            </View>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "900", marginTop: 12 }}>
              {backupMode === "export" ? "Export encrypted backup" : "Restore encrypted backup"}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 10, textAlign: "center", marginTop: 5 }}>
              This passphrase is never uploaded. If you forget it, the backup cannot be decrypted.
            </Text>
            <TextInput value={passphrase} onChangeText={setPassphrase} secureTextEntry placeholder="Backup passphrase" placeholderTextColor={theme.muted} style={[styles.modalInput, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setBackupMode(null); setPassphrase(""); }} style={styles.modalAction}><Text style={{ color: theme.muted, fontWeight: "800" }}>Cancel</Text></Pressable>
              <Pressable onPress={runBackup} disabled={busy} style={[styles.modalAction, { backgroundColor: theme.primary }]}>{busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>{backupMode === "export" ? "Export" : "Choose file"}</Text>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Card({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>;
}

function SectionTitle({ theme, icon, title }: { theme: Theme; icon: any; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <MaterialCommunityIcons name={icon} size={13} color={theme.muted} />
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: Theme }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

function ToggleRow({
  theme,
  title,
  sub,
  value,
  onChange,
  disabled
}: {
  theme: Theme;
  title: string;
  sub: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.42 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: theme.muted, fontSize: 10, marginTop: 3, lineHeight: 14 }}>{sub}</Text>
      </View>
      <Switch
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.primaryDim }}
        thumbColor={value ? theme.cyan : "#a6b2c4"}
      />
    </View>
  );
}

function SmallButton({ theme, icon, label, onPress, disabled }: { theme: Theme; icon: any; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.smallButton, { borderColor: theme.border }, disabled && { opacity: 0.45 }]}>
      <Feather name={icon} size={13} color={theme.primary} />
      <Text style={{ color: theme.primary, fontSize: 10, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function StatusLine({ theme, label, value, ok, warning }: { theme: Theme; label: string; value: string; ok?: boolean; warning?: boolean }) {
  const color = ok ? theme.success : warning ? theme.warning : theme.secondary;
  return (
    <View style={styles.statusLine}>
      <Text style={{ color: theme.muted, fontSize: 10 }}>{label}</Text>
      <Text style={{ color, fontSize: 10, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 42 },
  titleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  versionChip: { height: 28, borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 8, paddingLeft: 3 },
  sectionTitle: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 13 },
  cardLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginBottom: 7 },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: 11, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  toggleRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 9 },
  inlineButton: { height: 36, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 },
  backupRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  twoButtons: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallButton: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  statusLine: { minHeight: 29, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  updateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  updateButton: { minWidth: 58, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  storageCard: { minHeight: 76, borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  storageLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  dbIcon: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  clearButton: { height: 34, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  about: { alignItems: "center", paddingTop: 30, paddingBottom: 8 },
  aboutLogo: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  modalCard: { width: "100%", maxWidth: 370, borderWidth: 1, borderRadius: 22, padding: 18, alignItems: "center" },
  modalIcon: { width: 52, height: 52, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modalInput: { width: "100%", height: 45, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, marginTop: 12, textAlign: "center" },
  modalActions: { width: "100%", flexDirection: "row", gap: 8, marginTop: 14 },
  modalAction: { flex: 1, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" }
});
