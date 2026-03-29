import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ComboBox, ComboOption } from '@/components/ui/combobox';
import {
  getCachedCatalogo,
  getCachedClientesConTelefono,
  mapSupabaseClienteRows,
  mapSupabaseCatalogRows,
  replaceCachedClientesConTelefono,
  replaceCachedCatalogo,
} from '@/lib/catalogos-cache';
import {
  deleteCachedTrabajoById,
  deleteCachedTrabajoDetalleById,
  getCachedTrabajoDetalleById,
  upsertCachedTrabajo,
  upsertCachedTrabajoDetalle,
} from '@/lib/trabajos-cache';
import { supabase } from '@/lib/supabase';
import { buildTrabajoTerminadoWhatsAppMessage, openWhatsAppChat } from '@/lib/whatsapp';
import { ThemeColors, useAppTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

type PickerField = 'recibido' | 'entrega' | null;
type EstadoTrabajo = 'creado' | 'en_proceso' | 'terminado' | 'entregado';

export default function EditarTrabajoScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const styles = createStyles(colors);

  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const trabajoId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    return Number(raw);
  }, [params.id]);

  const [nombreTrabajo, setNombreTrabajo] = useState('');
  const [tipoTrabajoId, setTipoTrabajoId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [especialidadId, setEspecialidadId] = useState<number | null>(null);
  const [institucionId, setInstitucionId] = useState<number | null>(null);
  const [estado, setEstado] = useState<EstadoTrabajo>('creado');
  const [estadoOriginal, setEstadoOriginal] = useState<EstadoTrabajo>('creado');

  const [fechaRecibido, setFechaRecibido] = useState<Date>(new Date());
  const [fechaEntrega, setFechaEntrega] = useState<Date | null>(null);
  const [pickerField, setPickerField] = useState<PickerField>(null);

  const [clientes, setClientes] = useState<ComboOption[]>([]);
  const [clientesTelefonoById, setClientesTelefonoById] = useState<Record<number, string>>({});
  const [tiposTrabajo, setTiposTrabajo] = useState<ComboOption[]>([]);
  const [tipoTrabajoColorById, setTipoTrabajoColorById] = useState<Record<number, string>>({});
  const [especialidades, setEspecialidades] = useState<ComboOption[]>([]);
  const [instituciones, setInstituciones] = useState<ComboOption[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!Number.isFinite(trabajoId)) {
      setLoadingData(false);
      setMessage('ID de trabajo invalido.');
      return;
    }

    setLoadingData(true);
    setMessage(null);

    let hasCachedDetalle = false;
    try {
      const cachedDetalle = await getCachedTrabajoDetalleById(trabajoId);
      if (cachedDetalle) {
        hasCachedDetalle = true;
        setNombreTrabajo(cachedDetalle.nombreTrabajo);
        setTipoTrabajoId(cachedDetalle.tipoTrabajoId);
        setClienteId(cachedDetalle.clienteId);
        setEspecialidadId(cachedDetalle.especialidadId);
        setInstitucionId(cachedDetalle.institucionId);
        setFechaRecibido(parseDateFromISO(cachedDetalle.fechaRecibido));
        setFechaEntrega(
          cachedDetalle.fechaEntrega ? parseDateFromISO(cachedDetalle.fechaEntrega) : null
        );
        const parsedCachedEstado = parseEstado(cachedDetalle.estado);
        setEstado(parsedCachedEstado);
        setEstadoOriginal(parsedCachedEstado);
        setLoadingData(false);
        setMessage('Mostrando detalle local. Sincronizando...');
      }
    } catch (cacheError) {
      console.warn('No se pudo leer cache local del detalle de trabajo.', cacheError);
    }

    let hasCachedCatalogs = false;
    try {
      const [cachedClientes, cachedTiposTrabajo, cachedEspecialidades, cachedInstituciones] =
        await Promise.all([
          getCachedClientesConTelefono(),
          getCachedCatalogo('tipo_trabajo'),
          getCachedCatalogo('especialidad'),
          getCachedCatalogo('institucion'),
        ]);

      const clientesFromCache = mapRowsToOptions(cachedClientes);
      const tiposFromCache = mapRowsToOptions(cachedTiposTrabajo);
      const especialidadesFromCache = mapRowsToOptions(cachedEspecialidades);
      const institucionesFromCache = mapRowsToOptions(cachedInstituciones);

      hasCachedCatalogs =
        clientesFromCache.length > 0 ||
        tiposFromCache.length > 0 ||
        especialidadesFromCache.length > 0 ||
        institucionesFromCache.length > 0;

      if (hasCachedCatalogs) {
        setClientes(clientesFromCache);
        setClientesTelefonoById(buildClientesTelefonoMap(cachedClientes));
        setTiposTrabajo(tiposFromCache);
        setEspecialidades(especialidadesFromCache);
        setInstituciones(institucionesFromCache);
      }
    } catch (cacheError) {
      console.warn('No se pudo leer cache local de catalogos en edicion.', cacheError);
    }

    const [clientesRes, tiposRes, especialidadRes, institucionRes, trabajoRes] = await Promise.all([
      supabase.from('clientes').select('id,nombre,telefono,created_at').order('nombre', { ascending: true }),
      supabase
        .from('tipo_trabajo')
        .select('id,nombre,color,created_at')
        .order('nombre', { ascending: true }),
      supabase.from('especialidad').select('id,nombre,created_at').order('nombre', { ascending: true }),
      supabase.from('institucion').select('id,nombre,created_at').order('nombre', { ascending: true }),
      supabase
        .from('trabajos')
        .select(
          'id,nombre_trabajo,tipo_trabajo_id,cliente_id,especialidad_id,institucion_id,fecha_recibido,fecha_entrega,estado,created_at,estado_creado_at,estado_en_proceso_at,estado_terminado_at,estado_entregado_at'
        )
        .eq('id', trabajoId)
        .maybeSingle(),
    ]);

    if (trabajoRes.error) {
      if (hasCachedDetalle) {
        setLoadingData(false);
        setMessage('No se pudo sincronizar detalle con Supabase. Usando cache local.');
        return;
      }
      setLoadingData(false);
      setMessage(`Error cargando datos: ${trabajoRes.error.message}`);
      return;
    }

    if (!trabajoRes.data) {
      if (hasCachedDetalle) {
        setLoadingData(false);
        setMessage('No se encontro el trabajo en Supabase. Mostrando cache local.');
        return;
      }
      setLoadingData(false);
      setMessage('No se encontro el trabajo.');
      return;
    }

    const firstCatalogError = clientesRes.error ?? tiposRes.error ?? especialidadRes.error ?? institucionRes.error;
    if (firstCatalogError && !hasCachedCatalogs) {
      setLoadingData(false);
      setMessage(`Error cargando catalogos: ${firstCatalogError.message}`);
      return;
    }

    if (!firstCatalogError) {
      const clientesRows = mapSupabaseClienteRows(clientesRes.data);
      const tiposRows = mapSupabaseCatalogRows(tiposRes.data);
      const especialidadRows = mapSupabaseCatalogRows(especialidadRes.data);
      const institucionRows = mapSupabaseCatalogRows(institucionRes.data);

      setClientes(mapRowsToOptions(clientesRows));
      setClientesTelefonoById(buildClientesTelefonoMap(clientesRows));
      setTiposTrabajo(mapRowsToOptions(tiposRows));
      setTipoTrabajoColorById(buildTipoTrabajoColorMap(tiposRes.data));
      setEspecialidades(mapRowsToOptions(especialidadRows));
      setInstituciones(mapRowsToOptions(institucionRows));

      try {
        await Promise.all([
          replaceCachedClientesConTelefono(clientesRows),
          replaceCachedCatalogo('tipo_trabajo', tiposRows),
          replaceCachedCatalogo('especialidad', especialidadRows),
          replaceCachedCatalogo('institucion', institucionRows),
        ]);
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de catalogos en edicion.', cacheError);
      }
    } else {
      setMessage('No se pudieron sincronizar catalogos. Usando cache local.');
    }

    setNombreTrabajo(String(trabajoRes.data.nombre_trabajo ?? ''));
    setTipoTrabajoId(Number(trabajoRes.data.tipo_trabajo_id ?? null));
    setClienteId(Number(trabajoRes.data.cliente_id ?? null));
    setEspecialidadId(Number(trabajoRes.data.especialidad_id ?? null));
    setInstitucionId(trabajoRes.data.institucion_id === null ? null : Number(trabajoRes.data.institucion_id));
    setFechaRecibido(parseDateFromISO(String(trabajoRes.data.fecha_recibido)));
    setFechaEntrega(
      trabajoRes.data.fecha_entrega ? parseDateFromISO(String(trabajoRes.data.fecha_entrega)) : null
    );
    const parsedEstado = parseEstado(trabajoRes.data.estado);
    setEstado(parsedEstado);
    setEstadoOriginal(parsedEstado);
    try {
      await upsertCachedTrabajoDetalle({
        id: Number(trabajoRes.data.id),
        nombreTrabajo: String(trabajoRes.data.nombre_trabajo ?? ''),
        tipoTrabajoId: Number(trabajoRes.data.tipo_trabajo_id ?? 0),
        clienteId: Number(trabajoRes.data.cliente_id ?? 0),
        especialidadId: Number(trabajoRes.data.especialidad_id ?? 0),
        institucionId:
          trabajoRes.data.institucion_id === null ? null : Number(trabajoRes.data.institucion_id),
        fechaRecibido: String(trabajoRes.data.fecha_recibido ?? formatDateISO(new Date())),
        fechaEntrega: trabajoRes.data.fecha_entrega ? String(trabajoRes.data.fecha_entrega) : null,
        estado: parsedEstado,
        estadoCreadoAt: trabajoRes.data.estado_creado_at
          ? String(trabajoRes.data.estado_creado_at)
          : trabajoRes.data.created_at
            ? String(trabajoRes.data.created_at)
            : null,
        estadoEnProcesoAt: trabajoRes.data.estado_en_proceso_at
          ? String(trabajoRes.data.estado_en_proceso_at)
          : null,
        estadoTerminadoAt: trabajoRes.data.estado_terminado_at
          ? String(trabajoRes.data.estado_terminado_at)
          : null,
        estadoEntregadoAt: trabajoRes.data.estado_entregado_at
          ? String(trabajoRes.data.estado_entregado_at)
          : null,
        updatedAt: new Date().toISOString(),
      });
    } catch (cacheError) {
      console.warn('No se pudo actualizar cache local del detalle de trabajo.', cacheError);
    }

    if (hasCachedDetalle && !firstCatalogError) {
      setMessage(null);
    }
    setLoadingData(false);
  }, [trabajoId]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch((error) => {
        setLoadingData(false);
        setMessage(`Error cargando datos: ${String(error)}`);
      });
    }, [loadData])
  );

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setPickerField(null);
      return;
    }
    if (!selectedDate || !pickerField) {
      return;
    }

    const normalized = normalizeDate(selectedDate);

    if (pickerField === 'recibido') {
      setFechaRecibido(normalized);
      if (fechaEntrega && normalizeDate(fechaEntrega) < normalized) {
        setFechaEntrega(normalized);
      }
    } else {
      setFechaEntrega(normalized);
    }

    if (Platform.OS !== 'ios') {
      setPickerField(null);
    }
  };

  const handleSubmit = async () => {
    const cleanNombre = nombreTrabajo.trim();
    const recibido = normalizeDate(fechaRecibido);
    const entrega = fechaEntrega ? normalizeDate(fechaEntrega) : null;

    if (!Number.isFinite(trabajoId)) {
      setMessage('ID de trabajo invalido.');
      return;
    }
    if (!cleanNombre) {
      setMessage('El nombre del trabajo es obligatorio.');
      return;
    }
    if (!tipoTrabajoId || !clienteId || !especialidadId) {
      setMessage('Completa tipo de trabajo, cliente y especialidad.');
      return;
    }
    if (entrega && entrega < recibido) {
      setMessage('La fecha de entrega no puede ser menor que la fecha de recibido.');
      return;
    }

    setLoadingSubmit(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('trabajos')
      .update({
        nombre_trabajo: cleanNombre,
        tipo_trabajo_id: tipoTrabajoId,
        cliente_id: clienteId,
        especialidad_id: especialidadId,
        institucion_id: institucionId,
        fecha_recibido: formatDateISO(recibido),
        fecha_entrega: entrega ? formatDateISO(entrega) : null,
        estado,
      })
      .eq('id', trabajoId)
      .select(
        'id,nombre_trabajo,tipo_trabajo_id,cliente_id,especialidad_id,institucion_id,fecha_recibido,fecha_entrega,estado,created_at,estado_creado_at,estado_en_proceso_at,estado_terminado_at,estado_entregado_at'
      )
      .maybeSingle();

    setLoadingSubmit(false);

    if (error || !data) {
      const reason = error?.message ?? 'No se pudo actualizar el trabajo (sin filas afectadas).';
      setMessage(`Error: ${reason}`);
      showToast('No se pudo actualizar el trabajo.', 'error');
      return;
    }

    try {
      await upsertCachedTrabajo({
        id: trabajoId,
        nombreTrabajo: cleanNombre,
        autor: getOptionLabel(clientes, clienteId, 'Sin autor'),
        especialidad: getOptionLabel(especialidades, especialidadId, 'Sin especialidad'),
        tipoTrabajo: getOptionLabel(tiposTrabajo, tipoTrabajoId, 'Sin tipo'),
        tipoTrabajoColor: tipoTrabajoId ? tipoTrabajoColorById[tipoTrabajoId] ?? null : null,
        fechaEntrega: entrega ? formatDateISO(entrega) : null,
        estadoCreadoAt: data.estado_creado_at
          ? String(data.estado_creado_at)
          : data.created_at
            ? String(data.created_at)
            : new Date().toISOString(),
        estadoEnProcesoAt: data.estado_en_proceso_at ? String(data.estado_en_proceso_at) : null,
        estadoTerminadoAt: data.estado_terminado_at ? String(data.estado_terminado_at) : null,
        estadoEntregadoAt: data.estado_entregado_at ? String(data.estado_entregado_at) : null,
        estado,
        updatedAt: new Date().toISOString(),
      });

      await upsertCachedTrabajoDetalle({
        id: Number(data.id),
        nombreTrabajo: String(data.nombre_trabajo ?? cleanNombre),
        tipoTrabajoId: Number(data.tipo_trabajo_id ?? tipoTrabajoId),
        clienteId: Number(data.cliente_id ?? clienteId),
        especialidadId: Number(data.especialidad_id ?? especialidadId),
        institucionId:
          data.institucion_id === null ? null : Number(data.institucion_id ?? institucionId),
        fechaRecibido: String(data.fecha_recibido ?? formatDateISO(recibido)),
        fechaEntrega: data.fecha_entrega ? String(data.fecha_entrega) : null,
        estado: parseEstado(data.estado),
        estadoCreadoAt: data.estado_creado_at
          ? String(data.estado_creado_at)
          : data.created_at
            ? String(data.created_at)
            : null,
        estadoEnProcesoAt: data.estado_en_proceso_at ? String(data.estado_en_proceso_at) : null,
        estadoTerminadoAt: data.estado_terminado_at ? String(data.estado_terminado_at) : null,
        estadoEntregadoAt: data.estado_entregado_at ? String(data.estado_entregado_at) : null,
        updatedAt: new Date().toISOString(),
      });
    } catch (cacheError) {
      console.warn('No se pudo actualizar cache local desde edicion.', cacheError);
    }

    if (estado === 'terminado' && estadoOriginal !== 'terminado') {
      const telefonoCliente = clienteId ? clientesTelefonoById[clienteId]?.trim() : '';
      if (!telefonoCliente) {
        showToast('Trabajo terminado, pero el cliente no tiene telefono para WhatsApp.', 'info');
      } else {
        const shouldSendWhatsApp = await confirmWhatsAppSend();
        if (shouldSendWhatsApp) {
          try {
            await openWhatsAppChat(
              telefonoCliente,
              buildTrabajoTerminadoWhatsAppMessage(cleanNombre)
            );
            showToast('Mensaje de WhatsApp abierto.', 'success');
          } catch (whatsAppError) {
            showToast(`No se pudo abrir WhatsApp: ${String(whatsAppError)}`, 'error');
          }
        }
      }
    }

    if (estado === 'entregado') {
      showToast('Trabajo marcado como entregado.', 'success');
      router.replace('/(app)/(tabs)/trabajos-entregados');
      return;
    }

    showToast('Trabajo actualizado correctamente.', 'success');
    router.replace('/(app)/(tabs)/trabajos');
  };

  const handleDelete = async () => {
    if (!Number.isFinite(trabajoId)) {
      setMessage('ID de trabajo invalido.');
      return;
    }

    const shouldDelete = await confirmDeleteTrabajo();
    if (!shouldDelete) {
      return;
    }

    setLoadingDelete(true);
    setMessage(null);

    const { error } = await supabase.from('trabajos').delete().eq('id', trabajoId);

    setLoadingDelete(false);

    if (error) {
      setMessage(`Error eliminando trabajo: ${error.message}`);
      showToast('No se pudo eliminar el trabajo.', 'error');
      return;
    }

    try {
      await deleteCachedTrabajoById(trabajoId);
      await deleteCachedTrabajoDetalleById(trabajoId);
    } catch (cacheError) {
      console.warn('No se pudo eliminar el trabajo del cache local.', cacheError);
    }

    showToast('Trabajo eliminado correctamente.', 'success');
    router.replace('/(app)/(tabs)/trabajos');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Editar trabajo</Text>
        <Text style={styles.help}>Actualiza los detalles y guarda los cambios.</Text>

        {loadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.buttonBg} />
            <Text style={styles.loadingText}>Cargando datos del trabajo...</Text>
          </View>
        ) : (
          <>
            <TextInput
              placeholder="Nombre del trabajo"
              placeholderTextColor={colors.inputPlaceholder}
              style={styles.input}
              value={nombreTrabajo}
              onChangeText={setNombreTrabajo}
            />

            <ComboBox
              label="Tipo de trabajo"
              placeholder="Selecciona un tipo"
              options={tiposTrabajo}
              value={tipoTrabajoId}
              onChange={setTipoTrabajoId}
              colors={colors}
            />
            <ComboBox
              label="Cliente"
              placeholder="Selecciona un cliente"
              options={clientes}
              value={clienteId}
              onChange={setClienteId}
              colors={colors}
            />
            <ComboBox
              label="Especialidad"
              placeholder="Selecciona una especialidad"
              options={especialidades}
              value={especialidadId}
              onChange={setEspecialidadId}
              colors={colors}
            />
            <ComboBox
              label="Institucion (opcional)"
              placeholder="Selecciona una institucion"
              options={instituciones}
              value={institucionId}
              onChange={setInstitucionId}
              colors={colors}
            />
            <Pressable onPress={() => setInstitucionId(null)} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Quitar institucion</Text>
            </Pressable>

            <View style={styles.estadoBlock}>
              <Text style={styles.label}>Estado</Text>
              <View style={styles.estadoRow}>
                <EstadoOption
                  label="Creado"
                  value="creado"
                  selected={estado === 'creado'}
                  onPress={() => setEstado('creado')}
                  colors={colors}
                />
                <EstadoOption
                  label="En proceso"
                  value="en_proceso"
                  selected={estado === 'en_proceso'}
                  onPress={() => setEstado('en_proceso')}
                  colors={colors}
                />
                <EstadoOption
                  label="Terminado"
                  value="terminado"
                  selected={estado === 'terminado'}
                  onPress={() => setEstado('terminado')}
                  colors={colors}
                />
                <EstadoOption
                  label="Entregado"
                  value="entregado"
                  selected={estado === 'entregado'}
                  onPress={() => setEstado('entregado')}
                  colors={colors}
                />
              </View>
            </View>

            <View style={styles.dateBlock}>
              <Text style={styles.label}>Fecha de recibido</Text>
              <Pressable onPress={() => setPickerField('recibido')} style={styles.dateButton}>
                <Text style={styles.dateButtonText}>{formatDateDisplay(fechaRecibido)}</Text>
              </Pressable>
            </View>

            <View style={styles.dateBlock}>
              <Text style={styles.label}>Fecha de entrega (opcional)</Text>
              <Pressable onPress={() => setPickerField('entrega')} style={styles.dateButton}>
                <Text style={styles.dateButtonText}>
                  {fechaEntrega ? formatDateDisplay(fechaEntrega) : 'Seleccionar fecha'}
                </Text>
              </Pressable>
            </View>

            {pickerField ? (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={pickerField === 'recibido' ? fechaRecibido : fechaEntrega ?? fechaRecibido}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable onPress={() => setPickerField(null)} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>Listo</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Pressable
              disabled={loadingSubmit || loadingDelete}
              onPress={handleSubmit}
              style={styles.button}>
              {loadingSubmit ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.buttonText}>Guardar cambios</Text>
              )}
            </Pressable>

            <Pressable
              disabled={loadingSubmit || loadingDelete}
              onPress={handleDelete}
              style={[styles.deleteButton, loadingDelete ? styles.deleteButtonDisabled : null]}>
              {loadingDelete ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>Eliminar trabajo</Text>
              )}
            </Pressable>
          </>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}

