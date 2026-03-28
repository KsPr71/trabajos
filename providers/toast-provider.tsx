import { ReactNode, createContext, useContext, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

const DEFAULT_TOAST: ToastState = {
  visible: false,
  message: '',
  type: 'info',
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastState>(DEFAULT_TOAST);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast: (message: string, type: ToastType = 'info', durationMs = 2200) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        setToast({
          visible: true,
          message,
          type,
        });

        timeoutRef.current = setTimeout(() => {
          setToast((previous) => ({
            ...previous,
            visible: false,
          }));
        }, durationMs);
      },
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible ? (
        <View pointerEvents="none" style={styles.overlay}>
          <View style={[styles.toast, getToastStyle(toast.type)]}>
            <Text style={styles.message}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return context;
}

function getToastStyle(type: ToastType) {
  if (type === 'success') {
    return styles.success;
  }
  if (type === 'error') {
    return styles.error;
  }
  return styles.info;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: Math.max(12, (Constants.statusBarHeight ?? 0) + 6),
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  success: {
    backgroundColor: '#0F5132',
    borderColor: '#2D8C5A',
  },
  error: {
    backgroundColor: '#611A15',
    borderColor: '#A63A32',
  },
  info: {
    backgroundColor: '#1E3A8A',
    borderColor: '#375FC8',
  },
  message: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
