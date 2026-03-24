import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

export default function TrabajosScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Trabajos</Text>
        <Text style={styles.text}>
          Aqui conectaremos tu lista de trabajos desde Supabase (tabla `trabajos`).
        </Text>
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
  });
}
