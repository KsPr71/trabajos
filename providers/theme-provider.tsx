import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'dark' | 'light';

type ThemeColors = {
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

const STORAGE_KEY = 'app_theme_mode';

const darkColors: ThemeColors = {
  background: '#0B1F3A',
  card: '#1F4EA8',
  border: '#D8E7FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#DCE8FF',
  inputBg: '#EEF4FF',
  inputText: '#0B1F3A',
  inputPlaceholder: '#7C95C9',
  buttonBg: '#0B1F3A',
  buttonText: '#FFFFFF',
  badgeBg: '#D8E7FF',
  badgeText: '#0B1F3A',
  headerBg: '#0B1F3A',
  headerText: '#FFFFFF',
  drawerBg: '#13315E',
  drawerActiveBg: '#D8E7FF',
  drawerActiveText: '#0B1F3A',
  drawerInactiveText: '#D8E7FF',
  tabBg: '#13315E',
  tabBorder: '#244A85',
  tabActive: '#FFFFFF',
  tabInactive: '#A9C1E7',
};

const lightColors: ThemeColors = {
  background: '#F3F7FF',
  card: '#FFFFFF',
  border: '#B6CDF5',
  textPrimary: '#0F2A4D',
  textSecondary: '#31527F',
  inputBg: '#EAF1FF',
  inputText: '#0F2A4D',
  inputPlaceholder: '#6D88B2',
  buttonBg: '#1F4EA8',
  buttonText: '#FFFFFF',
  badgeBg: '#1F4EA8',
  badgeText: '#FFFFFF',
  headerBg: '#E5EEFF',
  headerText: '#0F2A4D',
  drawerBg: '#F0F6FF',
  drawerActiveBg: '#1F4EA8',
  drawerActiveText: '#FFFFFF',
  drawerInactiveText: '#31527F',
  tabBg: '#E5EEFF',
  tabBorder: '#B6CDF5',
  tabActive: '#1F4EA8',
  tabInactive: '#6D88B2',
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted || (saved !== 'dark' && saved !== 'light')) {
          return;
        }
        setMode(saved);
      })
      .catch((error) => {
        console.warn('No se pudo leer el tema guardado.', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    AsyncStorage.setItem(STORAGE_KEY, nextMode).catch((error) => {
      console.warn('No se pudo guardar el tema.', error);
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkColors : lightColors,
      toggleTheme,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme debe usarse dentro de AppThemeProvider');
  }
  return context;
}
