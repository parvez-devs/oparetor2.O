import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DEFAULT_PREFS, type Preferences, type UIDEntry } from "./types";

function uidKey(userId: string) {
  return "uidzone_uids_" + userId;
}

function prefsKey(userId: string) {
  return "uidzone_prefs_" + userId;
}

function passKey(userId: string, id: string) {
  return ("uidzone_pass_" + userId + "_" + id).replace(/-/g, "_");
}

export async function loadUIDs(userId: string): Promise<UIDEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(uidKey(userId));
    return raw ? (JSON.parse(raw) as UIDEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveUIDs(userId: string, uids: UIDEntry[]) {
  await AsyncStorage.setItem(uidKey(userId), JSON.stringify(uids));
}

export async function loadPrefs(userId: string): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(prefsKey(userId));
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Preferences>) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function hasPrefs(userId: string) {
  return (await AsyncStorage.getItem(prefsKey(userId))) !== null;
}

export async function savePrefs(userId: string, prefs: Preferences) {
  await AsyncStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
}

export async function savePassword(userId: string, id: string, password?: string) {
  const key = passKey(userId, id);
  if (!password) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, password);
}

export async function getPassword(userId: string, id: string) {
  return SecureStore.getItemAsync(passKey(userId, id));
}

export async function deletePassword(userId: string, id: string) {
  await SecureStore.deleteItemAsync(passKey(userId, id));
}

export async function clearPasswords(userId: string, uids: UIDEntry[]) {
  await Promise.all(uids.filter((u) => u.hasPassword).map((u) => deletePassword(userId, u.id)));
}
