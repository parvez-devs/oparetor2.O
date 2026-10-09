import type { ColorSchemeName } from "react-native";
import type { Preferences } from "./types";

export const themes = {
  dark: {
    bg: "#070c13",
    card: "#0d1622",
    card2: "#121e2d",
    border: "#1d2d43",
    edge: "#214d70",
    primary: "#46a7ff",
    cyan: "#36e0ff",
    primaryDim: "#123b61",
    success: "#31d17c",
    error: "#ff5e6c",
    warning: "#ffb84a",
    text: "#edf7ff",
    secondary: "#93a8c4",
    muted: "#60738e",
    input: "#09111b",
    overlay: "rgba(3,8,14,0.78)"
  },
  amoled: {
    bg: "#000000",
    card: "#060a0f",
    card2: "#0a1119",
    border: "#15243a",
    edge: "#0f527a",
    primary: "#39a7ff",
    cyan: "#21e6ff",
    primaryDim: "#0a3454",
    success: "#2ed57c",
    error: "#ff5667",
    warning: "#ffb54a",
    text: "#f3fbff",
    secondary: "#91a6c0",
    muted: "#526681",
    input: "#03070b",
    overlay: "rgba(0,0,0,0.84)"
  },
  light: {
    bg: "#eff5ff",
    card: "#ffffff",
    card2: "#f7faff",
    border: "#dbe6f5",
    edge: "#bfdcff",
    primary: "#168cff",
    cyan: "#00bde8",
    primaryDim: "#d7ebff",
    success: "#16a766",
    error: "#dc4254",
    warning: "#d98600",
    text: "#0b1a33",
    secondary: "#435776",
    muted: "#70819d",
    input: "#ffffff",
    overlay: "rgba(11,26,51,0.35)"
  }
};

export type Theme = typeof themes.dark;

export function getTheme(prefs: Preferences, system: ColorSchemeName = "dark"): Theme {
  if (prefs.theme === "system") return system === "light" ? themes.light : themes.dark;
  return themes[prefs.theme];
}

export function textSize(prefs: Preferences, base: number): number {
  const factor = prefs.fontSize === "sm" ? 0.92 : prefs.fontSize === "lg" ? 1.1 : 1;
  return Math.round(base * factor);
}
