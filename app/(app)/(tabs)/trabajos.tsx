import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { QuestionSearch } from "@/components/question-search";
import { TrabajoCard } from "@/components/trabajo-card";
import { supabase } from "@/lib/supabase";
import {
  CachedTrabajo,
  getCachedTrabajos,
  getLastSyncAt,
  replaceCachedTrabajos,
} from "@/lib/trabajos-cache";
import { ThemeColors, useAppTheme } from "@/providers/theme-provider";

type EstadoTrabajo = "creado" | "en_proceso" | "terminado" | "entregado";

type TrabajoItem = {
  id: number;
  nombreTrabajo: string;
  autor: string;
  especialidad: string;
  tipoTrabajo: string;
  fechaEntrega: string | null;
  estado: EstadoTrabajo;
  updatedAt: string;
};

export default function TrabajosScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const styles = createStyles(colors);

  const [trabajos, setTrabajos] = useState<TrabajoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const filteredTrabajos = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return trabajos;
    }

    return trabajos.filter((item) =>
      [
        item.nombreTrabajo,
        item.autor,
        item.especialidad,
        item.tipoTrabajo,
        item.estado,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchText, trabajos]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerSearchWrap}>
          <QuestionSearch
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar trabajo, autor o tipo"
            inHeader
            expandedWidth={176}
          />
        </View>
      ),
      headerRightContainerStyle: { paddingRight: 10 },
    });
  }, [navigation, searchText, styles.headerSearchWrap]);

  const loadTrabajos = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSyncInfo(null);

    let cachedRowsAll: TrabajoItem[] = [];
    try {
      cachedRowsAll = await getCachedTrabajos();
      const cachedVisible = cachedRowsAll.filter(
        (item) => item.estado !== "entregado",
      );
      setTrabajos(cachedVisible);
      if (cachedRowsAll.length > 0) {
        const lastSync = await getLastSyncAt();
        setSyncInfo(
          lastSync
            ? `Mostrando cache local. Ultima sincronizacion: ${formatDateTime(lastSync)}`
            : "Mostrando cache local. Sincronizando...",
        );
        setLoading(false);
      }
    } catch (error) {
      console.warn("No se pudo leer cache local de trabajos.", error);
    }

    const { data, error } = await supabase
      .from("trabajos")
      .select(
        "id,nombre_trabajo,estado,fecha_entrega,created_at,clientes!trabajos_cliente_id_fkey(nombre),especialidad!trabajos_especialidad_id_fkey(nombre),tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      if (cachedRowsAll.length === 0) {
        setErrorMessage(error.message);
      } else {
        setSyncInfo("Sin conexion a Supabase. Mostrando datos locales.");
      }
      return;
    }

    const mappedAll = mapTrabajos(data);
    const mappedVisible = mappedAll.filter(
      (item) => item.estado !== "entregado",
    );
    setTrabajos(mappedVisible);

    try {
      await replaceCachedTrabajos(mappedAll as CachedTrabajo[]);
    } catch (error) {
      console.warn("No se pudo actualizar cache local de trabajos.", error);
    }

    const lastSync = new Date().toISOString();
    setSyncInfo(`Sincronizado con Supabase: ${formatDateTime(lastSync)}`);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrabajos().catch((error) => {
        setLoading(false);
        setErrorMessage(String(error));
      });
    }, [loadTrabajos]),
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.buttonBg} />
          <Text style={styles.stateText}>Cargando trabajos...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>
            Error cargando trabajos: {errorMessage}
          </Text>
        </View>
      ) : trabajos.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>
            No hay trabajos registrados todavia.
          </Text>
        </View>
      ) : filteredTrabajos.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>No hay coincidencias para tu busqueda.</Text>
        </View>
      ) : (
        <>
          {syncInfo ? <Text style={styles.syncInfo}>{syncInfo}</Text> : null}
          <FlatList
            data={filteredTrabajos}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              return (
                <TrabajoCard
                  nombreTrabajo={item.nombreTrabajo}
                  autor={item.autor}
                  especialidad={item.especialidad}
                  tipoTrabajo={item.tipoTrabajo}
                  fechaEntrega={item.fechaEntrega}
                  estado={item.estado}
                  accentBorder
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/editar-trabajo",
                      params: { id: String(item.id) },
                    })
                  }
                />
              );
            }}
          />
        </>
      )}

      <Pressable
        accessibilityLabel="Crear nuevo trabajo"
        onPress={() => router.push("/(app)/nuevo-trabajo")}
        style={styles.fabWrap}
      >
        <Ionicons name="add" size={24} color={colors.buttonText} />
      </Pressable>
    </View>
  );
}

function mapTrabajos(rows: unknown): TrabajoItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const typedRow = row as {
        id?: number | string;
        nombre_trabajo?: string;
        estado?: string;
        fecha_entrega?: string | null;
        created_at?: string;
        clientes?: unknown;
        especialidad?: unknown;
        tipo_trabajo?: unknown;
      };

      return {
        id: Number(typedRow.id),
        nombreTrabajo: String(typedRow.nombre_trabajo ?? ""),
        autor: getRelationName(typedRow.clientes, "Sin autor"),
        especialidad: getRelationName(
          typedRow.especialidad,
          "Sin especialidad",
        ),
        tipoTrabajo: getRelationName(typedRow.tipo_trabajo, "Sin tipo"),
        fechaEntrega: typedRow.fecha_entrega
          ? String(typedRow.fecha_entrega)
          : null,
        estado: parseEstado(typedRow.estado),
        updatedAt: String(typedRow.created_at ?? new Date().toISOString()),
      };
    })
    .filter(
      (item) => Number.isFinite(item.id) && item.nombreTrabajo.length > 0,
    );
}

function getRelationName(value: unknown, fallback: string) {
  if (Array.isArray(value)) {
    const first = value[0] as { nombre?: string } | undefined;
    return first?.nombre ? String(first.nombre) : fallback;
  }
  if (value && typeof value === "object") {
    const record = value as { nombre?: string };
    return record.nombre ? String(record.nombre) : fallback;
  }
  return fallback;
}

function parseEstado(rawValue: unknown): EstadoTrabajo {
  if (rawValue === "entregado") {
    return "entregado";
  }
  if (rawValue === "en_proceso") {
    return "en_proceso";
  }
  if (rawValue === "terminado") {
    return "terminado";
  }
  return "creado";
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    headerSearchWrap: {
      width: 176,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    stateCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 16,
      padding: 18,
      alignItems: "center",
      gap: 10,
    },
    stateText: {
      color: colors.textSecondary,
      textAlign: "center",
      fontSize: 15,
    },
    listContent: {
      gap: 12,
      paddingBottom: 100,
    },
    syncInfo: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    fabWrap: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 9999,
      backgroundColor: colors.buttonBg,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 5,
    },
  });
}

function formatDateTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${minute}`;
}
