import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

export default function PerfilScreen() {
  const { session, signOut } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(false);
  const email = session?.user?.email ?? 'Sin correo';

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error('Error cerrando sesion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.label}>Correo autenticado</Text>
        <Text style={styles.value}>{email}</Text>

        <Pressable disabled={loading} onPress={handleSignOut} style={styles.button}>
          {loading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>Cerrar sesion</Text>
          )}
        </Pressable>
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
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 20,
      gap: 8,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: '800',
      marginBottom: 8,
    },
    label: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 13,
    },
    value: {
      color: colors.textPrimary,
      fontSize: 16,
      marginBottom: 16,
    },
    button: {
      backgroundColor: colors.buttonBg,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
