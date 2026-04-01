import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import {
  DashboardGananciasMensualesCard,
  GananciaMensualItem,
} from "@/components/dashboard-ganancias-mensuales-card";
import {
  DashboardProximasEntregasCard,
  EntregasMesGroup,
} from "@/components/dashboard-proximas-entregas-card";
import {
  getCachedDashboardSnapshot,
  replaceCachedDashboardSnapshot,
} from "@/lib/dashboard-cache";
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

type DashboardPayload = {
  resumenPorTipo: ResumenTipoEstado[];
  ganancias: GananciasResumen;
  gananciasPorMes: GananciaMensualItem[];
  entregasPorMes: EntregasMesGroup[];
};

type DashboardRangeFilter =
  | "este_anio"
  | "este_mes"
  | "ultimos_3_meses"
  | "ultimos_6_meses";
type DashboardRangeMode = "preset" | "manual";

type DashboardRow = {
  nombre_trabajo: string;
  fecha_entrega: string | null;
  estado: string | null;
  precio_aplicado: number | null;
  tipo_trabajo: unknown;
};

const DASHBOARD_FILTER_OPTIONS: {
  key: DashboardRangeFilter;
  label: string;
}[] = [
  { key: "este_anio", label: "Este año" },
  { key: "este_mes", label: "Este mes" },
  { key: "ultimos_3_meses", label: "3 meses" },
  { key: "ultimos_6_meses", label: "6 meses" },
];

const ESTADO_ORDER: EstadoTrabajo[] = [
  "creado",
  "en_proceso",
  "terminado",
  "entregado",
];

