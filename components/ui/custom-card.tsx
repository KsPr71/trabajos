import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TrabajoCardEstado } from "@/components/trabajo-card";
import { ThemeColors, useAppTheme } from "@/providers/theme-provider";

type TrabajoCustomCardProps = {
  nombreTrabajo: string;
  autor: string;
  especialidad: string;
  tipoTrabajo: string;
  tipoTrabajoColor?: string | null;
  fechaEntrega: string | null;
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
  fechaEntrega,
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
  const titleTextColor = getReadableTextColor(titleBackground);
  const resolvedEntregaAlertType =
    entregaAlertType ?? (showEntregaAlertChip ? "esta_semana" : null);
  const entregaAlertChip = getEntregaAlertChip(resolvedEntregaAlertType);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, accentBorder ? styles.cardWithAccent : null]}
    >
      <View style={styles.tab}>
        <Text style={styles.tabText}>{tipoTrabajo}</Text>
      </View>

      <View style={styles.cardBody}>
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
            </View>

            <View style={[styles.chipsRow]}>
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
                <Text style={[styles.chipText, { color: chip.textColor }]}>
                  {chip.label}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
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
      borderTopRightRadius: 8,
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
      fontWeight: "700",
      letterSpacing: 0.2,
      textTransform: "uppercase",
      paddingRight: 30,
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
      gap: 6,
      alignSelf: "flex-end",
      marginTop: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
      //borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 10,
      borderTopLeftRadius: 50,
    },
    entregaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: "#DC2626",
    },
    entregaChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    statusChip: {
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 5,
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
      borderWidth: 1,
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 4,
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
      backgroundColor: "#059669",
      textColor: "#FFFFFF",
    };
  }
  if (estado === "terminado") {
    return {
      label: "Terminado",
      backgroundColor: "#22A06B",
      textColor: "#FFFFFF",
    };
  }
  if (estado === "en_proceso") {
    return {
      label: "En proceso",
      backgroundColor: "#0891B2",
      textColor: "#FFFFFF",
    };
  }
  return {
    label: "Creado",
    backgroundColor: colors.buttonBg,
    textColor: colors.buttonText,
  };
}

function getEntregaAlertChip(alertType: "esta_semana" | "vencido" | null) {
  if (alertType === "vencido") {
    return {
      label: "Vencido",
      backgroundColor: "#DC2626",
      textColor: "#FFFFFF",
    };
  }
  if (alertType === "esta_semana") {
    return {
      label: "Esta semana",
      backgroundColor: "#F59E0B",
      textColor: "#1B1400",
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

export default WindowsFolderCard;
