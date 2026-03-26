import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { mapSupabaseCatalogRow, upsertCachedCatalogo } from '@/lib/catalogos-cache';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

export default function TipoTrabajoScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tiposRegistrados, setTiposRegistrados] = useState<
    { id: number; nombre: string; precio: number }[]
  >([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadTiposTrabajo = useCallback(async () => {
    setLoadingLista(true);
    const { data, error } = await supabase
      .from('tipo_trabajo')
      .select('id,nombre,precio')
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('No se pudo cargar la lista de tipos de trabajo.', error);
      setLoadingLista(false);
      return;
    }

    const mapped = (data ?? [])
      .map((row) => ({
        id: Number(row.id),
        nombre: String(row.nombre ?? ''),
        precio: Number(row.precio ?? 0),
      }))
      .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);

    setTiposRegistrados(mapped);
    setLoadingLista(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTiposTrabajo().catch((error) => {
        console.warn('No se pudo refrescar la lista de tipos de trabajo.', error);
        setLoadingLista(false);
      });
    }, [loadTiposTrabajo])
  );

  const handleCreate = async () => {
    const cleanNombre = nombre.trim();
    const cleanPrecio = precio.trim().replace(',', '.');
    const parsedPrecio = Number(cleanPrecio);

    if (!cleanNombre) {
      setMessage('El nombre es obligatorio.');
      return;
    }
    if (!cleanPrecio) {
      setMessage('El precio es obligatorio.');
      return;
    }
    if (Number.isNaN(parsedPrecio) || parsedPrecio < 0) {
      setMessage('Precio invalido.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('tipo_trabajo')
      .insert({ nombre: cleanNombre, precio: parsedPrecio })
      .select('id,nombre,created_at')
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      setMessage(`Error: ${error?.message ?? 'No se pudo crear el tipo de trabajo.'}`);
      return;
    }

    const cachedItem = mapSupabaseCatalogRow(data);
    if (cachedItem) {
      try {
        await upsertCachedCatalogo('tipo_trabajo', cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de tipo de trabajo.', cacheError);
      }
    }

    setNombre('');
    setPrecio('');
    setMessage('Tipo de trabajo creado correctamente.');
    await loadTiposTrabajo();
  };

  const handleStartEdit = (item: { id: number; nombre: string; precio: number }) => {
    setEditingId(item.id);
    setEditNombre(item.nombre);
    setEditPrecio(String(item.precio));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
    setEditPrecio('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      return;
    }
    const cleanNombre = editNombre.trim();
    const cleanPrecio = editPrecio.trim().replace(',', '.');
    const parsedPrecio = Number(cleanPrecio);

    if (!cleanNombre) {
      setMessage('El nombre es obligatorio para editar.');
      return;
    }
    if (!cleanPrecio || Number.isNaN(parsedPrecio) || parsedPrecio < 0) {
      setMessage('Precio invalido para editar.');
      return;
    }

    setSavingEdit(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('tipo_trabajo')
      .update({ nombre: cleanNombre, precio: parsedPrecio })
      .eq('id', editingId)
      .select('id,nombre,created_at')
      .maybeSingle();

    setSavingEdit(false);

    if (error || !data) {
      setMessage(`Error actualizando tipo de trabajo: ${error?.message ?? 'sin filas afectadas.'}`);
      return;
    }

    const cachedItem = mapSupabaseCatalogRow(data);
    if (cachedItem) {
      try {
        await upsertCachedCatalogo('tipo_trabajo', cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de tipo de trabajo tras editar.', cacheError);
      }
    }

    setMessage('Tipo de trabajo actualizado correctamente.');
    handleCancelEdit();
    await loadTiposTrabajo();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Nuevo tipo de trabajo</Text>

        <TextInput
          placeholder="Nombre"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          placeholder="Precio"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={precio}
          onChangeText={setPrecio}
          keyboardType="decimal-pad"
        />

        <Pressable disabled={loading} onPress={handleCreate} style={styles.button}>
          {loading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>Guardar tipo</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Tipos de trabajo registrados</Text>

          {loadingLista ? (
            <View style={styles.listState}>
              <ActivityIndicator color={colors.buttonBg} />
              <Text style={styles.listStateText}>Cargando lista...</Text>
            </View>
          ) : tiposRegistrados.length === 0 ? (
            <View style={styles.listState}>
              <Text style={styles.listStateText}>No hay tipos de trabajo registrados.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {tiposRegistrados.map((tipo) => (
                <View key={tipo.id} style={styles.listItem}>
                  {editingId === tipo.id ? (
                    <View style={styles.editWrap}>
                      <TextInput
                        placeholder="Nombre"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editNombre}
                        onChangeText={setEditNombre}
                      />
                      <TextInput
                        placeholder="Precio"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editPrecio}
                        onChangeText={setEditPrecio}
                        keyboardType="decimal-pad"
                      />
                      <View style={styles.editActions}>
                        <Pressable
                          disabled={savingEdit}
                          onPress={handleSaveEdit}
                          style={styles.saveButton}>
                          {savingEdit ? (
                            <ActivityIndicator color={colors.buttonText} />
                          ) : (
                            <Text style={styles.saveButtonText}>Guardar</Text>
                          )}
                        </Pressable>
                        <Pressable
                          disabled={savingEdit}
                          onPress={handleCancelEdit}
                          style={styles.cancelButton}>
                          <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.listItemHeader}>
                        <Text style={styles.listItemName}>{tipo.nombre}</Text>
                        <Text style={styles.listItemMeta}>{formatPrice(tipo.precio)}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleStartEdit(tipo)}
                        style={styles.editButton}>
                        <Text style={styles.editButtonText}>Editar</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
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
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 18,
      padding: 18,
      gap: 10,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 4,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.inputText,
      fontSize: 16,
    },
    button: {
      marginTop: 6,
      borderRadius: 12,
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
    message: {
      color: colors.textPrimary,
      fontSize: 13,
    },
    listSection: {
      marginTop: 8,
      gap: 8,
    },
    listTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    listState: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      padding: 12,
      alignItems: 'center',
      gap: 8,
    },
    listStateText: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
    },
    listWrap: {
      gap: 8,
    },
    listItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    listItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    listItemName: {
      color: colors.inputText,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },
    listItemMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    editButton: {
      alignSelf: 'flex-start',
      marginTop: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    editButtonText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    editWrap: {
      gap: 8,
      width: '100%',
    },
    editInput: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 9,
      color: colors.inputText,
      fontSize: 14,
    },
    editActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    saveButton: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: 13,
      fontWeight: '700',
    },
    cancelButton: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}

function formatPrice(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const [integerPart, decimalPart] = safe.toFixed(2).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${grouped},${decimalPart}`;
}
