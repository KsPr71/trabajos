import { Linking } from "react-native";

const APP_BRAND_TEXT = "Archei";

export function normalizeWhatsAppPhone(rawPhone: string) {
  return rawPhone.replace(/[^\d]/g, "");
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const textQuery = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalizedPhone}${textQuery}`;
}

export async function openWhatsAppChat(phone: string, message?: string) {
  const url = buildWhatsAppUrl(phone, message);

  if (!url) {
    throw new Error("Telefono invalido para WhatsApp.");
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error("No se pudo abrir WhatsApp en este dispositivo.");
  }

  await Linking.openURL(url);
}

export function buildTrabajoTerminadoWhatsAppMessage(nombreTrabajo: string) {
  const cleanNombre = nombreTrabajo.trim() || "sin nombre";
  return `Su trabajo -${cleanNombre}- esta terminado y listo para recoger. Por favor, contactar.`;
}
