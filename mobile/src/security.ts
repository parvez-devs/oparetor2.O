import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { DEFAULT_VAULT, type VaultConfig } from "./types";

function configKey(userId: string) {
  return ("uid2_vault_config_" + userId).replace(/[^a-zA-Z0-9._-]/g, "_");
}
function pinKey(userId: string) {
  return ("uid2_vault_pin_" + userId).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function hashPin(pin: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, "uid2:" + pin);
}

export async function loadVaultConfig(userId: string): Promise<VaultConfig> {
  try {
    const raw = await SecureStore.getItemAsync(configKey(userId));
    return raw ? { ...DEFAULT_VAULT, ...(JSON.parse(raw) as Partial<VaultConfig>) } : { ...DEFAULT_VAULT };
  } catch {
    return { ...DEFAULT_VAULT };
  }
}

export async function saveVaultConfig(userId: string, config: VaultConfig) {
  await SecureStore.setItemAsync(configKey(userId), JSON.stringify(config));
}

export async function setVaultPin(userId: string, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits");
  await SecureStore.setItemAsync(pinKey(userId), await hashPin(pin));
}

export async function hasVaultPin(userId: string) {
  return Boolean(await SecureStore.getItemAsync(pinKey(userId)));
}

export async function verifyVaultPin(userId: string, pin: string) {
  const saved = await SecureStore.getItemAsync(pinKey(userId));
  if (!saved) return false;
  return saved === (await hashPin(pin));
}

export async function biometricCapability() {
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync()
  ]);
  return { available: hardware && enrolled, types };
}

export async function authenticateBiometric(reason = "Unlock UID 2.O") {
  const capability = await biometricCapability();
  if (!capability.available) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Use PIN",
    disableDeviceFallback: true,
    biometricsSecurityLevel: "strong"
  });
  return result.success;
}
