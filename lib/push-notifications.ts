import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

let configuredUserId: string | null = null;

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
  const executionEnvironment = String(
    (Constants as unknown as { executionEnvironment?: string }).executionEnvironment ?? ''
  );
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

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null;

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