const ESTADO_META: Record<EstadoTrabajo, { label: string; color: string }> = {
  creado: { label: "Creado", color: "#0EA5E9" },
  en_proceso: { label: "En proceso", color: "#D946EF" },
  terminado: { label: "Terminado", color: "#22A06B" },
  entregado: { label: "Entregado", color: "#1D4ED8" },
};

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [dashboardRows, setDashboardRows] = useState<DashboardRow[]>([]);
  const [timeFilter, setTimeFilter] =
    useState<DashboardRangeFilter>("este_anio");
  const [rangeMode, setRangeMode] = useState<DashboardRangeMode>("preset");
  const [rangeAccordionOpen, setRangeAccordionOpen] = useState(false);
  const [manualFromDate, setManualFromDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [manualToDate, setManualToDate] = useState(() =>
    startOfDay(new Date()),
  );
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const selectedRange = useMemo(
    () =>
      rangeMode === "manual"
        ? getManualRangeWindow(manualFromDate, manualToDate)
        : getDashboardRangeWindow(timeFilter),
    [manualFromDate, manualToDate, rangeMode, timeFilter],
  );
  const selectedPresetLabel = useMemo(
    () =>
      DASHBOARD_FILTER_OPTIONS.find((option) => option.key === timeFilter)
        ?.label ?? "Este año",
    [timeFilter],
  );
  const isManualMode = rangeMode === "manual";

  const filteredRows = useMemo(
    () =>
      filterDashboardRowsByWindow(
        dashboardRows,
        selectedRange.start,
        selectedRange.endExclusive,
      ),
    [dashboardRows, selectedRange.endExclusive, selectedRange.start],
  );

  const filteredDashboardPayload = useMemo(
    () => buildDashboardPayloadFromRows(filteredRows),
    [filteredRows],
  );

  const entregasPorMes = useMemo(
    () => buildEntregasPorMes(dashboardRows),
    [dashboardRows],
  );

  const { resumenPorTipo, ganancias, gananciasPorMes } =
    filteredDashboardPayload;

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSyncInfo(null);

    let hasLocalRows = false;
    try {
      const cachedSnapshot = await getCachedDashboardSnapshot();
      const cachedRows = normalizeDashboardRows(cachedSnapshot?.payload);

      if (cachedSnapshot && cachedRows.length > 0) {
        setDashboardRows(cachedRows);
        hasLocalRows = true;
        setLoading(false);
        setSyncInfo(
          `Mostrando cache local. Ultima sincronizacion: ${formatDateTime(cachedSnapshot.updatedAt)}`,
        );
      }
    } catch (cacheError) {
      console.warn("No se pudo leer cache local del dashboard.", cacheError);
    }

    const remoteResult = await fetchDashboardRowsFromSupabase();

    if (!remoteResult.rows) {
      if (!hasLocalRows) {
        setErrorMessage(
          remoteResult.errorMessage ?? "No se pudo cargar el dashboard.",
        );
        setLoading(false);
      } else {
        setSyncInfo("Sin conexion a Supabase. Mostrando datos locales.");
      }
      return;
    }

    setDashboardRows(remoteResult.rows);
    setErrorMessage(null);
    setLoading(false);
    setSyncInfo(
      `Sincronizado con Supabase: ${formatDateTime(new Date().toISOString())}`,
    );

    try {
      await replaceCachedDashboardSnapshot({ rows: remoteResult.rows });
    } catch (cacheError) {
      console.warn(
        "No se pudo actualizar cache local del dashboard.",
        cacheError,
      );
    }
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
      {syncInfo ? <Text style={styles.syncInfo}>{syncInfo}</Text> : null}
      <View style={styles.rangeAccordion}>
        <Pressable
          onPress={() => setRangeAccordionOpen((prev) => !prev)}
          style={styles.rangeAccordionHeader}
        >
          <Text style={styles.rangeAccordionTitle}>
            {`Rango (${rangeMode === "manual" ? "Manual" : selectedPresetLabel}) - ${formatDateOnly(selectedRange.start)} - ${formatDateOnly(selectedRange.endInclusive)}`}
          </Text>
          <Ionicons
            name={rangeAccordionOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textPrimary}
          />
        </Pressable>

        {rangeAccordionOpen ? (
          <View style={styles.rangeAccordionBody}>
            {!isManualMode ? (
              <View style={styles.presetControlsRow}>
                <View
                  style={[styles.modeToggleRow, styles.modeToggleRowCompact]}
                >
                  <Text style={styles.modeToggleLabel}>Modo</Text>
                  <Text style={styles.modeToggleValue}>Rapido</Text>
                  <Switch
                    value={isManualMode}
                    onValueChange={(nextValue) =>
                      setRangeMode(nextValue ? "manual" : "preset")
                    }
                    trackColor={{
                      false: colors.border,
                      true: colors.buttonBg,
                    }}
                    thumbColor={colors.buttonText}
                    style={styles.modeToggleSwitch}
                  />
                </View>

                <View style={styles.categoryColumn}>
                  {DASHBOARD_FILTER_OPTIONS.map((option) => {
                    const selected = timeFilter === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          setRangeMode("preset");
                          setTimeFilter(option.key);
                        }}
                        style={[
                          styles.categoryChip,
                          styles.categoryChipStacked,
                          selected ? styles.categoryChipActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            selected ? styles.categoryChipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {isManualMode ? (
              <>
                <View style={styles.filterWrap}>
                  <View style={styles.modeToggleRow}>
                    <Text style={styles.modeToggleLabel}>Modo</Text>
                    <Text style={styles.modeToggleValue}>Manual</Text>
                    <Switch
                      value={isManualMode}
                      onValueChange={(nextValue) =>
                        setRangeMode(nextValue ? "manual" : "preset")
                      }
                      trackColor={{
                        false: colors.border,
                        true: colors.buttonBg,
                      }}
                      thumbColor={colors.buttonText}
                      style={styles.modeToggleSwitch}
                    />
                  </View>
                </View>

                <View style={styles.manualInputsRow}>
                  <Pressable
                    onPress={() => {
                      setRangeMode("manual");
                      setShowFromDatePicker(true);
                    }}
                    style={styles.dateInput}
                  >
                    <Text style={styles.dateInputLabel}>Desde (manual)</Text>
                    <Text style={styles.dateInputValue}>
                      {formatDateOnly(manualFromDate)}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setRangeMode("manual");
                      setShowToDatePicker(true);
                    }}
                    style={styles.dateInput}
                  >
                    <Text style={styles.dateInputLabel}>Hasta (manual)</Text>
                    <Text style={styles.dateInputValue}>
                      {formatDateOnly(manualToDate)}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {showFromDatePicker ? (
        <DateTimePicker
          value={manualFromDate}
          mode="date"
          display="default"
          onChange={(_, nextDate) => {
            setShowFromDatePicker(false);
            if (nextDate) {
              setRangeMode("manual");
              setManualFromDate(startOfDay(nextDate));
            }
          }}
        />
      ) : null}

      {showToDatePicker ? (
        <DateTimePicker
          value={manualToDate}
          mode="date"
          display="default"
          onChange={(_, nextDate) => {
            setShowToDatePicker(false);
            if (nextDate) {
              setRangeMode("manual");
              setManualToDate(startOfDay(nextDate));
            }
          }}
        />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trabajos por tipo y estado</Text>
        <Text style={styles.sectionSubtitle}>Tipos de trabajo.</Text>

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
                      if (estadoCount <= 0 || item.total <= 0) {
                        return null;
                      }

                      const width = (estadoCount / item.total) * 100;
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
          El precio se establece al momento del contrato.
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

      <DashboardGananciasMensualesCard
        loading={loading}
        errorMessage={errorMessage}
        items={gananciasPorMes}
      />

      <DashboardProximasEntregasCard
        loading={loading}
        errorMessage={errorMessage}
        groups={entregasPorMes}
      />
    </ScrollView>
  );
}

async function fetchDashboardRowsFromSupabase(): Promise<{
  rows: DashboardRow[] | null;
  errorMessage: string | null;
}> {
  const response = await supabase
    .from("trabajos")
    .select(
      "nombre_trabajo,fecha_entrega,estado,precio_aplicado,tipo_trabajo:tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre,precio)",
    );

  if (response.error) {
    return {
      rows: null,
      errorMessage: response.error.message ?? "No se pudo cargar el dashboard.",
    };
  }

  return {
    rows: normalizeDashboardRows(response.data),
    errorMessage: null,
  };
}

function normalizeDashboardRows(value: unknown): DashboardRow[] {
  const list = extractRowsPayload(value);
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      nombre_trabajo: String(record.nombre_trabajo ?? ""),
      fecha_entrega:
        typeof record.fecha_entrega === "string" ? record.fecha_entrega : null,
      estado: typeof record.estado === "string" ? record.estado : null,
      precio_aplicado: parsePrecioNullable(record.precio_aplicado),
      tipo_trabajo: record.tipo_trabajo ?? null,
    };
  });
}

function extractRowsPayload(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const rows = (value as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows : null;
}

function filterDashboardRowsByWindow(
  rows: DashboardRow[],
  start: Date,
  endExclusive: Date,
) {
  return rows.filter((row) => {
    if (!row.fecha_entrega) {
      return false;
    }
    const entregaDate = parseDateISO(row.fecha_entrega);
    if (!entregaDate) {
      return false;
    }
    return entregaDate >= start && entregaDate < endExclusive;
  });
}

function getDashboardRangeWindow(rangeFilter: DashboardRangeFilter) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (rangeFilter === "este_mes") {
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start: currentMonthStart,
      endInclusive: addDays(endExclusive, -1),
      endExclusive,
    };
  }

  if (rangeFilter === "ultimos_3_meses") {
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      endInclusive: addDays(endExclusive, -1),
      endExclusive,
    };
  }

  if (rangeFilter === "ultimos_6_meses") {
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      endInclusive: addDays(endExclusive, -1),
      endExclusive,
    };
  }

  const endExclusive = new Date(now.getFullYear() + 1, 0, 1);
  return {
    start: new Date(now.getFullYear(), 0, 1),
    endInclusive: addDays(endExclusive, -1),
    endExclusive,
  };
}

function getManualRangeWindow(fromDate: Date, toDate: Date) {
  const normalizedFrom = startOfDay(fromDate);
  const normalizedTo = startOfDay(toDate);
  const start = normalizedFrom <= normalizedTo ? normalizedFrom : normalizedTo;
  const endInclusive =
    normalizedFrom <= normalizedTo ? normalizedTo : normalizedFrom;

  return {
    start,
    endInclusive,
    endExclusive: addDays(endInclusive, 1),
  };
}

function buildDashboardPayloadFromRows(rows: unknown): DashboardPayload {
  return {
    resumenPorTipo: buildResumenPorTipo(rows),
    ganancias: buildGanancias(rows),
    gananciasPorMes: buildGananciasPorMes(rows),
    entregasPorMes: buildEntregasPorMes(rows),
  };
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
    syncInfo: {
      color: colors.textSecondary,
      fontSize: 12,
      paddingHorizontal: 2,
      marginBottom: -2,
    },
    rangeAccordion: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    rangeAccordionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.inputBg,
    },
    rangeAccordionTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    rangeAccordionBody: {
      padding: 12,
      gap: 10,
    },
    filterWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    manualInputsRow: {
      flexDirection: "row",
      gap: 8,
    },
    dateInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
    },
    dateInputLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    dateInputValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    modeToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    modeToggleRowCompact: {
      alignSelf: "flex-start",
    },
    presetControlsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    categoryColumn: {
      flex: 1,
      gap: 8,
    },
    modeToggleLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    modeToggleValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "800",
      marginRight: 2,
    },
    modeToggleSwitch: {
      transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    },
    categoryChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    categoryChipStacked: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 34,
    },
    categoryChipActive: {
      backgroundColor: colors.buttonBg,
      borderColor: colors.buttonBg,
    },
    categoryChipText: {
      color: colors.inputText,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    categoryChipTextActive: {
      color: colors.buttonText,
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
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 5,
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
      fontSize: 10,
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
      precio_aplicado?: unknown;
      tipo_trabajo?: unknown;
    };

    const estado = parseEstado(typedRow.estado);

    if (estado === "entregado") {
      const precioAplicado = parsePrecioNullable(typedRow.precio_aplicado);
      recibidas +=
        precioAplicado ?? getTipoTrabajoPrecio(typedRow.tipo_trabajo);
    } else {
      esperadas += getTipoTrabajoPrecio(typedRow.tipo_trabajo);
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

function parsePrecioNullable(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
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

function buildGananciasPorMes(rows: unknown): GananciaMensualItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const grouped = new Map<
    string,
    {
      key: string;
      mesLabel: string;
      esperadas: number;
      recibidas: number;
      total: number;
    }
  >();

  for (const row of rows) {
    const typedRow = row as {
      estado?: string;
      fecha_entrega?: string | null;
      precio_aplicado?: unknown;
      tipo_trabajo?: unknown;
    };

    if (!typedRow.fecha_entrega) {
      continue;
    }

    const fechaEntrega = parseDateISO(String(typedRow.fecha_entrega));
    if (!fechaEntrega) {
      continue;
    }

    const year = fechaEntrega.getFullYear();
    const month = fechaEntrega.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const mesLabel = `${MONTH_NAMES_ES[month]} ${year}`;
    const estado = parseEstado(typedRow.estado);

    const current = grouped.get(key) ?? {
      key,
      mesLabel,
      esperadas: 0,
      recibidas: 0,
      total: 0,
    };

    if (estado === "entregado") {
      const precioAplicado = parsePrecioNullable(typedRow.precio_aplicado);
      current.recibidas +=
        precioAplicado ?? getTipoTrabajoPrecio(typedRow.tipo_trabajo);
    } else {
      current.esperadas += getTipoTrabajoPrecio(typedRow.tipo_trabajo);
    }

    current.total = current.esperadas + current.recibidas;
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

function buildEntregasPorMes(rows: unknown): EntregasMesGroup[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const today = startOfDay(new Date());
  const grouped = new Map<string, EntregasMesGroup>();

  for (const row of rows) {
    const typedRow = row as {
      nombre_trabajo?: string;
      fecha_entrega?: string | null;
      estado?: string;
    };

    const estado = parseEstado(typedRow.estado);
    if (estado === "entregado") {
      continue;
    }

    if (!typedRow.fecha_entrega) {
      continue;
    }

    const entregaDate = parseDateISO(String(typedRow.fecha_entrega));
    if (!entregaDate) {
      continue;
    }

    const year = entregaDate.getFullYear();
    const month = entregaDate.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${MONTH_NAMES_ES[month]} ${year}`;
    const nombreTrabajo = String(
      typedRow.nombre_trabajo ?? "Trabajo sin nombre",
    );
    const estadoTexto = getTrabajoPendienteTexto(estado, entregaDate, today);

    const current = grouped.get(key) ?? {
      key,
      mesLabel: label,
      trabajos: [],
    };
    current.trabajos.push({
      nombre: nombreTrabajo,
      estadoTexto,
    });
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([, group]) => ({
      ...group,
      trabajos: group.trabajos.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }));
}

function getTrabajoPendienteTexto(
  estado: EstadoTrabajo,
  fechaEntrega: Date,
  today: Date,
) {
  const atrasoDias = getDaysDiff(startOfDay(fechaEntrega), startOfDay(today));
  if (atrasoDias > 0) {
    return `Atrasado ${atrasoDias} dias`;
  }

  if (estado === "terminado") {
    return "Pendiente a entrega";
  }

  return "Pendiente a terminacion";
}

function formatDateTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function formatDateOnly(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDateISO(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function getDaysDiff(from: Date, to: Date) {
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / 86400000);
}

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
