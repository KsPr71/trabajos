import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { TrabajoCustomCard } from '@/components/ui/custom-card';
import { supabase } from '@/lib/supabase';
import { CachedTrabajo, getCachedTrabajos, getLastSyncAt, replaceCachedTrabajos } from '@/lib/trabajos-cache';
import { ThemeColors, useAppTheme } from '@/providers/theme-provider';

type EstadoTrabajo = 'creado' | 'en_proceso' | 'terminado' | 'entregado';

type TrabajoItem = {
  id: number;
  nombreTrabajo: string;
  autor: string;
  especialidad: string;
  tipoTrabajo: string;
  tipoTrabajoColor: string | null;
  fechaEntrega: string | null;
  estadoCreadoAt: string | null;
  estadoEnProcesoAt: string | null;
  estadoTerminadoAt: string | null;
  estadoEntregadoAt: string | null;
  estado: EstadoTrabajo;
  updatedAt: string;
};

export default function TrabajosEntregadosScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const styles = createStyles(colors);

  const [trabajos, setTrabajos] = useState<TrabajoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const loadTrabajosEntregados = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSyncInfo(null);

    let cachedRowsAll: TrabajoItem[] = [];
    let cachedEntregados: TrabajoItem[] = [];

    try {
      cachedRowsAll = await getCachedTrabajos();
      cachedEntregados = cachedRowsAll.filter((item) => item.estado === 'entregado');
      setTrabajos(cachedEntregados);
      if (cachedRowsAll.length > 0) {
        const lastSync = await getLastSyncAt();
        setSyncInfo(
          lastSync
            ? `Mostrando cache local. Ultima sincronizacion: ${formatDateTime(lastSync)}`
            : 'Mostrando cache local. Sincronizando...'
        );
        setLoading(false);
      }
    } catch (error) {
      console.warn('No se pudo leer cache local de entregados.', error);
    }

    const { data, error } = await supabase
      .from('trabajos')
      .select(
        'id,nombre_trabajo,estado,fecha_entrega,created_at,estado_creado_at,estado_en_proceso_at,estado_terminado_at,estado_entregado_at,clientes!trabajos_cliente_id_fkey(nombre),especialidad!trabajos_especialidad_id_fkey(nombre),tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre,color)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      if (cachedEntregados.length === 0) {
        setErrorMessage(error.message);
      } else {
        setSyncInfo('Sin conexion a Supabase. Mostrando datos locales.');
      }
      return;
    }

    const mappedAll = mapTrabajos(data);
    const mappedEntregados = mappedAll.filter((item) => item.estado === 'entregado');
    setTrabajos(mappedEntregados);

    try {
      await replaceCachedTrabajos(mappedAll as CachedTrabajo[]);
    } catch (cacheError) {
      console.warn('No se pudo actualizar cache local de entregados.', cacheError);
    }

    setSyncInfo(`Sincronizado con Supabase: ${formatDateTime(new Date().toISOString())}`);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrabajosEntregados().catch((error) => {
        setLoading(false);
        setErrorMessage(String(error));
      });
    }, [loadTrabajosEntregados])
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.buttonBg} />
          <Text style={styles.stateText}>Cargando trabajos entregados...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>Error cargando trabajos: {errorMessage}</Text>
        </View>
      ) : trabajos.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>No hay trabajos entregados todavia.</Text>
        </View>
      ) : (
        <>
          {syncInfo ? <Text style={styles.syncInfo}>{syncInfo}</Text> : null}
          <FlatList
            data={trabajos}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TrabajoCustomCard
                nombreTrabajo={item.nombreTrabajo}
                autor={item.autor}
                especialidad={item.especialidad}
                tipoTrabajo={item.tipoTrabajo}
                tipoTrabajoColor={item.tipoTrabajoColor}
                fechaEntrega={item.fechaEntrega}
                estadoCreadoAt={item.estadoCreadoAt}
                estadoEnProcesoAt={item.estadoEnProcesoAt}
                estadoTerminadoAt={item.estadoTerminadoAt}
                estadoEntregadoAt={item.estadoEntregadoAt}
                estado={item.estado}
                accentBorder
                onPress={() =>
                  router.push({
                    pathname: '/(app)/editar-trabajo',
                    params: { id: String(item.id) },
                  })
                }
              />
            )}
          />
        </>
      )}
    </View>
  );
}

function mapTrabajos(rows: unknown): TrabajoItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const typedRow = row as {
        id?: number | string;
        nombre_trabajo?: string;
        estado?: string;
        fecha_entrega?: string | null;
        created_at?: string;
        estado_creado_at?: string | null;
        estado_en_proceso_at?: string | null;
        estado_terminado_at?: string | null;
        estado_entregado_at?: string | null;
        clientes?: unknown;
        especialidad?: unknown;
        tipo_trabajo?: unknown;
      };
      const tipoTrabajoInfo = getTipoTrabajoInfo(typedRow.tipo_trabajo);

      return {
        id: Number(typedRow.id),
        nombreTrabajo: String(typedRow.nombre_trabajo ?? ''),
        autor: getRelationName(typedRow.clientes, 'Sin autor'),
        especialidad: getRelationName(typedRow.especialidad, 'Sin especialidad'),
        tipoTrabajo: tipoTrabajoInfo.nombre,
        tipoTrabajoColor: tipoTrabajoInfo.color,
        fechaEntrega: typedRow.fecha_entrega ? String(typedRow.fecha_entrega) : null,
        estadoCreadoAt: typedRow.estado_creado_at
          ? String(typedRow.estado_creado_at)
          : typedRow.created_at
            ? String(typedRow.created_at)
            : null,
        estadoEnProcesoAt: typedRow.estado_en_proceso_at ? String(typedRow.estado_en_proceso_at) : null,
        estadoTerminadoAt: typedRow.estado_terminado_at ? String(typedRow.estado_terminado_at) : null,
        estadoEntregadoAt: typedRow.estado_entregado_at ? String(typedRow.estado_entregado_at) : null,
        estado: parseEstado(typedRow.estado),
        updatedAt: String(typedRow.created_at ?? new Date().toISOString()),
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombreTrabajo.length > 0);
}

function getRelationName(value: unknown, fallback: string) {
  if (Array.isArray(value)) {
    const first = value[0] as { nombre?: string } | undefined;
    return first?.nombre ? String(first.nombre) : fallback;
  }
  if (value && typeof value === 'object') {
    const record = value as { nombre?: string };
    return record.nombre ? String(record.nombre) : fallback;
  }
  return fallback;
}

function getTipoTrabajoInfo(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { nombre?: string; color?: string } | undefined;
    return {
      nombre: first?.nombre ? String(first.nombre) : 'Sin tipo',
      color: parseColor(first?.color),
    };
  }
  if (value && typeof value === 'object') {
    const record = value as { nombre?: string; color?: string };
    return {
      nombre: record.nombre ? String(record.nombre) : 'Sin tipo',
      color: parseColor(record.color),
    };
  }
  return {
    nombre: 'Sin tipo',
    color: null,
  };
}

function parseColor(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

function parseEstado(rawValue: unknown): EstadoTrabajo {
  if (rawValue === 'entregado') {
    return 'entregado';
  }
  if (rawValue === 'en_proceso') {
    return 'en_proceso';
  }
  if (rawValue === 'terminado') {
    return 'terminado';
  }
  return 'creado';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    stateCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      gap: 10,
    },
    stateText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 15,
    },
    listContent: {
      gap: 12,
      paddingBottom: 24,
    },
    syncInfo: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
  });
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
