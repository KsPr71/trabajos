import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

export default function TipoTrabajoScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

    const { error } = await supabase
      .from('tipo_trabajo')
      .insert({ nombre: cleanNombre, precio: parsedPrecio });

    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setNombre('');
    setPrecio('');
    setMessage('Tipo de trabajo creado correctamente.');
  };

  return (
    <View style={styles.container}>
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
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
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
  });
}
