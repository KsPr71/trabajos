import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/providers/theme-provider";

type EstadoTrabajo = "creado" | "en_proceso" | "terminado" | "entregado";

type ResumenTipoEstado = {
  tipoTrabajo: string;
  total: number;
  estadoCounts: Record<EstadoTrabajo, number>;
};

type GananciasResumen = {
  esperadas: number;
  recibidas: number;
  total: number;
};

const ESTADO_ORDER: EstadoTrabajo[] = [
  "creado",
  "en_proceso",
  "terminado",
  "entregado",
];

const ESTADO_META: Record<EstadoTrabajo, { label: string; color: string }> = {
  creado: { label: "Creado", color: "#2563EB" },
  en_proceso: { label: "En proceso", color: "#F59E0B" },
  terminado: { label: "Terminado", color: "#22A06B" },
  entregado: { label: "Entregado", color: "#059669" },
};

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [resumenPorTipo, setResumenPorTipo] = useState<ResumenTipoEstado[]>([]);
  const [ganancias, setGanancias] = useState<GananciasResumen>({
    esperadas: 0,
    recibidas: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxTotal = useMemo(() => {
    return resumenPorTipo.reduce((max, item) => Math.max(max, item.total), 0);
  }, [resumenPorTipo]);

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("trabajos")
      .select(
        "estado,tipo_trabajo:tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre,precio)",
      );

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setResumenPorTipo(buildResumenPorTipo(data));
    setGanancias(buildGanancias(data));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadResumen().catch((error) => {
        setLoading(false);
        setErrorMessage(String(error));
      });
    }, [loadResumen]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trabajos por tipo y estado</Text>
        <Text style={styles.sectionSubtitle}>
          Grafico de barras apiladas: cada barra representa un tipo de trabajo.
        </Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.buttonBg} />
            <Text style={styles.stateText}>Cargando resumen...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              Error cargando resumen: {errorMessage}
            </Text>
          </View>
        ) : resumenPorTipo.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No hay trabajos para graficar.</Text>
          </View>
        ) : (
          <>
            <View style={styles.legendWrap}>
              {ESTADO_ORDER.map((estado) => (
                <View key={estado} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: ESTADO_META[estado].color },
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {ESTADO_META[estado].label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.chartWrap}>
              {resumenPorTipo.map((item) => (
                <View key={item.tipoTrabajo} style={styles.chartRow}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowLabel}>{item.tipoTrabajo}</Text>
                    <Text style={styles.rowTotal}>{item.total}</Text>
                  </View>

                  <View style={styles.track}>
                    {ESTADO_ORDER.map((estado) => {
                      const estadoCount = item.estadoCounts[estado];
                      if (estadoCount <= 0 || maxTotal <= 0) {
                        return null;
                      }

                      const width = (estadoCount / maxTotal) * 100;
                      return (
                        <View
                          key={`${item.tipoTrabajo}-${estado}`}
                          style={[
                            styles.segment,
                            {
                              width: `${width}%`,
                              backgroundColor: ESTADO_META[estado].color,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>

                  <Text style={styles.breakdownText}>
                    C:{item.estadoCounts.creado} | P:
                    {item.estadoCounts.en_proceso} | T:
                    {item.estadoCounts.terminado} | E:
                    {item.estadoCounts.entregado}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ganancias</Text>
        <Text style={styles.sectionSubtitle}>
          Ganancias esperadas y recibidas.
        </Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.buttonBg} />
            <Text style={styles.stateText}>Calculando ganancias...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              Error calculando ganancias: {errorMessage}
            </Text>
          </View>
        ) : (
          <View style={styles.moneyWrap}>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Ganancias esperadas</Text>
              <Text style={[styles.moneyValue, styles.moneyExpected]}>
                {formatMoney(ganancias.esperadas)}
              </Text>
            </View>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Ganancias recibidas</Text>
              <Text style={[styles.moneyValue, styles.moneyReceived]}>
                {formatMoney(ganancias.recibidas)}
              </Text>
            </View>
            <View style={[styles.moneyRow, styles.moneyTotalRow]}>
              <Text style={styles.moneyTotalLabel}>Total</Text>
              <Text style={[styles.moneyValue, styles.moneyTotalValue]}>
                {formatMoney(ganancias.total)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      gap: 14,
    },
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
    legendWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 12,
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
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: "hidden",
      minWidth: 30,
      textAlign: "center",
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
    moneyWrap: {
      gap: 10,
    },
    moneyRow: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    moneyLabel: {
      color: colors.inputText,
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    moneyValue: {
      fontSize: 15,
      fontWeight: "800",
    },
    moneyReceived: {
      color: "#16A34A",
    },
    moneyExpected: {
      color: "#D97706",
    },
    moneyTotalRow: {
      backgroundColor: colors.badgeBg,
    },
    moneyTotalLabel: {
      color: colors.background,
      fontSize: 15,
      fontWeight: "800",
      flex: 1,
    },
    moneyTotalValue: {
      color: colors.background,
      fontSize: 17,
    },
  });
}

function buildResumenPorTipo(rows: unknown): ResumenTipoEstado[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const grouped = new Map<string, ResumenTipoEstado>();

  for (const row of rows) {
    const typedRow = row as {
      estado?: string;
      tipo_trabajo?: unknown;
    };

    const estado = parseEstado(typedRow.estado);
    const tipoTrabajo = getTipoTrabajoNombre(typedRow.tipo_trabajo);

    const current = grouped.get(tipoTrabajo) ?? {
      tipoTrabajo,
      total: 0,
      estadoCounts: {
        creado: 0,
        en_proceso: 0,
        terminado: 0,
        entregado: 0,
      },
    };

    current.total += 1;
    current.estadoCounts[estado] += 1;
    grouped.set(tipoTrabajo, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.tipoTrabajo.localeCompare(b.tipoTrabajo);
  });
}

function getTipoTrabajoNombre(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { nombre?: string } | undefined;
    return first?.nombre ? String(first.nombre) : "Sin tipo";
  }
  if (value && typeof value === "object") {
    const record = value as { nombre?: string };
    return record.nombre ? String(record.nombre) : "Sin tipo";
  }
  return "Sin tipo";
}

function parseEstado(rawValue: unknown): EstadoTrabajo {
  if (rawValue === "entregado") {
    return "entregado";
  }
  if (rawValue === "en_proceso") {
    return "en_proceso";
  }
  if (rawValue === "terminado") {
    return "terminado";
  }
  return "creado";
}

function buildGanancias(rows: unknown): GananciasResumen {
  if (!Array.isArray(rows)) {
    return { esperadas: 0, recibidas: 0, total: 0 };
  }

  let esperadas = 0;
  let recibidas = 0;

  for (const row of rows) {
    const typedRow = row as {
      estado?: string;
      tipo_trabajo?: unknown;
    };

    const estado = parseEstado(typedRow.estado);
    const precio = getTipoTrabajoPrecio(typedRow.tipo_trabajo);

    if (estado === "entregado") {
      recibidas += precio;
    } else {
      esperadas += precio;
    }
  }

  return {
    esperadas,
    recibidas,
    total: esperadas + recibidas,
  };
}

function getTipoTrabajoPrecio(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { precio?: unknown } | undefined;
    return parsePrecio(first?.precio);
  }
  if (value && typeof value === "object") {
    const record = value as { precio?: unknown };
    return parsePrecio(record.precio);
  }
  return 0;
}

function parsePrecio(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function formatMoney(value: number) {
  const abs = Math.abs(value);
  const [integerPart, decimalPart] = abs.toFixed(2).split(".");
  const integerWithSeparator = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  const sign = value < 0 ? "-" : "";
  return `${sign}$${integerWithSeparator},${decimalPart}`;
}
