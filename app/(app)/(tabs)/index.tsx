import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

export default function DashboardScreen() {
  const userEmail = useAuth().session?.user?.email ?? 'usuario';
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>DASHBOARD</Text>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>{userEmail}</Text>
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
      borderRadius: 20,
      padding: 22,
    },
    badge: {
      alignSelf: 'flex-start',
      color: colors.badgeText,
      backgroundColor: colors.badgeBg,
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      marginTop: 8,
      fontSize: 16,
    },
  });
}
