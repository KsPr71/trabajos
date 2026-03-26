import 'react-native-reanimated';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/providers/auth-provider';
import { AppThemeProvider, useAppTheme } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';

function RootNavigation() {
  const { isDark } = useAppTheme();

  return (
    <>
      <ToastProvider>
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </ToastProvider>
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
