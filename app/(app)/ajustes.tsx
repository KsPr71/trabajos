import { StyleSheet, Switch, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

export default function AjustesScreen() {
  const { isDark, mode, toggleTheme, colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Ajustes</Text>
        <Text style={styles.subtitle}>Tema de la aplicacion</Text>

        <View style={styles.row}>
          <Text style={styles.label}>{mode === 'dark' ? 'Oscuro (actual)' : 'Claro'}</Text>
          <Switch
            value={!isDark}
            onValueChange={toggleTheme}
            thumbColor={colors.buttonText}
            trackColor={{ false: colors.tabInactive, true: colors.buttonBg }}
          />
        </View>
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
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    label: {
      color: colors.inputText,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
