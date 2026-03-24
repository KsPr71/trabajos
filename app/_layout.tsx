import 'react-native-reanimated';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/providers/auth-provider';
import { AppThemeProvider, useAppTheme } from '@/providers/theme-provider';

function RootNavigation() {
  const { isDark } = useAppTheme();

  return (
    <>
      <AuthProvider>
        <Slot />
      </AuthProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <RootNavigation />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
