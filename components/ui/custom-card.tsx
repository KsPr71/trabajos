import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { TrabajoCardEstado } from "@/components/trabajo-card";
import { ThemeColors, useAppTheme } from "@/providers/theme-provider";

type TrabajoCustomCardProps = {
  nombreTrabajo: string;
  autor: string;
  especialidad: string;
  tipoTrabajo: string;
  tipoTrabajoColor?: string | null;
  enlaceDescargaMega?: string | null;
  fechaEntrega: string | null;
  estadoCreadoAt?: string | null;
  estadoEnProcesoAt?: string | null;
  estadoTerminadoAt?: string | null;
  estadoEntregadoAt?: string | null;
  estado: TrabajoCardEstado;
  onPress: () => void;
  accentBorder?: boolean;
  entregaAlertType?: "esta_semana" | "vencido";
  showEntregaAlertChip?: boolean;
};

export function TrabajoCustomCard({
  nombreTrabajo,
  autor,
  especialidad,
  tipoTrabajo,
  tipoTrabajoColor = null,
  enlaceDescargaMega = null,
  fechaEntrega,
  estadoCreadoAt = null,
  estadoEnProcesoAt = null,
  estadoTerminadoAt = null,
  estadoEntregadoAt = null,
  estado,
  onPress,
  accentBorder = false,
  entregaAlertType,
  showEntregaAlertChip = false,
}: TrabajoCustomCardProps) {
  const { colors } = useAppTheme();
  const styles = createTrabajoStyles(colors);
  const chip = getEstadoChip(estado, colors);
  const tipoColor = normalizeHexColor(tipoTrabajoColor);
  const tipoChipBg = tipoColor ?? colors.inputBg;
  const tipoChipTextColor = getReadableTextColor(tipoChipBg);
  const titleBackground = tipoColor
    ? lightenHexColor(tipoColor, 20)
    : colors.headerBg;
  const titleTextColor = "#000000";
  const resolvedEntregaAlertType =
    entregaAlertType ?? (showEntregaAlertChip ? "esta_semana" : null);
  const entregaAlertChip = getEntregaAlertChip(resolvedEntregaAlertType);
  const tiempoLabel = getTiempoLabel(estado);
  const tabIconName =
    estado === "entregado" ? "folder-outline" : "folder-open-outline";
  const showMegaDownloadButton =
    Boolean(enlaceDescargaMega?.trim()) &&
    (estado === "terminado" || estado === "entregado");

  const handleMegaDownloadPress = async () => {
    const normalizedLink = normalizeExternalUrl(enlaceDescargaMega);
    if (!normalizedLink) {
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(normalizedLink);
      if (!canOpen) {
        Alert.alert("Enlace no disponible", "No se pudo abrir el enlace de MEGA.");
        return;
      }
      await Linking.openURL(normalizedLink);
    } catch {
      Alert.alert("Error", "No se pudo abrir el enlace de descarga.");
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, accentBorder ? styles.cardWithAccent : null]}
    >
      <View style={styles.tab}>
        <View style={styles.tabContent}>
          <Ionicons
            name={tabIconName}
            size={14}
            color={colors.textSecondary}
            style={styles.tabIcon}
          />
          <Text style={styles.tabText}>{tipoTrabajo}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {estado === "entregado" ? <PaidCornerTriangle styles={styles} /> : null}

        <View
          style={[
            styles.titleContainer,
            { backgroundColor: `${titleBackground}30` },
          ]}
        >
          <Text style={[styles.cardTitle, { color: titleTextColor }]}>
            {nombreTrabajo}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: `${titleBackground}30`,
            padding: 1,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          <View style={styles.body}>
            <View style={{ marginTop: 10, marginBottom: 10 }}>
              <Text style={styles.metaText}>
                <Text style={styles.metaLabel}>Autor: </Text>
                {autor}
              </Text>
              <Text style={styles.metaText}>
                <Text style={styles.metaLabel}>Especialidad: </Text>
                {especialidad}
              </Text>
              <Text style={styles.metaText}>
                <Text style={styles.metaLabel}>Entrega: </Text>
                {formatFechaEntrega(fechaEntrega)}
              </Text>
              <Text style={styles.metaText}>
                <Text style={styles.metaLabel}>{tiempoLabel}: </Text>
                {getTiempoEstadoTexto({
                  estado,
                  fechaEntrega,
                  estadoCreadoAt,
                  estadoEnProcesoAt,
                  estadoTerminadoAt,
                  estadoEntregadoAt,
                })}
              </Text>
            </View>

            <View style={[styles.chipsRow]}>
              {showMegaDownloadButton ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    void handleMegaDownloadPress();
                  }}
                  style={styles.megaButton}
                >
                  <View style={styles.megaLogoBadge}>
                    <Text style={styles.megaLogoText}>M</Text>
                  </View>
                  <Text style={styles.megaButtonText}>MEGA</Text>
                  <Ionicons name="download-outline" size={14} color="#FFFFFF" />
                </Pressable>
              ) : null}

              <View style={styles.rightChipsRow}>
                {entregaAlertChip ? (
                  <View
                    style={[
                      styles.entregaChip,
                      { backgroundColor: entregaAlertChip.backgroundColor },
                    ]}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={14}
                      color={entregaAlertChip.textColor}
                    />
                    <Text
                      style={[
                        styles.entregaChipText,
                        { color: entregaAlertChip.textColor },
                      ]}
                    >
                      {entregaAlertChip.label}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.tipoChip,
                    { backgroundColor: tipoChipBg, borderColor: tipoChipBg },
                  ]}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={13}
                    color={tipoChipTextColor}
                  />
                  <Text
                    style={[styles.tipoChipText, { color: tipoChipTextColor }]}
                  >
                    {tipoTrabajo}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: chip.backgroundColor },
                  ]}
                >
                  <Ionicons name={chip.iconName} size={13} color={chip.textColor} />
                  <Text style={[styles.chipText, { color: chip.textColor }]}>
                    {chip.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PaidCornerTriangle({
  styles,
}: {
  styles: ReturnType<typeof createTrabajoStyles>;
}) {
  return (
    <View pointerEvents="none" style={styles.paidCornerWrap}>
      <View style={styles.paidCornerRibbon}>
        <Text style={styles.paidCornerText}>PAGADO</Text>
      </View>
    </View>
  );
}

const WindowsFolderCard = () => {
  return (
    <View style={demoStyles.container}>
      <View style={demoStyles.tab}>
        <Text style={demoStyles.tabText}>Hola</Text>
      </View>
      <View style={demoStyles.cardBody}>
        <Text>Esta es una card</Text>
      </View>
    </View>
  );
};

const demoStyles = StyleSheet.create({
  container: {
    margin: 5,
    position: "relative",
  },
  tab: {
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
    marginLeft: 0,
    marginBottom: -2,
    //paddingHorizontal: 15,
    paddingVertical: 5,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    zIndex: 3,
    borderColor: "blue",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
    paddingHorizontal: 10,
  },
  cardBody: {
    backgroundColor: "#ffffff",
    padding: 20,
    paddingTop: 26,
    borderRadius: 16,
    borderTopLeftRadius: 16,
    minHeight: 150,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: "blue",
  },
});

function createTrabajoStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      position: "relative",
      marginTop: 2,
    },
    cardWithAccent: {
      borderLeftWidth: 0,
    },
    tab: {
      position: "relative",
      alignSelf: "flex-start",
      marginLeft: 0,
      marginBottom: -2.5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 30,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderRightWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      zIndex: 4,
      //elevation: 6,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.2,
      textTransform: "uppercase",
      paddingRight: 50,
    },
    tabContent: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 10,
    },
    tabIcon: {
      marginRight: 6,
    },
    cardBody: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      elevation: 4,
      overflow: "hidden",
      padding: 10,
    },
    paidCornerWrap: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 104,
      height: 104,
      overflow: "hidden",
      zIndex: 20,
    },
    paidCornerRibbon: {
      position: "absolute",
      top: 20,
      right: -56,
      width: 180,
      height: 28,
      backgroundColor: "#22C55E",
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "45deg" }],
    },
    paidCornerText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: "#FFFFFF",
    },
    titleContainer: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingTop: 18,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,

      //borderBottomWidth: 2,
      borderBottomColor: colors.border,
      //marginBottom: 10,
    },
    body: {
      paddingHorizontal: 16,
      //paddingBottom: 10,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: "#ffffff",
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
    },
    chipsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      width: "100%",
      borderTopColor: colors.border,
      paddingVertical: 10,
      gap: 8,
    },
    rightChipsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginLeft: "auto",
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    megaButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#D9272E",
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      minHeight: 26,
      borderWidth: 1,
      borderColor: "#A81D24",
    },
    megaLogoBadge: {
      width: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    megaLogoText: {
      color: "#D9272E",
      fontSize: 11,
      fontWeight: "900",
      marginTop: -1,
    },
    megaButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    entregaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minHeight: 27,
      backgroundColor: "#DC2626",
    },
    entregaChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minHeight: 27,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
    },
    chipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    tipoChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minHeight: 27,
    },
    tipoChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 5,
    },
    metaLabel: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
  });
}

