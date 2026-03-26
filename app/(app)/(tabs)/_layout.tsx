import { useAppTheme } from "@/providers/theme-provider";
import { Ionicons } from "@expo/vector-icons";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import Logo from "@/components/ui/Logo";

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        sceneStyle: { paddingBottom: 14 },
        headerTitleAlign: "left",
        headerLeft: () => (
          <View style={styles.headerLeft}>
            <DrawerToggleButton tintColor={colors.headerText} />
            <Logo size={24} style={styles.headerLogo} />
          </View>
        ),
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
  if (routeName === "trabajos") {
    return "Trabajos";
  }
  if (routeName === "trabajos-entregados") {
    return "Entregados";
  }
  return "Dashboard";
}

function getRouteIcon(routeName: string): keyof typeof Ionicons.glyphMap {
  if (routeName === "trabajos") {
    return "briefcase-outline";
  }
  if (routeName === "trabajos-entregados") {
    return "checkmark-done-outline";
  }
  return "home-outline";
}

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    marginLeft: -4,
    marginRight: 8,
    borderRadius: 6,
  },
});
