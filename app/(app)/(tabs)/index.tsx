import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
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
  const [gananciasPorMes, setGananciasPorMes] = useState<GananciaMensualItem[]>(
    [],
  );
  const [entregasPorMes, setEntregasPorMes] = useState<EntregasMesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const applyDashboardPayload = useCallback((payload: DashboardPayload) => {
    setResumenPorTipo(payload.resumenPorTipo);
    setGanancias(payload.ganancias);
    setGananciasPorMes(payload.gananciasPorMes);
    setEntregasPorMes(payload.entregasPorMes);
  }, []);

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSyncInfo(null);

    let hasLocalSnapshot = false;
    try {
      const cachedSnapshot = await getCachedDashboardSnapshot();
      const cachedPayload = normalizeDashboardPayload(cachedSnapshot?.payload);

      if (cachedSnapshot && cachedPayload) {
        applyDashboardPayload(cachedPayload);
        hasLocalSnapshot = true;
        setLoading(false);
        setSyncInfo(
          `Mostrando cache local. Ultima sincronizacion: ${formatDateTime(cachedSnapshot.updatedAt)}`,
        );
      }
    } catch (cacheError) {
      console.warn("No se pudo leer cache local del dashboard.", cacheError);
    }

    const remoteResult = await fetchDashboardPayloadFromSupabase();

    if (!remoteResult.payload) {
      if (!hasLocalSnapshot) {
        setErrorMessage(remoteResult.errorMessage ?? "No se pudo cargar el dashboard.");
        setLoading(false);
      } else {
        setSyncInfo("Sin conexion a Supabase. Mostrando datos locales.");
      }
      return;
    }

    applyDashboardPayload(remoteResult.payload);
    setErrorMessage(null);
    setLoading(false);
    setSyncInfo(`Sincronizado con Supabase: ${formatDateTime(new Date().toISOString())}`);

    try {
      await replaceCachedDashboardSnapshot(remoteResult.payload);
    } catch (cacheError) {
      console.warn("No se pudo actualizar cache local del dashboard.", cacheError);
    }
  }, [applyDashboardPayload]);

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
          Entregados usan precio aplicado en su fecha de entrega.
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

async function fetchDashboardPayloadFromSupabase(): Promise<{
  payload: DashboardPayload | null;
  errorMessage: string | null;
}> {
  const rpcResponse = await supabase.rpc("fn_dashboard_resumen");
  if (!rpcResponse.error) {
    const normalized = normalizeDashboardPayload(rpcResponse.data);
    if (normalized) {
      return { payload: normalized, errorMessage: null };
    }
  }

  const fallbackResponse = await supabase
    .from("trabajos")
    .select(
      "nombre_trabajo,fecha_entrega,estado,precio_aplicado,tipo_trabajo:tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre,precio)",
    );

  if (fallbackResponse.error) {
    return {
      payload: null,
      errorMessage:
        rpcResponse.error?.message ??
        fallbackResponse.error.message ??
        "No se pudo cargar el dashboard.",
    };
  }

  return {
    payload: buildDashboardPayloadFromRows(fallbackResponse.data),
    errorMessage: null,
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

function normalizeDashboardPayload(rawPayload: unknown): DashboardPayload | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const record = rawPayload as Record<string, unknown>;
  const resumenPorTipo = normalizeResumenPorTipo(
    record.resumen_por_tipo ?? record.resumenPorTipo,
  );
  const ganancias = normalizeGanancias(record.ganancias);
  const gananciasPorMes = normalizeGananciasPorMes(
    record.ganancias_por_mes ?? record.gananciasPorMes,
  );
  const entregasPorMes = normalizeEntregasPorMes(
    record.entregas_por_mes ?? record.entregasPorMes,
  );

  return {
    resumenPorTipo,
    ganancias,
    gananciasPorMes,
    entregasPorMes,
  };
}

function normalizeResumenPorTipo(value: unknown): ResumenTipoEstado[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const estadoCountsRaw = (row.estado_counts ??
        row.estadoCounts ??
        {}) as Record<string, unknown>;

      const tipoTrabajo = String(row.tipo_trabajo ?? row.tipoTrabajo ?? "Sin tipo");

      const estadoCounts: Record<EstadoTrabajo, number> = {
        creado: toNumber(estadoCountsRaw.creado),
        en_proceso: toNumber(estadoCountsRaw.en_proceso),
        terminado: toNumber(estadoCountsRaw.terminado),
        entregado: toNumber(estadoCountsRaw.entregado),
      };

      return {
        tipoTrabajo,
        total: toNumber(row.total),
        estadoCounts,
      };
    })
    .filter((item): item is ResumenTipoEstado => Boolean(item))
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.tipoTrabajo.localeCompare(b.tipoTrabajo);
    });
}

function normalizeGanancias(value: unknown): GananciasResumen {
  if (!value || typeof value !== "object") {
    return { esperadas: 0, recibidas: 0, total: 0 };
  }

  const row = value as Record<string, unknown>;
  const esperadas = toNumber(row.esperadas);
  const recibidas = toNumber(row.recibidas);
  const totalFromPayload = toNumber(row.total);
  const total = totalFromPayload > 0 ? totalFromPayload : esperadas + recibidas;

  return {
    esperadas,
    recibidas,
    total,
  };
}

function normalizeGananciasPorMes(value: unknown): GananciaMensualItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const esperadas = toNumber(row.esperadas);
      const recibidas = toNumber(row.recibidas);
      const totalFromPayload = toNumber(row.total);

      return {
        key: String(row.key ?? ""),
        mesLabel: String(row.mes_label ?? row.mesLabel ?? ""),
        esperadas,
        recibidas,
        total: totalFromPayload > 0 ? totalFromPayload : esperadas + recibidas,
      };
    })
    .filter(
      (item): item is GananciaMensualItem =>
        Boolean(item && item.key.length > 0 && item.mesLabel.length > 0),
    )
    .sort((a, b) => a.key.localeCompare(b.key));
}

function normalizeEntregasPorMes(value: unknown): EntregasMesGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const trabajos = Array.isArray(row.trabajos)
        ? row.trabajos.map((trabajo) => String(trabajo)).filter((trabajo) => trabajo.length > 0)
        : [];

      return {
        key: String(row.key ?? ""),
        mesLabel: String(row.mes_label ?? row.mesLabel ?? ""),
        trabajos,
      };
    })
    .filter(
      (item): item is EntregasMesGroup =>
        Boolean(item && item.key.length > 0 && item.mesLabel.length > 0),
    )
    .sort((a, b) => a.key.localeCompare(b.key));
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
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
      precio_aplicado?: unknown;
      tipo_trabajo?: unknown;
    };

    const estado = parseEstado(typedRow.estado);

    if (estado === "entregado") {
      const precioAplicado = parsePrecioNullable(typedRow.precio_aplicado);
      recibidas += precioAplicado ?? getTipoTrabajoPrecio(typedRow.tipo_trabajo);
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
    { key: string; mesLabel: string; esperadas: number; recibidas: number; total: number }
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

  return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
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
    if (!entregaDate || entregaDate < today) {
      continue;
    }

    const year = entregaDate.getFullYear();
    const month = entregaDate.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${MONTH_NAMES_ES[month]} ${year}`;
    const nombreTrabajo = String(typedRow.nombre_trabajo ?? "Trabajo sin nombre");

    const current = grouped.get(key) ?? {
      key,
      mesLabel: label,
      trabajos: [],
    };
    current.trabajos.push(nombreTrabajo);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([, group]) => ({
      ...group,
      trabajos: group.trabajos.sort((a, b) => a.localeCompare(b)),
    }));
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
