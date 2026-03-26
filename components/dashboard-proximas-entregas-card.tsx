import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/providers/theme-provider";

export type EntregasMesGroup = {
  key: string;
  mesLabel: string;
  trabajos: string[];
};

type DashboardProximasEntregasCardProps = {
  loading: boolean;
  errorMessage: string | null;
  groups: EntregasMesGroup[];
};

export function DashboardProximasEntregasCard({
  loading,
  errorMessage,
  groups,
}: DashboardProximasEntregasCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Proximas entregas</Text>
      <Text style={styles.sectionSubtitle}>
        Trabajos pendientes agrupados por mes de entrega.
      </Text>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.buttonBg} />
          <Text style={styles.stateText}>Cargando entregas...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Error cargando entregas: {errorMessage}</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>No hay entregas pendientes en los proximos meses.</Text>
        </View>
      ) : (
        <View style={styles.groupsWrap}>
          {groups.map((group) => (
            <View key={group.key} style={styles.groupCard}>
              <Text style={styles.groupTitle}>{group.mesLabel}</Text>
              <View style={styles.workList}>
                {group.trabajos.map((trabajo, index) => (
                  <Text key={`${group.key}-${index}-${trabajo}`} style={styles.workItem}>
                    - {trabajo}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 20,
      padding: 22,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
    },
    sectionSubtitle: {
      color: colors.textSecondary,
      marginTop: 6,
      marginBottom: 12,
      lineHeight: 20,
    },
    stateBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      padding: 12,
      gap: 8,
      alignItems: "center",
    },
    stateText: {
      color: colors.textSecondary,
      textAlign: "center",
    },
    groupsWrap: {
      gap: 10,
    },
    groupCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    groupTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    workList: {
      gap: 4,
    },
    workItem: {
      color: colors.inputText,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
  });
}
