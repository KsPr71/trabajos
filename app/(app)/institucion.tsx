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

import {
  getCachedCatalogo,
  mapSupabaseCatalogRow,
  mapSupabaseCatalogRows,
  replaceCachedCatalogo,
  upsertCachedCatalogo,
} from '@/lib/catalogos-cache';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

export default function InstitucionScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [institucionesRegistradas, setInstitucionesRegistradas] = useState<
    { id: number; nombre: string }[]
  >([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadInstituciones = useCallback(async () => {
    setLoadingLista(true);
    let hasCache = false;

    try {
      const cachedRows = await getCachedCatalogo('institucion');
      const cachedMapped = cachedRows
        .map((row) => ({
          id: Number(row.id),
          nombre: String(row.nombre ?? ''),
        }))
        .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);

      if (cachedMapped.length > 0) {
        hasCache = true;
        setInstitucionesRegistradas(cachedMapped);
        setLoadingLista(false);
      }
    } catch (cacheError) {
      console.warn('No se pudo leer cache local de instituciones.', cacheError);
    }

    const { data, error } = await supabase
      .from('institucion')
      .select('id,nombre,created_at')
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('No se pudo cargar la lista de instituciones.', error);
      if (!hasCache) {
        setMessage('No se pudo sincronizar instituciones y no hay cache local disponible.');
      }
      setLoadingLista(false);
      return;
    }

    const mapped = (data ?? [])
      .map((row) => ({
        id: Number(row.id),
        nombre: String(row.nombre ?? ''),
      }))
      .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);

    setInstitucionesRegistradas(mapped);
    setLoadingLista(false);

    try {
      await replaceCachedCatalogo('institucion', mapSupabaseCatalogRows(data));
    } catch (cacheError) {
      console.warn('No se pudo reemplazar cache local de instituciones.', cacheError);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInstituciones().catch((error) => {
        console.warn('No se pudo refrescar la lista de instituciones.', error);
        setLoadingLista(false);
      });
    }, [loadInstituciones])
  );

  const handleCreate = async () => {
    const cleanNombre = nombre.trim();
    if (!cleanNombre) {
      setMessage('El nombre es obligatorio.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('institucion')
      .insert({ nombre: cleanNombre })
      .select('id,nombre,created_at')
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      setMessage(`Error: ${error?.message ?? 'No se pudo crear la institucion.'}`);
      return;
    }

    const cachedItem = mapSupabaseCatalogRow(data);
    if (cachedItem) {
      try {
        await upsertCachedCatalogo('institucion', cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de institucion.', cacheError);
      }
    }

    setNombre('');
    setMessage('Institucion creada correctamente.');
    await loadInstituciones();
  };

  const handleStartEdit = (item: { id: number; nombre: string }) => {
    setEditingId(item.id);
    setEditNombre(item.nombre);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      return;
    }
    const cleanNombre = editNombre.trim();
    if (!cleanNombre) {
      setMessage('El nombre es obligatorio para editar.');
      return;
    }

    setSavingEdit(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('institucion')
      .update({ nombre: cleanNombre })
      .eq('id', editingId)
      .select('id,nombre,created_at')
      .maybeSingle();

    setSavingEdit(false);

    if (error || !data) {
      setMessage(`Error actualizando institucion: ${error?.message ?? 'sin filas afectadas.'}`);
      return;
    }

    const cachedItem = mapSupabaseCatalogRow(data);
    if (cachedItem) {
      try {
        await upsertCachedCatalogo('institucion', cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de institucion tras editar.', cacheError);
      }
    }

    setMessage('Institucion actualizada correctamente.');
    handleCancelEdit();
    await loadInstituciones();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Nueva institucion</Text>

        <TextInput
          placeholder="Nombre"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
        />

        <Pressable disabled={loading} onPress={handleCreate} style={styles.button}>
          {loading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>Guardar institucion</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Instituciones registradas</Text>

          {loadingLista ? (
            <View style={styles.listState}>
              <ActivityIndicator color={colors.buttonBg} />
              <Text style={styles.listStateText}>Cargando lista...</Text>
            </View>
          ) : institucionesRegistradas.length === 0 ? (
            <View style={styles.listState}>
              <Text style={styles.listStateText}>No hay instituciones registradas.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {institucionesRegistradas.map((institucion) => (
                <View key={institucion.id} style={styles.listItem}>
                  {editingId === institucion.id ? (
                    <View style={styles.editWrap}>
                      <TextInput
                        placeholder="Nombre"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editNombre}
                        onChangeText={setEditNombre}
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
                      <Text style={styles.listItemName}>{institucion.nombre}</Text>
                      <Pressable
                        onPress={() => handleStartEdit(institucion)}
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
    },
    listItemName: {
      color: colors.inputText,
      fontSize: 14,
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
