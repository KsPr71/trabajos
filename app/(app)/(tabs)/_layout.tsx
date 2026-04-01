import { useAppTheme } from "@/providers/theme-provider";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import Logo from "@/components/ui/Logo";

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        sceneStyle: { paddingBottom: 14 },
        headerTitleAlign: "left",
        headerLeft: () => (
          <View style={styles.headerLeft}>
            <DrawerToggleButton tintColor={colors.headerText} />
            <Logo size={35} style={styles.headerLogo} />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.tabBorder,
          height: 100,
          paddingBottom: 12,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          paddingTop: 1,
        },
        tabBarIconStyle: {
          transform: [{ translateY: -10 }],
        },
        tabBarLabelStyle: {
          fontSize: 11,
          includeFontPadding: false,
          transform: [{ translateY: -8 }],
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trabajos"
        options={{
          title: "Trabajos",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agregar"
        options={{
          title: "Agregar",
          tabBarLabel: "",
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <AddTrabajoTabButton
              {...props}
              color={colors.buttonBg}
              iconColor={colors.buttonText}
              onPress={() => router.push("/(app)/nuevo-trabajo")}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trabajos-entregados"
        options={{
          title: "Entregados",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="acerca"
        options={{
          title: "Acerca",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="information-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

type AddTrabajoTabButtonProps = BottomTabBarButtonProps & {
  color: string;
  iconColor: string;
};

function AddTrabajoTabButton({
  onPress,
  color,
  iconColor,
}: AddTrabajoTabButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar trabajo"
      onPress={onPress}
      style={[styles.fabTabButton, { backgroundColor: color }]}
    >
      <Ionicons name="add" size={23} color={iconColor} />
    </Pressable>
  );
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
  fabTabButton: {
    alignSelf: "center",
    width: 50,
    height: 50,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
