export type UIDStatus = "pending" | "success" | "error";

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
}

export interface Preferences {
  theme: "dark" | "light";
  fontSize: "sm" | "md" | "lg";
  viewMode: "full" | "compact";
  swipeToDelete: boolean;
  autoRetry: boolean;
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
  theme: "dark",
  fontSize: "md",
  viewMode: "compact",
  swipeToDelete: false,
  autoRetry: false
};
