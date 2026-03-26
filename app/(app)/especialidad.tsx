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

export default function EspecialidadScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [especialidadesRegistradas, setEspecialidadesRegistradas] = useState<
    { id: number; nombre: string }[]
  >([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadEspecialidades = useCallback(async () => {
    setLoadingLista(true);
    const { data, error } = await supabase
      .from('especialidad')
      .select('id,nombre')
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('No se pudo cargar la lista de especialidades.', error);
      setLoadingLista(false);
      return;
    }

    const mapped = (data ?? [])
      .map((row) => ({
        id: Number(row.id),
        nombre: String(row.nombre ?? ''),
      }))
      .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);

    setEspecialidadesRegistradas(mapped);
    setLoadingLista(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEspecialidades().catch((error) => {
        console.warn('No se pudo refrescar la lista de especialidades.', error);
        setLoadingLista(false);
      });
    }, [loadEspecialidades])
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
      .from('especialidad')
      .insert({ nombre: cleanNombre })
      .select('id,nombre,created_at')
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      setMessage(`Error: ${error?.message ?? 'No se pudo crear la especialidad.'}`);
      return;
    }

    const cachedItem = mapSupabaseCatalogRow(data);
    if (cachedItem) {
      try {
        await upsertCachedCatalogo('especialidad', cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de especialidad.', cacheError);
      }
    }

    setNombre('');
    setMessage('Especialidad creada correctamente.');
    await loadEspecialidades();
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
      .from('especialidad')
      .update({ nombre: cleanNombre })
      .eq('id', editingId)
      .select('id,nombre,created_at')
      .maybeSingle();

    setSavingEdit(false);

    if (error || !data) {
      setMessage(`Error actualizando especialidad: ${error?.message ?? 'sin filas afectadas.'}`);
      return;
    }

    const cachedItem = mapSupabaseCatalogRow(data);
    if (cachedItem) {
      try {
        await upsertCachedCatalogo('especialidad', cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de especialidad tras editar.', cacheError);
      }
    }

    setMessage('Especialidad actualizada correctamente.');
    handleCancelEdit();
    await loadEspecialidades();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Nueva especialidad</Text>

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
            <Text style={styles.buttonText}>Guardar especialidad</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Especialidades registradas</Text>

          {loadingLista ? (
            <View style={styles.listState}>
              <ActivityIndicator color={colors.buttonBg} />
              <Text style={styles.listStateText}>Cargando lista...</Text>
            </View>
          ) : especialidadesRegistradas.length === 0 ? (
            <View style={styles.listState}>
              <Text style={styles.listStateText}>No hay especialidades registradas.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {especialidadesRegistradas.map((especialidad) => (
                <View key={especialidad.id} style={styles.listItem}>
                  {editingId === especialidad.id ? (
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
                      <Text style={styles.listItemName}>{especialidad.nombre}</Text>
                      <Pressable
                        onPress={() => handleStartEdit(especialidad)}
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
