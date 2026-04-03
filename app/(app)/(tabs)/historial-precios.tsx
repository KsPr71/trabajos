import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getCachedHistorialPreciosSnapshot,
  replaceCachedHistorialPreciosSnapshot,
} from '@/lib/historial-precios-cache';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

type PrecioActualItem = {
  id: number;
  nombre: string;
  precio: number;
  color: string | null;
};

type PrecioHistorialItem = {
  id: number;
  tipoTrabajoId: number;
  tipoTrabajoNombre: string;
  tipoTrabajoColor: string | null;
  precio: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
};

export default function HistorialPreciosScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [preciosActuales, setPreciosActuales] = useState<PrecioActualItem[]>([]);
  const [historial, setHistorial] = useState<PrecioHistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const historialAgrupado = useMemo(() => {
    const grouped = new Map<string, PrecioHistorialItem[]>();

    for (const item of historial) {
      const key = `${item.tipoTrabajoId}-${item.tipoTrabajoNombre}`;
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries()).map(([key, items]) => ({
      key,
      tipoTrabajoNombre: items[0]?.tipoTrabajoNombre ?? 'Sin tipo',
      tipoTrabajoColor: items[0]?.tipoTrabajoColor ?? null,
      items,
    }));
  }, [historial]);

  const loadPrecios = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSyncInfo(null);

    let hasLocalSnapshot = false;
    try {
      const cachedSnapshot = await getCachedHistorialPreciosSnapshot();
      if (cachedSnapshot) {
        const normalized = normalizeCachedSnapshotPayload(cachedSnapshot.payload);
        setPreciosActuales(normalized.preciosActuales);
        setHistorial(normalized.historial);
        hasLocalSnapshot = true;
        setLoading(false);
        setSyncInfo(
          `Mostrando cache local. Ultima sincronizacion: ${formatDateTime(cachedSnapshot.updatedAt)}`
        );
      }
    } catch (cacheError) {
      console.warn('No se pudo leer cache local de historial de precios.', cacheError);
    }

    const [tiposRes, historialRes] = await Promise.all([
      supabase
        .from('tipo_trabajo')
        .select('id,nombre,precio,color')
        .order('nombre', { ascending: true }),
      supabase
        .from('tipo_trabajo_precio_historial')
        .select('id,tipo_trabajo_id,precio,vigente_desde,vigente_hasta')
        .order('vigente_desde', { ascending: false })
        .order('id', { ascending: false }),
    ]);

    if (tiposRes.error || historialRes.error) {
      const reason = tiposRes.error?.message ?? historialRes.error?.message ?? 'Error desconocido.';
      if (!hasLocalSnapshot) {
        setErrorMessage(reason);
        setLoading(false);
      } else {
        setSyncInfo('Sin conexion a Supabase. Mostrando datos locales.');
      }
      return;
    }

    const tiposMap = new Map<number, { nombre: string; color: string | null }>();
    const mappedTipos = (tiposRes.data ?? [])
      .map((row) => {
        const id = Number(row.id);
        const nombre = String(row.nombre ?? '').trim();
        const color = normalizeHexColor(row.color);
        const precio = Number(row.precio ?? 0);

        if (Number.isFinite(id) && nombre.length > 0) {
          tiposMap.set(id, { nombre, color });
        }

        return {
          id,
          nombre,
          precio: Number.isFinite(precio) ? precio : 0,
          color,
        };
      })
      .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);

    const mappedHistorial = (historialRes.data ?? [])
      .map((row) => {
        const tipoTrabajoId = Number(row.tipo_trabajo_id);
        const tipoInfo = tiposMap.get(tipoTrabajoId);
        const precio = Number(row.precio ?? 0);
        const vigenteDesde = String(row.vigente_desde ?? '');
        const vigenteHasta = row.vigente_hasta ? String(row.vigente_hasta) : null;

        return {
          id: Number(row.id),
          tipoTrabajoId,
          tipoTrabajoNombre: tipoInfo?.nombre ?? `Tipo #${tipoTrabajoId}`,
          tipoTrabajoColor: tipoInfo?.color ?? null,
          precio: Number.isFinite(precio) ? precio : 0,
          vigenteDesde,
          vigenteHasta,
        };
      })
      .filter(
        (item) =>
          Number.isFinite(item.id) &&
          Number.isFinite(item.tipoTrabajoId) &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.vigenteDesde)
      );

    setPreciosActuales(mappedTipos);
    setHistorial(mappedHistorial);
    setLoading(false);
    setSyncInfo(`Sincronizado con Supabase: ${formatDateTime(new Date().toISOString())}`);

    try {
      await replaceCachedHistorialPreciosSnapshot({
        preciosActuales: mappedTipos,
        historial: mappedHistorial,
      });
    } catch (cacheError) {
      console.warn('No se pudo actualizar cache local de historial de precios.', cacheError);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPrecios().catch((error) => {
        setLoading(false);
        setErrorMessage(String(error));
      });
    }, [loadPrecios])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {syncInfo ? <Text style={styles.syncInfo}>{syncInfo}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Precios actuales</Text>
        <Text style={styles.sectionSubtitle}>
          Valores vigentes por tipo de trabajo.
        </Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.buttonBg} />
            <Text style={styles.stateText}>Cargando precios...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Error cargando precios: {errorMessage}</Text>
          </View>
        ) : preciosActuales.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No hay tipos de trabajo registrados.</Text>
          </View>
        ) : (
          <View style={styles.actualesWrap}>
            {preciosActuales.map((item) => (
              <View key={item.id} style={styles.actualItem}>
                <View style={styles.actualLabelRow}>
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: item.color ?? colors.border },
                    ]}
                  />
                  <Text style={styles.actualLabel}>{item.nombre}</Text>
                </View>
                <Text style={styles.actualValue}>{formatMoney(item.precio)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Historial de precios</Text>
        <Text style={styles.sectionSubtitle}>
          Fechas de cambio por tipo de trabajo.
        </Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.buttonBg} />
            <Text style={styles.stateText}>Cargando historial...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Error cargando historial: {errorMessage}</Text>
          </View>
        ) : historialAgrupado.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No hay historial disponible.</Text>
          </View>
        ) : (
          <View style={styles.groupsWrap}>
            {historialAgrupado.map((group) => (
              <View key={group.key} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: group.tipoTrabajoColor ?? colors.border },
                    ]}
                  />
                  <Text style={styles.groupTitle}>{group.tipoTrabajoNombre}</Text>
                </View>

                <View style={styles.groupRows}>
                  {group.items.map((item) => (
                    <View key={item.id} style={styles.historyRow}>
                      <Text style={styles.historyPrice}>{formatMoney(item.precio)}</Text>
                      <Text style={styles.historyDates}>
                        {`Desde ${formatDate(item.vigenteDesde)} - ${item.vigenteHasta ? `Hasta ${formatDate(item.vigenteHasta)}` : 'Actual'}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      gap: 12,
      paddingBottom: 120,
    },
    syncInfo: {
      color: colors.textSecondary,
      fontSize: 12,
      paddingHorizontal: 2,
      marginBottom: -2,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 10,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
    },
    sectionSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    stateBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      padding: 12,
      gap: 8,
      alignItems: 'center',
    },
    stateText: {
      color: colors.textSecondary,
      textAlign: 'center',
    },
    actualesWrap: {
      gap: 8,
    },
    actualItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    actualLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    colorDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    actualLabel: {
      color: colors.inputText,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },
    actualValue: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
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
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    groupTitle: {
      color: colors.inputText,
      fontSize: 14,
      fontWeight: '800',
      flex: 1,
    },
    groupRows: {
      gap: 8,
    },
    historyRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      gap: 3,
    },
    historyPrice: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    historyDates: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const [integerPart, decimalPart] = safe.toFixed(2).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${grouped},${decimalPart}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeCachedSnapshotPayload(payload: unknown): {
  preciosActuales: PrecioActualItem[];
  historial: PrecioHistorialItem[];
} {
  const typedPayload = payload as {
    preciosActuales?: unknown;
    historial?: unknown;
  };

  return {
    preciosActuales: normalizePreciosActuales(typedPayload?.preciosActuales),
    historial: normalizeHistorial(typedPayload?.historial),
  };
}

function normalizePreciosActuales(value: unknown): PrecioActualItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item as {
        id?: number | string;
        nombre?: string;
        precio?: number | string;
        color?: string | null;
      };
      const id = Number(row.id);
      const nombre = String(row.nombre ?? '').trim();
      const precio = Number(row.precio ?? 0);
      return {
        id,
        nombre,
        precio: Number.isFinite(precio) ? precio : 0,
        color: normalizeHexColor(row.color),
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);
}

function normalizeHistorial(value: unknown): PrecioHistorialItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item as {
        id?: number | string;
        tipoTrabajoId?: number | string;
        tipoTrabajoNombre?: string;
        tipoTrabajoColor?: string | null;
        precio?: number | string;
        vigenteDesde?: string;
        vigenteHasta?: string | null;
      };

      return {
        id: Number(row.id),
        tipoTrabajoId: Number(row.tipoTrabajoId),
        tipoTrabajoNombre: String(row.tipoTrabajoNombre ?? '').trim(),
        tipoTrabajoColor: normalizeHexColor(row.tipoTrabajoColor),
        precio: Number.isFinite(Number(row.precio)) ? Number(row.precio) : 0,
        vigenteDesde: String(row.vigenteDesde ?? ''),
        vigenteHasta: row.vigenteHasta ? String(row.vigenteHasta) : null,
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.id) &&
        Number.isFinite(item.tipoTrabajoId) &&
        item.tipoTrabajoNombre.length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.vigenteDesde)
    );
}

function formatDateTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}
