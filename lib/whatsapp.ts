import { Linking } from 'react-native';

export function normalizeWhatsAppPhone(rawPhone: string) {
  return rawPhone.replace(/[^\d]/g, '');
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const textQuery = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalizedPhone}${textQuery}`;
}

export async function openWhatsAppChat(phone: string, message?: string) {
  const url = buildWhatsAppUrl(phone, message);

  if (!url) {
    throw new Error('Telefono invalido para WhatsApp.');
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('No se pudo abrir WhatsApp en este dispositivo.');
  }

  await Linking.openURL(url);
}