function getEstadoChip(estado: TrabajoCardEstado, colors: ThemeColors) {
  if (estado === "entregado") {
    return {
      label: "Entregado",
      backgroundColor: "#1D4ED8",
      textColor: "#FFFFFF",
      iconName: "checkmark-done-outline" as const,
    };
  }
  if (estado === "terminado") {
    return {
      label: "Terminado",
      backgroundColor: "#22A06B",
      textColor: "#FFFFFF",
      iconName: "checkmark-circle-outline" as const,
    };
  }
  if (estado === "en_proceso") {
    return {
      label: "En proceso",
      backgroundColor: "#D946EF",
      textColor: "#FFFFFF",
      iconName: "time-outline" as const,
    };
  }
  return {
    label: "Creado",
    backgroundColor: "#0EA5E9",
    textColor: colors.buttonText,
    iconName: "add-circle-outline" as const,
  };
}

function getEntregaAlertChip(alertType: "esta_semana" | "vencido" | null) {
  if (alertType === "vencido") {
    return {
      label: "Terminar",
      backgroundColor: "#DC2626",
      textColor: "#FFFFFF",
    };
  }
  if (alertType === "esta_semana") {
    return {
      label: "Terminar",
      backgroundColor: "#D97706",
      textColor: "#FFFFFF",
    };
  }
  return null;
}

