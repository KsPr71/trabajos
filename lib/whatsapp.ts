import { Linking } from "react-native";

const APP_BRAND_TEXT = "Archei-App";

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
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) {
    throw new Error("Telefono invalido para WhatsApp.");
  }

  const encodedMessage = message ? encodeURIComponent(message) : "";
  const candidates = [
    `whatsapp://send?phone=${normalizedPhone}${encodedMessage ? `&text=${encodedMessage}` : ""}`,
    `https://api.whatsapp.com/send?phone=${normalizedPhone}${encodedMessage ? `&text=${encodedMessage}` : ""}`,
    `https://wa.me/${normalizedPhone}${encodedMessage ? `?text=${encodedMessage}` : ""}`,
  ];

  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `No se pudo abrir WhatsApp en este dispositivo.${lastError ? ` ${String(lastError)}` : ""}`,
  );
}

export function buildTrabajoTerminadoWhatsAppMessage(nombreTrabajo: string) {
  const cleanNombre = nombreTrabajo.trim() || "sin nombre";
  return `${APP_BRAND_TEXT}\nSu trabajo (${cleanNombre}) esta terminado y listo para recoger. Por favor, contactar.`;
}
