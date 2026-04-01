import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";

export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  background: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  buttonBg: string;
  buttonText: string;
  badgeBg: string;
  badgeText: string;
  headerBg: string;
  headerText: string;
  drawerBg: string;
  drawerActiveBg: string;
  drawerActiveText: string;
  drawerInactiveText: string;
  tabBg: string;
  tabBorder: string;
  tabActive: string;
  tabInactive: string;
};

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const lightColors: ThemeColors = {
  background: "#F3F7FF",
  card: "#FFFFFF",
  border: "#B6CDF5",
  textPrimary: "#0F2A4D",
  textSecondary: "#31527F",
  inputBg: "#EAF1FF",
  inputText: "#0F2A4D",
  inputPlaceholder: "#6D88B2",
  buttonBg: "#1F4EA8",
  buttonText: "#FFFFFF",
  badgeBg: "#1F4EA8",
  badgeText: "#FFFFFF",
  headerBg: "#E5EEFF",
  headerText: "#0F2A4D",
  drawerBg: "#F0F6FF",
  drawerActiveBg: "#1F4EA8",
  drawerActiveText: "#FFFFFF",
  drawerInactiveText: "#31527F",
  tabBg: "#E5EEFF",
  tabBorder: "#B6CDF5",
  tabActive: "#1F4EA8",
  tabInactive: "#6D88B2",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const mode: ThemeMode = "light";
  const toggleTheme = () => {
    // Tema fijo en claro por requerimiento de producto.
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: false,
      colors: lightColors,
      toggleTheme,
    }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme debe usarse dentro de AppThemeProvider");
  }
  return context;
}
