import { Pressable, StyleSheet, Text, View } from "react-native";

import { ThemeColors, useAppTheme } from "@/providers/theme-provider";

export type TrabajoCardEstado =
  | "creado"
  | "en_proceso"
  | "terminado"
  | "entregado";

type TrabajoCardProps = {
  nombreTrabajo: string;
  autor: string;
  especialidad: string;
  tipoTrabajo: string;
  fechaEntrega: string | null;
  estado: TrabajoCardEstado;
  onPress: () => void;
  accentBorder?: boolean;
};

export function TrabajoCard({
  nombreTrabajo,
  autor,
  especialidad,
  tipoTrabajo,
  fechaEntrega,
  estado,
  onPress,
  accentBorder = false,
}: TrabajoCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const chip = getEstadoChip(estado, colors);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, accentBorder ? styles.cardWithAccent : null]}
    >
      <View style={styles.titleContainer}>
        <Text style={styles.cardTitle}>{nombreTrabajo}</Text>
      </View>
      <View style={styles.body}>
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
        <View style={styles.chipsRow}>
          <View style={styles.tipoChip}>
            <Text style={styles.tipoChipText}> {tipoTrabajo}</Text>
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
    </Pressable>
  );
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
      backgroundColor: "#F59E0B",
      textColor: "#1B1400",
    };
  }
  return {
    label: "Creado",
    backgroundColor: colors.buttonBg,
    textColor: colors.buttonText,
  };
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 8,
      elevation: 4,
    },
    cardWithAccent: {
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      elevation: 4,
    },
    titleContainer: {
      backgroundColor: colors.headerBg,
      padding: 16,
      borderTopRightRadius: 16,
      borderTopLeftRadius: 16,
    },
    body: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    chipsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-end",
      marginTop: 8,
    },
    statusChip: {
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    chipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    tipoChip: {
      alignSelf: "flex-start",
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tipoChipText: {
      color: colors.inputText,
      fontSize: 12,
      fontWeight: "700",
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    metaLabel: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
  });
}
