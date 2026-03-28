import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { QuestionSearch } from "@/components/question-search";
import { TrabajoCustomCard } from "@/components/ui/custom-card";
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
  tipoTrabajoColor: string | null;
  fechaEntrega: string | null;
  estado: EstadoTrabajo;
  updatedAt: string;
};

export default function TrabajosScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const styles = createStyles(colors);

  const [trabajos, setTrabajos] = useState<TrabajoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchBarWidth, setSearchBarWidth] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

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

  const hasTrabajosPorTerminarEstaSemana = useMemo(
    () => trabajos.some((item) => isTrabajoPorTerminarEstaSemana(item)),
    [trabajos],
  );

  const handleToolsLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0 && width !== searchBarWidth) {
      setSearchBarWidth(width);
    }
  }, [searchBarWidth]);

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
        "id,nombre_trabajo,estado,fecha_entrega,created_at,clientes!trabajos_cliente_id_fkey(nombre),especialidad!trabajos_especialidad_id_fkey(nombre),tipo_trabajo!trabajos_tipo_trabajo_id_fkey(nombre,color)",
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
      {!loading && !errorMessage && hasTrabajosPorTerminarEstaSemana ? (
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.alertBannerText}>
            Hay trabajos por terminar esta semana
          </Text>
        </View>
      ) : null}

      <View style={styles.toolsRow} onLayout={handleToolsLayout}>
        {!searchOpen && syncInfo ? <Text style={styles.syncInfo}>{syncInfo}</Text> : null}
        <View style={styles.searchWrap}>
          <QuestionSearch
            value={searchText}
            onChangeText={setSearchText}
            onOpenChange={setSearchOpen}
            placeholder="Buscar trabajo, autor o tipo"
            inHeader
            expandedWidth={searchBarWidth > 0 ? searchBarWidth : undefined}
            collapsedSize={34}
            iconSize={18}
          />
        </View>
      </View>

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
          <FlatList
            data={filteredTrabajos}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              return (
                <TrabajoCustomCard
                  nombreTrabajo={item.nombreTrabajo}
                  autor={item.autor}
                  especialidad={item.especialidad}
                  tipoTrabajo={item.tipoTrabajo}
                  tipoTrabajoColor={item.tipoTrabajoColor}
                  fechaEntrega={item.fechaEntrega}
                  estado={item.estado}
                  accentBorder
                  showEntregaAlertChip={isTrabajoPorTerminarEstaSemana(item)}
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
      const tipoTrabajoInfo = getTipoTrabajoInfo(typedRow.tipo_trabajo);

      return {
        id: Number(typedRow.id),
        nombreTrabajo: String(typedRow.nombre_trabajo ?? ""),
        autor: getRelationName(typedRow.clientes, "Sin autor"),
        especialidad: getRelationName(
          typedRow.especialidad,
          "Sin especialidad",
        ),
        tipoTrabajo: tipoTrabajoInfo.nombre,
        tipoTrabajoColor: tipoTrabajoInfo.color,
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

function getTipoTrabajoInfo(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { nombre?: string; color?: string } | undefined;
    return {
      nombre: first?.nombre ? String(first.nombre) : "Sin tipo",
      color: parseColor(first?.color),
    };
  }
  if (value && typeof value === "object") {
    const record = value as { nombre?: string; color?: string };
    return {
      nombre: record.nombre ? String(record.nombre) : "Sin tipo",
      color: parseColor(record.color),
    };
  }
  return {
    nombre: "Sin tipo",
    color: null,
  };
}

function parseColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
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
    toolsRow: {
      minHeight: 30,
      justifyContent: "center",
      marginBottom: 10,
    },
    searchWrap: {
      position: "absolute",
      top: 0,
      right: 0,
    },
    alertBanner: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#991B1B",
      backgroundColor: "#DC2626",
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    alertBannerText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
      flex: 1,
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
      paddingHorizontal: 2,
      paddingRight: 38,
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

function isTrabajoPorTerminarEstaSemana(item: TrabajoItem) {
  if (item.estado === "terminado" || item.estado === "entregado") {
    return false;
  }
  if (!item.fechaEntrega) {
    return false;
  }

  const fechaEntrega = parseDateISO(item.fechaEntrega);
  if (!fechaEntrega) {
    return false;
  }

  const hoy = startOfDay(new Date());
  const diffMs = fechaEntrega.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  return diffDays <= 7 && diffDays >= 0;
}

function parseDateISO(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
