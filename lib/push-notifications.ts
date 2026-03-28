import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

let configuredUserId: string | null = null;
const FALLBACK_EAS_PROJECT_ID = '283c7cff-a08d-4082-a875-9d395ef6e93b';

export type PushDiagnostics = {
  executionEnvironment: string;
  platform: string;
  isDevice: boolean;
  permissionStatus: string;
  canAskAgain: boolean;
  projectId: string | null;
  token: string | null;
  tokenError: string | null;
  upsertOk: boolean;
  upsertError: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushTokenForUser(userId: string) {
  if (!userId) {
    return null;
  }

  // Expo Go (store client) no soporta push remotas en Android (SDK 53+).
  const executionEnvironment = getExecutionEnvironment();
  if (executionEnvironment.toLowerCase() === 'storeclient') {
    console.warn(
      'Push remotas no disponibles en Expo Go. Usa un Development Build o APK/IPA.'
    );
    return null;
  }

  if (!Device.isDevice) {
    console.warn('Push notifications requieren un dispositivo fisico.');
    return null;
  }

  await ensureNotificationChannel();

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    console.warn('Permiso de notificaciones denegado por el usuario.');
    return null;
  }

  const projectId = resolveProjectId();

  if (!projectId) {
    console.warn('No se encontro eas.projectId para generar ExpoPushToken.');
    return null;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    console.warn(
      `Fallo al obtener ExpoPushToken (projectId=${projectId}). Verifica que el build NO sea Expo Go y que el projectId pertenezca a este proyecto EAS.`,
      error
    );
    return null;
  }
  const now = new Date().toISOString();

  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.modelName ?? null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,expo_push_token' }
  );

  if (error) {
    console.warn('No se pudo guardar ExpoPushToken en Supabase.', error);
    return null;
  }

  return token;
}

export async function ensureNotificationSetup(userId: string | null) {
  if (!userId) {
    configuredUserId = null;
    return;
  }
  if (configuredUserId === userId) {
    return;
  }
  configuredUserId = userId;

  try {
    await registerPushTokenForUser(userId);
  } catch (error) {
    console.warn('No se pudo configurar push notifications.', error);
    configuredUserId = null;
  }
}

async function ensureNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1F4EA8',
  });
}

export async function runPushDiagnostics(userId: string): Promise<PushDiagnostics> {
  const executionEnvironment = getExecutionEnvironment();
  const isExpoGo = executionEnvironment.toLowerCase() === 'storeclient';
  const projectId = resolveProjectId();

  await ensureNotificationChannel();

  const initialPermissions = await Notifications.getPermissionsAsync();
  let permissionStatus = initialPermissions.status;
  let canAskAgain = Boolean((initialPermissions as { canAskAgain?: boolean }).canAskAgain);

  if (permissionStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    permissionStatus = requested.status;
    canAskAgain = Boolean((requested as { canAskAgain?: boolean }).canAskAgain);
  }

  const diagnostics: PushDiagnostics = {
    executionEnvironment,
    platform: Platform.OS,
    isDevice: Device.isDevice,
    permissionStatus,
    canAskAgain,
    projectId,
    token: null,
    tokenError: null,
    upsertOk: false,
    upsertError: null,
  };

  if (isExpoGo) {
    diagnostics.tokenError = 'Entorno Expo Go (store client): push remotas no soportadas.';
    return diagnostics;
  }

  if (!Device.isDevice) {
    diagnostics.tokenError = 'No es un dispositivo fisico.';
    return diagnostics;
  }

  if (permissionStatus !== 'granted') {
    diagnostics.tokenError = 'Permiso de notificaciones denegado.';
    return diagnostics;
  }

  if (!projectId) {
    diagnostics.tokenError = 'No hay projectId EAS disponible.';
    return diagnostics;
  }

  try {
    diagnostics.token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    diagnostics.tokenError = `Error obteniendo token: ${String(error)}`;
    return diagnostics;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: diagnostics.token,
      platform: Platform.OS,
      device_name: Device.modelName ?? null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,expo_push_token' }
  );

  if (error) {
    diagnostics.upsertError = error.message;
    return diagnostics;
  }

  diagnostics.upsertOk = true;
  return diagnostics;
}

function resolveProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    FALLBACK_EAS_PROJECT_ID
  );
}

function getExecutionEnvironment() {
  return String((Constants as unknown as { executionEnvironment?: string }).executionEnvironment ?? '');
}