function buildTipoTrabajoColorMap(rows: unknown): Record<number, string> {
  if (!Array.isArray(rows)) {
    return {};
  }

  return rows.reduce<Record<number, string>>((acc, row) => {
    const typedRow = row as { id?: number | string; color?: string | null };
    const id = Number(typedRow.id);
    if (!Number.isFinite(id)) {
      return acc;
    }

    const color = normalizeHexColor(typedRow.color);
    if (color) {
      acc[id] = color;
    }
    return acc;
  }, {});
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

type EstadoOptionProps = {
  label: string;
  value: EstadoTrabajo;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
};

function EstadoOption({ label, selected, onPress, colors }: EstadoOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesEstado.option,
        {
          backgroundColor: selected ? colors.buttonBg : colors.inputBg,
          borderColor: selected ? colors.buttonBg : colors.border,
        },
      ]}>
      <Text style={{ color: selected ? colors.buttonText : colors.inputText, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const stylesEstado = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});

function mapRowsToOptions(rows: unknown): ComboOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => {
      const typedRow = row as { id?: number | string; nombre?: string };
      return {
        id: Number(typedRow.id),
        label: String(typedRow.nombre ?? ''),
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.label.length > 0);
}

function buildClientesTelefonoMap(rows: unknown): Record<number, string> {
  if (!Array.isArray(rows)) {
    return {};
  }

  return rows.reduce<Record<number, string>>((acc, row) => {
    const typedRow = row as { id?: number | string; telefono?: string | null };
    const id = Number(typedRow.id);
    const telefono = typedRow.telefono ? String(typedRow.telefono).trim() : '';

    if (Number.isFinite(id) && telefono) {
      acc[id] = telefono;
    }
    return acc;
  }, {});
}