function formatFechaEntrega(fechaEntrega: string | null) {
  if (!fechaEntrega) {
    return "Sin fecha";
  }
  const [year, month, day] = fechaEntrega.split("-");
  if (!year || !month || !day) {
    return fechaEntrega;
  }
  return `${day}/${month}/${year}`;
}

function getTiempoLabel(estado: TrabajoCardEstado) {
  if (estado === "entregado") {
    return "Entregado";
  }
  if (estado === "terminado") {
    return "Terminado";
  }
  return "Plazo";
}

function getTiempoEstadoTexto(input: {
  estado: TrabajoCardEstado;
  fechaEntrega: string | null;
  estadoCreadoAt: string | null;
  estadoEnProcesoAt: string | null;
  estadoTerminadoAt: string | null;
  estadoEntregadoAt: string | null;
}) {
  const creadoAt = parseAnyDate(input.estadoCreadoAt) ?? startOfDay(new Date());

  if (input.estado === "entregado") {
    const entregadoAt = parseAnyDate(input.estadoEntregadoAt);
    if (!entregadoAt) {
      return "Sin fecha";
    }
    return `Día ${formatDateTimeDisplay(entregadoAt)}`;
  }

  if (input.estado === "terminado") {
    const terminadoAt = parseAnyDate(input.estadoTerminadoAt);
    if (!terminadoAt) {
      return "Sin fecha de terminacion";
    }
    const diffDays = getDaysBetween(creadoAt, terminadoAt);
    if (diffDays === 0) {
      return "El mismo dia";
    }
    if (diffDays === 1) {
      return "1 dia";
    }
    return `${Math.max(diffDays, 0)} dias`;
  }

  const entregaAt = input.fechaEntrega
    ? parseISODate(input.fechaEntrega)
    : null;
  if (!entregaAt) {
    return "Sin fecha de entrega";
  }

  const now = startOfDay(new Date());
  const diffDays = getDaysBetween(now, entregaAt);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 1) {
      return "Pasado de fecha (1 dia)";
    }
    return `Pasado de fecha (${overdueDays} dias)`;
  }
  if (diffDays === 0) {
    return "Entrega hoy";
  }
  if (diffDays === 1) {
    return "1 dia restante";
  }
  return `${diffDays} dias restantes`;
}

function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseAnyDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseISODate(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getDaysBetween(from: Date, to: Date) {
  const fromDate = startOfDay(from);
  const toDate = startOfDay(to);
  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.floor(diffMs / 86400000);
}

function formatDateTimeDisplay(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

function lightenHexColor(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  const r = clampChannel(parseInt(clean.slice(0, 2), 16) + amount);
  const g = clampChannel(parseInt(clean.slice(2, 4), 16) + amount);
  const b = clampChannel(parseInt(clean.slice(4, 6), 16) + amount);

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clampChannel(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 255) {
    return 255;
  }
  return Math.round(value);
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function getReadableTextColor(hexColor: string) {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) {
    return "#FFFFFF";
  }
  const clean = normalized.slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 150 ? "#10233F" : "#FFFFFF";
}

function normalizeExternalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export default WindowsFolderCard;
