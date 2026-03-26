import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

const drawerLabels: Record<string, string> = {
  '(tabs)': 'Inicio',
  perfil: 'Perfil',
  clientes: 'Clientes',
  'tipo-trabajo': 'Tipo de trabajo',
  especialidad: 'Especialidad',
  institucion: 'Institucion',
  ajustes: 'Ajustes',
  'nuevo-trabajo': 'Nuevo trabajo',
  'editar-trabajo': 'Editar trabajo',
  'trabajos-entregados': 'Trabajos entregados',
};

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.border} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Drawer
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        drawerStyle: { backgroundColor: colors.drawerBg },
        drawerActiveTintColor: colors.drawerActiveText,
        drawerActiveBackgroundColor: colors.drawerActiveBg,
        drawerInactiveTintColor: colors.drawerInactiveText,
        title: drawerLabels[route.name] ?? route.name,
        drawerLabel: drawerLabels[route.name] ?? route.name,
        drawerItemStyle:
          route.name === 'nuevo-trabajo' || route.name === 'editar-trabajo'
            ? { display: 'none' }
            : undefined,
        headerShown: route.name !== '(tabs)',
      })}
    />
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0B1F3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
