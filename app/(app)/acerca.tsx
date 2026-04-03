import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

import Logo from '@/components/ui/Logo';
import { useAppTheme } from '@/providers/theme-provider';

const APP_NAME = 'Archei';
const APP_VERSION = Constants.expoConfig?.version ?? '1.4.0';

export default function AcercaScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.heroRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.title}>{APP_NAME}</Text>
            <Text style={styles.subtitle}>Gestor de trabajos y entregas</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Version {APP_VERSION}</Text>
            </View>
          </View>
          <Logo size={86} style={styles.heroLogo} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Que incluye</Text>
        <Text style={styles.itemText}>- Login y sesiones con Supabase Auth.</Text>
        <Text style={styles.itemText}>
          - Gestion de trabajos, clientes, tipos, especialidades e instituciones.
        </Text>
        <Text style={styles.itemText}>
          - Dashboard con estados, ganancias y proximas entregas.
        </Text>
        <Text style={styles.itemText}>
          - Cache local con SQLite y sincronizacion en segundo plano.
        </Text>
        <Text style={styles.itemText}>- Notificaciones push y avisos por estado.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tecnologia</Text>
        <Text style={styles.metaText}>Expo + React Native + Expo Router</Text>
        <Text style={styles.metaText}>Supabase (Postgres, Auth, Edge Functions)</Text>
        <Text style={styles.metaText}>SQLite local para rendimiento offline-first</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroTextWrap: {
      flex: 1,
      paddingRight: 12,
    },
    heroLogo: {
      borderRadius: 10,
      marginRight: -10,
      marginTop: -12,
      marginBottom: -12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.badgeBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginTop: 4,
    },
    badgeText: {
      color: colors.badgeText,
      fontSize: 12,
      fontWeight: '700',
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 2,
    },
    itemText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
