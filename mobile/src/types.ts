export type UIDStatus = "pending" | "success" | "error";
export type ThemeMode = "dark" | "amoled" | "light" | "system";
export type SyncStatus = "synced" | "syncing" | "offline" | "conflict" | "error";
export type SortMode = "newest" | "name" | "status";

export interface UIDEntry {
  id: string;
  uid: string;
  name?: string;
  username?: string;
  profilePic?: string;
  followerCount?: number;
  hasInstagram?: boolean;
  status: UIDStatus;
  fetchedAt?: string;
  saved?: boolean;
  reInput?: boolean;
  hasPassword?: boolean;
  collection?: string;
  tags?: string[];
  updatedAt?: string;
}

export interface Preferences {
  theme: ThemeMode;
  fontSize: "sm" | "md" | "lg";
  viewMode: "full" | "compact";
  swipeToDelete: boolean;
  autoRetry: boolean;
  haptics: boolean;
  reduceMotion: boolean;
}

export interface VaultConfig {
  enabled: boolean;
  biometric: boolean;
  requireForPassword: boolean;
  blockScreenshots: boolean;
}

export interface User {
  id: string;
  email?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: User;
}

export interface CloudUIDRow {
  id: string;
  user_id: string;
  uid: string;
  name: string | null;
  username: string | null;
  profile_pic: string | null;
  follower_count: number | null;
  has_instagram: boolean;
  status: UIDStatus;
  fetched_at: string | null;
  saved: boolean;
  re_input: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PREFS: Preferences = {
  theme: "amoled",
  fontSize: "md",
  viewMode: "compact",
  swipeToDelete: true,
  autoRetry: false,
  haptics: true,
  reduceMotion: false
};

export const DEFAULT_VAULT: VaultConfig = {
  enabled: false,
  biometric: false,
  requireForPassword: false,
  blockScreenshots: false
};
