import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { registerPushTokenForUser } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function AjustesScreen() {
  const { isDark, mode, toggleTheme, colors } = useAppTheme();
  const { showToast } = useToast();
  const styles = createStyles(colors);
  const [testingPush, setTestingPush] = useState(false);
  const [pushDebug, setPushDebug] = useState<string | null>(null);

  const handlePushTest = async () => {
    const {
      data: { session: liveSession },
      error: liveSessionError,
    } = await supabase.auth.getSession();
    if (liveSessionError) {
      showToast(`No se pudo leer sesion actual: ${liveSessionError.message}`, 'error');
      return;
    }

    const userId = liveSession?.user.id;
    if (!userId) {
      showToast('No hay sesion activa para probar push.', 'error');
      return;
    }

    setTestingPush(true);
    setPushDebug(null);

    try {
      const token = await registerPushTokenForUser(userId);
      const { data: storedTokenRow, error: tokenReadError } = await supabase
        .from('device_push_tokens')
        .select('expo_push_token,last_seen_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenReadError) {
        showToast(`No se pudo leer token guardado: ${tokenReadError.message}`, 'error');
        return;
      }

      const { error: pushError } = await supabase.functions.invoke('push-trabajo-created', {
        headers: liveSession?.access_token
          ? {
              Authorization: `Bearer ${liveSession.access_token}`,
            }
          : undefined,
        body: {
          trabajoNombre: 'Prueba push Archei',
          fechaEntrega: null,
        },
      });

      if (pushError) {
        const errorDetail = await readFunctionsErrorDetail(pushError);
        showToast(`No se pudo enviar push de prueba: ${errorDetail}`, 'error');
        return;
      }

      const tokenToShow = token ?? storedTokenRow?.expo_push_token ?? null;
      setPushDebug(
        tokenToShow
          ? `Token activo: ${tokenToShow.slice(0, 24)}... | Ultimo registro: ${
              storedTokenRow?.last_seen_at ?? 'sin fecha'
            }`
          : 'No se obtuvo token en este entorno (usa Development Build/APK, no Expo Go).'
      );

      showToast('Push de prueba enviada. Revisa la notificacion en el dispositivo.', 'success');
    } catch (error) {
      showToast(`Error en prueba push: ${String(error)}`, 'error');
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Ajustes</Text>
        <Text style={styles.subtitle}>Tema de la aplicacion</Text>

        <View style={styles.row}>
          <Text style={styles.label}>{mode === 'dark' ? 'Oscuro (actual)' : 'Claro'}</Text>
          <Switch
            value={!isDark}
            onValueChange={toggleTheme}
            thumbColor={colors.buttonText}
            trackColor={{ false: colors.tabInactive, true: colors.buttonBg }}
          />
        </View>

        <Text style={styles.subtitle}>Notificaciones push</Text>
        <Pressable
          onPress={handlePushTest}
          disabled={testingPush}
          style={[styles.pushButton, testingPush ? styles.pushButtonDisabled : null]}
        >
          {testingPush ? (
            <>
              <ActivityIndicator color={colors.buttonText} />
              <Text style={styles.pushButtonText}>Probando...</Text>
            </>
          ) : (
            <Text style={styles.pushButtonText}>Probar notificacion push</Text>
          )}
        </Pressable>

        {pushDebug ? <Text style={styles.pushDebugText}>{pushDebug}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 20,
      gap: 10,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    label: {
      color: colors.inputText,
      fontSize: 16,
      fontWeight: '600',
    },
    pushButton: {
      backgroundColor: colors.buttonBg,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    pushButtonDisabled: {
      opacity: 0.8,
    },
    pushButtonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
    pushDebugText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}

async function readFunctionsErrorDetail(error: unknown) {
  const basic = error instanceof Error ? error.message : String(error);
  const response = (error as { context?: Response } | null)?.context;
  if (!response) {
    return basic;
  }

  try {
    const text = await response.text();
    if (!text) {
      return `${basic} (status ${response.status})`;
    }
    return `${basic} (status ${response.status}): ${text}`;
  } catch {
    return `${basic} (status ${response.status})`;
  }
}
