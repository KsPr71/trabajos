import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { QuestionSearch } from '@/components/question-search';
import { mapSupabaseClienteRow, upsertCachedClienteConTelefono } from '@/lib/catalogos-cache';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';
import { openWhatsAppChat } from '@/lib/whatsapp';

export default function ClientesScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const styles = createStyles(colors);

  const [nombre, setNombre] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clientesRegistrados, setClientesRegistrados] = useState<
    {
      id: number;
      nombre: string;
      fechaNacimiento: string | null;
      direccion: string | null;
      telefono: string | null;
    }[]
  >([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [editingClienteId, setEditingClienteId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editFechaNacimiento, setEditFechaNacimiento] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [formExpanded, setFormExpanded] = useState(false);

  const filteredClientes = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return clientesRegistrados;
    }
    return clientesRegistrados.filter((cliente) =>
      [
        cliente.nombre,
        cliente.telefono ?? '',
        cliente.direccion ?? '',
        cliente.fechaNacimiento ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [clientesRegistrados, searchText]);

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

  const loadClientesRegistrados = useCallback(async () => {
    setLoadingLista(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('id,nombre,fecha_nacimiento,direccion,telefono')
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('No se pudo cargar la lista de clientes.', error);
      setLoadingLista(false);
      return;
    }

    const mapped = (data ?? [])
      .map((row) => ({
        id: Number(row.id),
        nombre: String(row.nombre ?? ''),
        fechaNacimiento: row.fecha_nacimiento ? String(row.fecha_nacimiento) : null,
        direccion: row.direccion ? String(row.direccion) : null,
        telefono: row.telefono ? String(row.telefono) : null,
      }))
      .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);

    setClientesRegistrados(mapped);
    setLoadingLista(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClientesRegistrados().catch((error) => {
        console.warn('No se pudo refrescar la lista de clientes.', error);
        setLoadingLista(false);
      });
    }, [loadClientesRegistrados])
  );

  const handleCreate = async () => {
    const cleanNombre = nombre.trim();
    const cleanFecha = fechaNacimiento.trim();
    const cleanDireccion = direccion.trim();
    const cleanTelefono = telefono.trim();

    if (!cleanNombre) {
      setMessage('El nombre es obligatorio.');
      return;
    }

    if (cleanFecha && !/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha)) {
      setMessage('Fecha invalida. Usa formato YYYY-MM-DD.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre: cleanNombre,
        fecha_nacimiento: cleanFecha || null,
        direccion: cleanDireccion || null,
        telefono: cleanTelefono || null,
      })
      .select('id,nombre,telefono,created_at')
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      setMessage(`Error: ${error?.message ?? 'No se pudo crear el cliente.'}`);
      return;
    }

    const cachedItem = mapSupabaseClienteRow(data);
    if (cachedItem) {
      try {
        await upsertCachedClienteConTelefono(cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de clientes.', cacheError);
      }
    }

    setNombre('');
    setFechaNacimiento('');
    setDireccion('');
    setTelefono('');
    setMessage('Cliente creado correctamente.');
    await loadClientesRegistrados();
  };

  const handleStartEdit = (cliente: {
    id: number;
    nombre: string;
    fechaNacimiento: string | null;
    direccion: string | null;
    telefono: string | null;
  }) => {
    setEditingClienteId(cliente.id);
    setEditNombre(cliente.nombre);
    setEditFechaNacimiento(cliente.fechaNacimiento ?? '');
    setEditDireccion(cliente.direccion ?? '');
    setEditTelefono(cliente.telefono ?? '');
  };

  const handleCancelEdit = () => {
    setEditingClienteId(null);
    setEditNombre('');
    setEditFechaNacimiento('');
    setEditDireccion('');
    setEditTelefono('');
  };

  const handleSaveEdit = async () => {
    if (!editingClienteId) {
      return;
    }

    const cleanNombre = editNombre.trim();
    const cleanFecha = editFechaNacimiento.trim();
    const cleanDireccion = editDireccion.trim();
    const cleanTelefono = editTelefono.trim();

    if (!cleanNombre) {
      setMessage('El nombre es obligatorio para editar.');
      return;
    }
    if (cleanFecha && !/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha)) {
      setMessage('Fecha invalida en edicion. Usa formato YYYY-MM-DD.');
      return;
    }

    setSavingEdit(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('clientes')
      .update({
        nombre: cleanNombre,
        fecha_nacimiento: cleanFecha || null,
        direccion: cleanDireccion || null,
        telefono: cleanTelefono || null,
      })
      .eq('id', editingClienteId)
      .select('id,nombre,telefono,created_at')
      .maybeSingle();

    setSavingEdit(false);

    if (error || !data) {
      setMessage(`Error actualizando cliente: ${error?.message ?? 'sin filas afectadas.'}`);
      return;
    }

    const cachedItem = mapSupabaseClienteRow(data);
    if (cachedItem) {
      try {
        await upsertCachedClienteConTelefono(cachedItem);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de clientes tras editar.', cacheError);
      }
    }

    setMessage('Cliente actualizado correctamente.');
    handleCancelEdit();
    await loadClientesRegistrados();
  };

  const handleWhatsApp = useCallback(
    async (cliente: {
      id: number;
      nombre: string;
      fechaNacimiento: string | null;
      direccion: string | null;
      telefono: string | null;
    }) => {
      const telefonoCliente = cliente.telefono?.trim() ?? '';
      if (!telefonoCliente) {
        showToast('Este cliente no tiene telefono.', 'error');
        return;
      }

      try {
        await openWhatsAppChat(
          telefonoCliente,
          `Hola ${cliente.nombre}, te escribo sobre tu trabajo.`,
        );
      } catch (error) {
        showToast(`No se pudo abrir WhatsApp: ${String(error)}`, 'error');
      }
    },
    [showToast],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.accordionSection}>
          <Pressable
            onPress={() => setFormExpanded((prev) => !prev)}
            style={styles.accordionHeader}>
            <Text style={styles.accordionTitle}>Nuevo cliente</Text>
            <Ionicons
              name={formExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textPrimary}
            />
          </Pressable>

          {formExpanded ? (
            <View style={styles.accordionContent}>
              <Text style={styles.help}>Campos de la tabla clientes</Text>

              <TextInput
                placeholder="Nombre"
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
              />
              <TextInput
                placeholder="Fecha de nacimiento (YYYY-MM-DD)"
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.input}
                value={fechaNacimiento}
                onChangeText={setFechaNacimiento}
              />
              <TextInput
                placeholder="Direccion"
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.input}
                value={direccion}
                onChangeText={setDireccion}
              />
              <TextInput
                placeholder="Telefono"
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.input}
                value={telefono}
                onChangeText={setTelefono}
              />

              <Pressable disabled={loading} onPress={handleCreate} style={styles.button}>
                {loading ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text style={styles.buttonText}>Guardar cliente</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Clientes registrados</Text>

          {loadingLista ? (
            <View style={styles.listState}>
              <ActivityIndicator color={colors.buttonBg} />
              <Text style={styles.listStateText}>Cargando lista...</Text>
            </View>
          ) : clientesRegistrados.length === 0 ? (
            <View style={styles.listState}>
              <Text style={styles.listStateText}>No hay clientes registrados.</Text>
            </View>
          ) : filteredClientes.length === 0 ? (
            <View style={styles.listState}>
              <Text style={styles.listStateText}>No hay coincidencias para tu busqueda.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {filteredClientes.map((cliente) => (
                <View key={cliente.id} style={styles.listItem}>
                  {editingClienteId === cliente.id ? (
                    <View style={styles.editWrap}>
                      <TextInput
                        placeholder="Nombre"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editNombre}
                        onChangeText={setEditNombre}
                      />
                      <TextInput
                        placeholder="Fecha nacimiento (YYYY-MM-DD)"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editFechaNacimiento}
                        onChangeText={setEditFechaNacimiento}
                      />
                      <TextInput
                        placeholder="Direccion"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editDireccion}
                        onChangeText={setEditDireccion}
                      />
                      <TextInput
                        placeholder="Telefono"
                        placeholderTextColor={colors.inputPlaceholder}
                        style={styles.editInput}
                        value={editTelefono}
                        onChangeText={setEditTelefono}
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
                      <Text style={styles.listItemName}>{cliente.nombre}</Text>
                      <Text style={styles.listItemMeta}>
                        {cliente.telefono ? cliente.telefono : 'Sin telefono'}
                      </Text>
                      <View style={styles.itemActionsRow}>
                        <Pressable
                          onPress={() => handleStartEdit(cliente)}
                          style={styles.editButton}>
                          <Text style={styles.editButtonText}>Editar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleWhatsApp(cliente)}
                          disabled={!cliente.telefono?.trim()}
                          style={[
                            styles.whatsButton,
                            !cliente.telefono?.trim() ? styles.whatsButtonDisabled : null,
                          ]}>
                          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                          <Text style={styles.whatsButtonText}>WhatsApp</Text>
                        </Pressable>
                      </View>
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
    headerSearchWrap: {
      width: 176,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 18,
      padding: 18,
      gap: 10,
    },
    accordionSection: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    accordionHeader: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    accordionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      flex: 1,
    },
    accordionContent: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 10,
    },
    help: {
      color: colors.textSecondary,
      marginTop: 2,
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
    listItemName: {
      color: colors.inputText,
      fontSize: 14,
      fontWeight: '700',
    },
    listItemMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    editButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center',
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
    itemActionsRow: {
      marginTop: 6,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    whatsButton: {
      borderRadius: 10,
      backgroundColor: '#25D366',
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    whatsButtonDisabled: {
      opacity: 0.45,
    },
    whatsButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
