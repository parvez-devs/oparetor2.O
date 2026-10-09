import type { Preferences } from "./types";

export const themes = {
  dark: {
    bg: "#080d14",
    card: "#0e1623",
    card2: "#111c2b",
    border: "#1a2540",
    primary: "#3b9dff",
    primaryDim: "#1a4a80",
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b",
    text: "#e8f0fe",
    secondary: "#8899bb",
    muted: "#5f6f8e",
    input: "#0b1320"
  },
  light: {
    bg: "#f0f4ff",
    card: "#ffffff",
    card2: "#f8faff",
    border: "#dde5f5",
    primary: "#238cff",
    primaryDim: "#cfe6ff",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
    text: "#0d1b3e",
    secondary: "#4a5878",
    muted: "#70809e",
    input: "#ffffff"
  }
};

export type Theme = typeof themes.dark;

export function getTheme(prefs: Preferences): Theme {
  return themes[prefs.theme];
}

export function textSize(prefs: Preferences, base: number): number {
  const factor = prefs.fontSize === "sm" ? 0.92 : prefs.fontSize === "lg" ? 1.1 : 1;
  return Math.round(base * factor);
}
