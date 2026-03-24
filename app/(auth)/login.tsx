import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage('Completa correo y contrasena.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const response = isRegister
      ? await supabase.auth.signUp({ email: cleanEmail, password })
      : await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    setLoading(false);

    if (response.error) {
      if (response.error.message.toLowerCase().includes('email not confirmed')) {
        setMessage(
          'Tu cuenta existe pero falta confirmar el correo. Revisa tu email y luego inicia sesion.'
        );
        return;
      }
      setMessage(response.error.message);
      return;
    }

    if (isRegister) {
      if (response.data.session) {
        setMessage('Cuenta creada y sesion iniciada.');
      } else {
        setMessage('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesion.');
      }
      return;
    }

    setMessage('Login correcto.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>SUPABASE AUTH</Text>
        <Text style={styles.title}>{isRegister ? 'Crear cuenta' : 'Iniciar sesion'}</Text>
        <Text style={styles.subtitle}>Accede a tu espacio de trabajo.</Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="correo@ejemplo.com"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          secureTextEntry
          placeholder="Contrasena"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        <Pressable disabled={loading} onPress={handleAuth} style={styles.primaryButton}>
          {loading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.primaryButtonText}>{isRegister ? 'Crear cuenta' : 'Entrar'}</Text>
          )}
        </Pressable>

        <Pressable
          disabled={loading}
          onPress={() => setIsRegister((prev) => !prev)}
          style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>
            {isRegister ? 'Ya tengo cuenta' : 'No tengo cuenta'}
          </Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: 22,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 20,
      gap: 12,
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.badgeBg,
      color: colors.badgeText,
      fontWeight: '700',
      fontSize: 11,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
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
    primaryButton: {
      marginTop: 6,
      borderRadius: 12,
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
    },
    primaryButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    message: {
      color: colors.textPrimary,
      fontSize: 13,
    },
  });
}
