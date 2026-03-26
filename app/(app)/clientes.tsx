import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { mapSupabaseClienteRow, upsertCachedClienteConTelefono } from '@/lib/catalogos-cache';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

export default function ClientesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [nombre, setNombre] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Nuevo cliente</Text>
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

        {message ? <Text style={styles.message}>{message}</Text> : null}
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
    },
    help: {
      color: colors.textSecondary,
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
  });
}
