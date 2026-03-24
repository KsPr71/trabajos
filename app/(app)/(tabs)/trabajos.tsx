import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

export default function TrabajosScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Trabajos</Text>
        <Text style={styles.text}>
          Aqui conectaremos tu lista de trabajos desde Supabase (tabla `trabajos`).
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Crear nuevo trabajo"
        onPress={() => router.push('/(app)/nuevo-trabajo')}
        style={styles.fabWrap}>
        <Ionicons name="add" size={24} color={colors.buttonText} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 18,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 10,
    },
    text: {
      color: colors.textSecondary,
      lineHeight: 22,
      fontSize: 15,
    },
    fabWrap: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 9999,
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 5,
    },
  });
}
