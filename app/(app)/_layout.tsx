import { Ionicons } from "@expo/vector-icons";
import {
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import Developer from "@/components/ui/dev";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const drawerLabels: Record<string, string> = {
  "(tabs)": "Inicio",
  perfil: "Perfil",
  clientes: "Clientes",
  "tipo-trabajo": "Tipo de trabajo",
  especialidad: "Especialidad",
  institucion: "Institucion",
  ajustes: "Ajustes",
  "nuevo-trabajo": "Nuevo trabajo",
  "editar-trabajo": "Editar trabajo",
};
const imagenPersonalizada = require("@/assets/images/icon-negative.png");

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
      drawerContent={(props) => (
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={styles.drawerScrollContent}
        >
          <View style={[styles.drawerHeader, { backgroundColor: "#053e8c" }]}>
            <Image
              source={imagenPersonalizada}
              style={{
                width: 60,
                height: 60,
                alignSelf: "center",
                padding: 10,
                marginLeft: 15,
              }}
            />

            <Text style={styles.textoHeader}> Archivo de trabajos</Text>
          </View>
          <View
            style={[
              styles.welcomeCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.welcomeRow}>
              <View style={styles.welcomeTextBlock}>
                <Text
                  style={[styles.welcomeTitle, { color: colors.textPrimary }]}
                >
                  Bienvenido
                </Text>
                <Text
                  style={[
                    styles.welcomeSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {session.user.email ?? "usuario"}
                </Text>
              </View>
              <View
                style={[
                  styles.avatarWrap,
                  {
                    backgroundColor: colors.badgeBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="person" size={22} color={colors.badgeText} />
              </View>
            </View>
          </View>
          <View
            style={[
              styles.contenedorMenu,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <DrawerItemList {...props} />
          </View>
          <View>
            <Developer />
          </View>
        </DrawerContentScrollView>
      )}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        drawerStyle: { backgroundColor: colors.drawerBg },
        drawerActiveTintColor: colors.drawerActiveText,
        drawerActiveBackgroundColor: colors.drawerActiveBg,
        drawerInactiveTintColor: colors.drawerInactiveText,
        sceneStyle: { paddingBottom: 14 },
        title: drawerLabels[route.name] ?? route.name,
        drawerLabel: drawerLabels[route.name] ?? route.name,
        drawerIcon: ({ color, size }) => (
          <Ionicons
            name={getDrawerIcon(route.name)}
            size={size}
            color={color}
          />
        ),
        drawerItemStyle:
          route.name === "nuevo-trabajo" || route.name === "editar-trabajo"
            ? { display: "none" }
            : styles.drawerItem,
        headerShown: route.name !== "(tabs)",
      })}
    />
  );
}

function getDrawerIcon(routeName: string): keyof typeof Ionicons.glyphMap {
  if (routeName === "(tabs)") {
    return "home-outline";
  }
  if (routeName === "perfil") {
    return "person-outline";
  }
  if (routeName === "clientes") {
    return "people-outline";
  }
  if (routeName === "tipo-trabajo") {
    return "pricetags-outline";
  }
  if (routeName === "especialidad") {
    return "school-outline";
  }
  if (routeName === "institucion") {
    return "business-outline";
  }
  if (routeName === "ajustes") {
    return "settings-outline";
  }
  if (routeName === "nuevo-trabajo") {
    return "add-circle-outline";
  }
  if (routeName === "editar-trabajo") {
    return "create-outline";
  }
  return "ellipse-outline";
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: "#0B1F3A",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerScrollContent: {
    paddingTop: 28,
  },
  welcomeCard: {
    //marginTop: 30,
    marginBottom: 10,
    borderWidth: 2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  welcomeTextBlock: {
    flex: 1,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  contenedorMenu: {
    padding: 25,
    borderWidth: 2,
    borderRadius: 16,
  },

  drawerItem: {
    borderRadius: 16,
    marginVertical: 4,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  welcomeSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  textoHeader: {
    fontSize: 14,
    color: "white",
    textTransform: "uppercase",
    alignSelf: "center",
    marginLeft: 10,
  },
  drawerHeader: {
    height: 80,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "blue",
    display: "flex",
    flexDirection: "row",
    alignContent: "flex-start",
    textAlignVertical: "center",
    verticalAlign: "middle",
  },
});
