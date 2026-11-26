import { useSyncExternalStore } from "react";
import { getActiveTheme, subscribeTheme } from "@/lib/applyTheme";
import { THEMES, type ThemeInfo } from "@/lib/themes";

/** The theme the page is showing; re-renders when an admin switches themes */
export const useTheme = (): ThemeInfo => THEMES[useSyncExternalStore(subscribeTheme, getActiveTheme)];
