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
        title: route.name === 'trabajos' ? 'Trabajos' : 'Dashboard',
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={route.name === 'trabajos' ? 'briefcase-outline' : 'home-outline'}
            size={size}
            color={color}
          />
        ),
      })}
    />
  );
}
