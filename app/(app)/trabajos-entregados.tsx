import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

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
  fechaEntrega: string | null;
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
        'id,nombre_trabajo,estado,fecha_entrega,created_at,clientes!trabajos_cliente_id_fkey(nombre),especialidad!trabajos_especialidad_id_fkey(nombre),tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre)'
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
            renderItem={({ item }) => {
              const chip = getEstadoChip(item.estado, colors);

              return (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/editar-trabajo',
                      params: { id: String(item.id) },
                    })
                  }
                  style={styles.card}>
                  <Text style={styles.cardTitle}>{item.nombreTrabajo}</Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>Autor: </Text>
                    {item.autor}
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>Especialidad: </Text>
                    {item.especialidad}
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>Entrega: </Text>
                    {formatFechaEntrega(item.fechaEntrega)}
                  </Text>
                  <View style={styles.chipsRow}>
                    <View style={styles.tipoChip}>
                      <Text style={styles.tipoChipText}>Tipo: {item.tipoTrabajo}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: chip.backgroundColor }]}>
                      <Text style={[styles.chipText, { color: chip.textColor }]}>{chip.label}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
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
        clientes?: unknown;
        especialidad?: unknown;
        tipo_trabajo?: unknown;
      };

      return {
        id: Number(typedRow.id),
        nombreTrabajo: String(typedRow.nombre_trabajo ?? ''),
        autor: getRelationName(typedRow.clientes, 'Sin autor'),
        especialidad: getRelationName(typedRow.especialidad, 'Sin especialidad'),
        tipoTrabajo: getRelationName(typedRow.tipo_trabajo, 'Sin tipo'),
        fechaEntrega: typedRow.fecha_entrega ? String(typedRow.fecha_entrega) : null,
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

function getEstadoChip(estado: EstadoTrabajo, colors: ThemeColors) {
  if (estado === 'entregado') {
    return {
      label: 'Entregado',
      backgroundColor: '#059669',
      textColor: '#FFFFFF',
    };
  }
  if (estado === 'terminado') {
    return {
      label: 'Terminado',
      backgroundColor: '#22A06B',
      textColor: '#FFFFFF',
    };
  }
  if (estado === 'en_proceso') {
    return {
      label: 'En proceso',
      backgroundColor: '#F59E0B',
      textColor: '#1B1400',
    };
  }
  return {
    label: 'Creado',
    backgroundColor: colors.buttonBg,
    textColor: colors.buttonText,
  };
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
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 16,
      paddingBottom: 52,
      gap: 8,
      position: 'relative',
    },
    chipsRow: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusChip: {
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    chip: {
      borderRadius: 9999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    tipoChip: {
      alignSelf: 'flex-start',
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
      fontWeight: '700',
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    metaLabel: {
      color: colors.textPrimary,
      fontWeight: '700',
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

function formatFechaEntrega(fechaEntrega: string | null) {
  if (!fechaEntrega) {
    return 'Sin fecha';
  }
  const [year, month, day] = fechaEntrega.split('-');
  if (!year || !month || !day) {
    return fechaEntrega;
  }
  return `${day}/${month}/${year}`;
}
