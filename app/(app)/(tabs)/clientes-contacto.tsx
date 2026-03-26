import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { QuestionSearch } from '@/components/question-search';
import {
  getCachedClientesConTelefono,
  mapSupabaseClienteRows,
  replaceCachedClientesConTelefono,
} from '@/lib/catalogos-cache';
import { supabase } from '@/lib/supabase';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { useAppTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

type ClienteItem = {
  id: number;
  nombre: string;
  telefono: string | null;
};

export default function ClientesContactoScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const styles = createStyles(colors);

  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const filteredClientes = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return clientes;
    }
    return clientes.filter((item) =>
      [item.nombre, item.telefono ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [clientes, searchText]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerSearchWrap}>
          <QuestionSearch
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar cliente o telefono"
            inHeader
            expandedWidth={176}
          />
        </View>
      ),
      headerRightContainerStyle: { paddingRight: 10 },
    });
  }, [navigation, searchText, styles.headerSearchWrap]);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    let cachedRows: ClienteItem[] = [];
    try {
      const cachedClientes = await getCachedClientesConTelefono();
      cachedRows = mapClientes(cachedClientes);
      if (cachedRows.length > 0) {
        setClientes(cachedRows);
        setLoading(false);
      }
    } catch (cacheError) {
      console.warn('No se pudo leer cache local de clientes.', cacheError);
    }

    const { data, error } = await supabase
      .from('clientes')
      .select('id,nombre,telefono,created_at')
      .order('nombre', { ascending: true });

    if (error) {
      setLoading(false);
      if (cachedRows.length === 0) {
        setErrorMessage(error.message);
      }
      return;
    }

    const remoteRows = mapSupabaseClienteRows(data);
    setClientes(mapClientes(remoteRows));
    setLoading(false);

    try {
      await replaceCachedClientesConTelefono(remoteRows);
    } catch (cacheError) {
      console.warn('No se pudo actualizar cache local de clientes.', cacheError);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClientes().catch((error) => {
        setLoading(false);
        setErrorMessage(String(error));
      });
    }, [loadClientes])
  );

  const handleWhatsApp = useCallback(
    async (cliente: ClienteItem) => {
      const telefono = cliente.telefono?.trim() ?? '';
      if (!telefono) {
        showToast('Este cliente no tiene telefono.', 'error');
        return;
      }

      try {
        await openWhatsAppChat(telefono, `Hola ${cliente.nombre}, te escribo sobre tu trabajo.`);
      } catch (error) {
        showToast(`No se pudo abrir WhatsApp: ${String(error)}`, 'error');
      }
    },
    [showToast]
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.buttonBg} />
          <Text style={styles.stateText}>Cargando clientes...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>Error cargando clientes: {errorMessage}</Text>
        </View>
      ) : clientes.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>No hay clientes registrados.</Text>
        </View>
      ) : filteredClientes.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>No hay coincidencias para tu busqueda.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClientes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const hasPhone = Boolean(item.telefono?.trim());
            return (
              <View style={styles.card}>
                <View style={styles.infoBlock}>
                  <Text style={styles.nombre}>{item.nombre}</Text>
                  <Text style={styles.telefono}>
                    {hasPhone ? item.telefono : 'Sin telefono registrado'}
                  </Text>
                </View>

                <Pressable
                  disabled={!hasPhone}
                  onPress={() => handleWhatsApp(item)}
                  style={[
                    styles.whatsAppButton,
                    !hasPhone ? styles.whatsAppButtonDisabled : null,
                  ]}>
                  <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function mapClientes(rows: unknown): ClienteItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const typedRow = row as { id?: number | string; nombre?: string; telefono?: string | null };
      return {
        id: Number(typedRow.id),
        nombre: String(typedRow.nombre ?? ''),
        telefono: typedRow.telefono ? String(typedRow.telefono) : null,
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    headerSearchWrap: {
      width: 176,
      alignItems: 'flex-end',
      justifyContent: 'center',
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
      gap: 10,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    infoBlock: {
      flex: 1,
      gap: 3,
    },
    nombre: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    telefono: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    whatsAppButton: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor: '#25D366',
      alignItems: 'center',
      justifyContent: 'center',
    },
    whatsAppButtonDisabled: {
      opacity: 0.45,
    },
  });
}
