import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

export type Theme = {
  mode: "light" | "dark";
  colors: {
    background: string;
    surface: string;
    border: string;
    text: string;
    mutedText: string;
    primary: string;
    primaryText: string;
    danger: string;
    success: string;
    warning: string;
    inputBg: string;
  };
};

const lightColors = {
  background: "#f8f9fa",
  surface: "#ffffff",
  border: "#e9ecef",
  text: "#222222",
  mutedText: "#666666",
  primary: "#3A805B",
  primaryText: "#ffffff",
  danger: "#e53935",
  success: "#43a047",
  warning: "#fbc02d",
  inputBg: "#f6f6f6",
};

// Dark theme tuned to "only dark black and light black" with green for actions
const darkColors = {
  background: "#000000", // pure black
  surface: "#0d0f10", // near-black for cards/surfaces
  border: "#1a1d1f", // subtle dark divider
  text: "#ffffff", // white text
  mutedText: "#a6a6a6", // light grey for secondary text
  primary: "#3A805B", // green for action buttons
  primaryText: "#ffffff",
  danger: "#ef5350",
  success: "#66bb6a",
  warning: "#ffca28",
  inputBg: "#0f1214", // slightly lighter than background for inputs
};

const STORAGE_KEY = "app:themeMode";

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system")
          setMode(stored);
      } catch {}
    })();
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSystemScheme(colorScheme)
    );
    return () => sub.remove();
  }, []);

  const resolvedMode: "light" | "dark" = useMemo(() => {
    if (mode === "system") return systemScheme === "dark" ? "dark" : "light";
    return mode;
  }, [mode, systemScheme]);

  const theme: Theme = useMemo(
    () => ({
      mode: resolvedMode,
      colors: resolvedMode === "dark" ? darkColors : lightColors,
    }),
    [resolvedMode]
  );

  const updateMode = (m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const value = useMemo(
    () => ({ theme, mode, setMode: updateMode }),
    [theme, mode]
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const themed = {
  screen: (t: Theme) => ({ flex: 1, backgroundColor: t.colors.background }),
  card: (t: Theme) => ({
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
  }),
  text: (t: Theme) => ({ color: t.colors.text }),
  muted: (t: Theme) => ({ color: t.colors.mutedText }),
  input: (t: Theme) => ({
    backgroundColor: t.colors.inputBg,
    color: t.colors.text,
  }),
  primaryButton: (t: Theme) => ({ backgroundColor: t.colors.primary }),
  primaryButtonText: (t: Theme) => ({ color: t.colors.primaryText }),
};
