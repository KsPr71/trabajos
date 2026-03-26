import { Ionicons } from '@expo/vector-icons';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { Tabs } from 'expo-router';

import { useAppTheme } from '@/providers/theme-provider';

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerLeft: () => <DrawerToggleButton tintColor={colors.headerText} />,
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.tabBorder,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        title: getRouteTitle(route.name),
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={getRouteIcon(route.name)} size={size} color={color} />
        ),
      })}
    />
  );
}

function getRouteTitle(routeName: string) {
  if (routeName === 'trabajos') {
    return 'Trabajos';
  }
  if (routeName === 'clientes-contacto') {
    return 'Clientes';
  }
  return 'Dashboard';
}

function getRouteIcon(routeName: string): keyof typeof Ionicons.glyphMap {
  if (routeName === 'trabajos') {
    return 'briefcase-outline';
  }
  if (routeName === 'clientes-contacto') {
    return 'people-outline';
  }
  return 'home-outline';
}
