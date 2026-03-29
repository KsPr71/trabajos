import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/providers/theme-provider";

export type GananciaMensualItem = {
  key: string;
  mesLabel: string;
  esperadas: number;
  recibidas: number;
  total: number;
};

type DashboardGananciasMensualesCardProps = {
  loading: boolean;
  errorMessage: string | null;
  items: GananciaMensualItem[];
};

export function DashboardGananciasMensualesCard({
  loading,
  errorMessage,
  items,
}: DashboardGananciasMensualesCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const totalGeneral = items.reduce((acc, item) => {
    const totalMes = item.total > 0 ? item.total : item.recibidas + item.esperadas;
    return acc + totalMes;
  }, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Ganancias por meses</Text>
      <Text style={styles.sectionSubtitle}>
        Grafico mensual de ganancias recibidas y esperadas.
      </Text>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.buttonBg} />
          <Text style={styles.stateText}>Calculando ganancias por mes...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Error cargando grafico: {errorMessage}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>No hay datos con fecha de entrega para graficar.</Text>
        </View>
      ) : (
        <>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#16A34A" }]} />
              <Text style={styles.legendText}>Recibidas</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#D97706" }]} />
              <Text style={styles.legendText}>Esperadas</Text>
            </View>
          </View>

          <View style={styles.chartWrap}>
            {items.map((item) => {
              const receivedWidth =
                totalGeneral > 0 ? (item.recibidas / totalGeneral) * 100 : 0;
              const expectedWidth =
                totalGeneral > 0 ? (item.esperadas / totalGeneral) * 100 : 0;

              return (
                <View key={item.key} style={styles.chartRow}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowLabel}>{item.mesLabel}</Text>
                    <Text style={styles.rowTotal}>{formatMoney(item.total)}</Text>
                  </View>

                  <View style={styles.track}>
                    {item.recibidas > 0 ? (
                      <View
                        style={[
                          styles.segment,
                          { width: `${receivedWidth}%`, backgroundColor: "#16A34A" },
                        ]}
                      />
                    ) : null}
                    {item.esperadas > 0 ? (
                      <View
                        style={[
                          styles.segment,
                          { width: `${expectedWidth}%`, backgroundColor: "#D97706" },
                        ]}
                      />
                    ) : null}
                  </View>

                  <Text style={styles.breakdownText}>
                    Recibidas: {formatMoney(item.recibidas)} | Esperadas:{" "}
                    {formatMoney(item.esperadas)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
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
    legendRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
      flexWrap: "wrap",
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.inputBg,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: 999,
    },
    legendText: {
      color: colors.inputText,
      fontSize: 12,
      fontWeight: "700",
    },
    chartWrap: {
      gap: 12,
    },
    chartRow: {
      gap: 7,
    },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    rowTotal: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "800",
    },
    track: {
      height: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      flexDirection: "row",
      overflow: "hidden",
    },
    segment: {
      height: "100%",
    },
    breakdownText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}

function formatMoney(value: number) {
  const abs = Math.abs(value);
  const [integerPart, decimalPart] = abs.toFixed(2).split(".");
  const integerWithSeparator = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  return `${sign}$${integerWithSeparator},${decimalPart}`;
}