function getOptionLabel(options: ComboOption[], optionId: number | null, fallback: string) {
  if (!optionId) {
    return fallback;
  }
  return options.find((option) => option.id === optionId)?.label ?? fallback;
}

function parseEstado(rawValue: unknown): EstadoTrabajo {
  if (rawValue === 'entregado') {
    return 'entregado';
  }
  if (rawValue === 'en_proceso') {
    return 'en_proceso';
  }
  if (rawValue === 'terminado') {
    return 'terminado';
  }
  return 'creado';
}

function parseDateFromISO(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number(value));
  if (!year || !month || !day) {
    return new Date();
  }
  return new Date(year, month - 1, day);
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function confirmWhatsAppSend() {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const close = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    Alert.alert(
      'Enviar aviso al cliente',
      'Este trabajo cambio a "terminado". Deseas enviar un mensaje de WhatsApp ahora?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => close(false),
        },
        {
          text: 'Si, enviar',
          onPress: () => close(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => close(false),
      }
    );
  });
}

function confirmDeleteTrabajo() {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const close = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    Alert.alert(
      'Eliminar trabajo',
      'Esta accion no se puede deshacer. Deseas eliminar este trabajo?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => close(false),
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => close(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => close(false),
      }
    );
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 18,
      padding: 18,
      gap: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    help: {
      color: colors.textSecondary,
      marginBottom: 2,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    loadingText: {
      color: colors.inputText,
      fontSize: 14,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.inputText,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    clearButtonText: {
      color: colors.inputText,
      fontWeight: '600',
    },
    estadoBlock: {
      gap: 8,
    },
    estadoRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    dateBlock: {
      gap: 6,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    dateButton: {
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dateButtonText: {
      color: colors.inputText,
      fontSize: 16,
    },
    pickerContainer: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      padding: 8,
      gap: 8,
    },
    button: {
      marginTop: 4,
      borderRadius: 12,
      backgroundColor: colors.buttonBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
    deleteButton: {
      marginTop: 2,
      borderRadius: 12,
      backgroundColor: '#DC2626',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: '#B91C1C',
    },
    deleteButtonDisabled: {
      opacity: 0.75,
    },
    deleteButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    message: {
      color: colors.textPrimary,
      fontSize: 13,
    },
  });
}
