import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
  mapSupabaseClienteRows,
  mapSupabaseCatalogRows,
  replaceCachedClientesConTelefono,
  replaceCachedCatalogo,
} from '@/lib/catalogos-cache';
import { upsertCachedTrabajoDetalle } from '@/lib/trabajos-cache';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme-provider';

type PickerField = 'recibido' | 'entrega' | null;
type TipoDocumentoItem = { id: number; nombre: string };

export default function NuevoTrabajoScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [nombreTrabajo, setNombreTrabajo] = useState('');
  const [tipoTrabajoId, setTipoTrabajoId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [especialidadId, setEspecialidadId] = useState<number | null>(null);
  const [institucionId, setInstitucionId] = useState<number | null>(null);
  const [enlaceDescargaMega, setEnlaceDescargaMega] = useState('');

  const [fechaRecibido, setFechaRecibido] = useState<Date>(new Date());
  const [fechaEntrega, setFechaEntrega] = useState<Date | null>(null);
  const [pickerField, setPickerField] = useState<PickerField>(null);

  const [clientes, setClientes] = useState<ComboOption[]>([]);
  const [tiposTrabajo, setTiposTrabajo] = useState<ComboOption[]>([]);
  const [especialidades, setEspecialidades] = useState<ComboOption[]>([]);
  const [instituciones, setInstituciones] = useState<ComboOption[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoItem[]>([]);
  const [selectedTipoDocumentoIds, setSelectedTipoDocumentoIds] = useState<number[]>([]);

  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCatalogs = useCallback(async () => {
    setLoadingCatalogs(true);
    setMessage(null);

    let hasCachedCatalogs = false;
    try {
      const [cachedClientes, cachedTiposTrabajo, cachedEspecialidades, cachedInstituciones, cachedTiposDocumento] =
        await Promise.all([
          getCachedCatalogo('clientes'),
          getCachedCatalogo('tipo_trabajo'),
          getCachedCatalogo('especialidad'),
          getCachedCatalogo('institucion'),
          getCachedCatalogo('tipo_documento'),
        ]);

      const clientesFromCache = mapRowsToOptions(cachedClientes);
      const tiposFromCache = mapRowsToOptions(cachedTiposTrabajo);
      const especialidadesFromCache = mapRowsToOptions(cachedEspecialidades);
      const institucionesFromCache = mapRowsToOptions(cachedInstituciones);
      const tiposDocumentoFromCache = mapRowsToSimpleItems(cachedTiposDocumento);

      hasCachedCatalogs =
        clientesFromCache.length > 0 ||
        tiposFromCache.length > 0 ||
        especialidadesFromCache.length > 0 ||
        institucionesFromCache.length > 0 ||
        tiposDocumentoFromCache.length > 0;

      if (hasCachedCatalogs) {
        setClientes(clientesFromCache);
        setTiposTrabajo(tiposFromCache);
        setEspecialidades(especialidadesFromCache);
        setInstituciones(institucionesFromCache);
        setTiposDocumento(tiposDocumentoFromCache);
        setLoadingCatalogs(false);
      }
    } catch (cacheError) {
      console.warn('No se pudo leer cache local de catalogos.', cacheError);
    }

    const [clientesRes, tiposRes, especialidadRes, institucionRes, tipoDocumentoRes] = await Promise.all([
      supabase.from('clientes').select('id,nombre,telefono,created_at').order('nombre', { ascending: true }),
      supabase.from('tipo_trabajo').select('id,nombre,created_at').order('nombre', { ascending: true }),
      supabase.from('especialidad').select('id,nombre,created_at').order('nombre', { ascending: true }),
      supabase.from('institucion').select('id,nombre,created_at').order('nombre', { ascending: true }),
      supabase.from('tipo_documento').select('id,nombre,created_at').order('nombre', { ascending: true }),
    ]);

    if (clientesRes.error || tiposRes.error || especialidadRes.error || institucionRes.error || tipoDocumentoRes.error) {
      const firstError =
        clientesRes.error ?? tiposRes.error ?? especialidadRes.error ?? institucionRes.error ?? tipoDocumentoRes.error;
      if (hasCachedCatalogs) {
        setMessage('Mostrando catalogos locales. No se pudo sincronizar con Supabase.');
      } else {
        setMessage(`Error cargando catalogos: ${firstError?.message ?? 'error desconocido'}`);
      }
      setLoadingCatalogs(false);
      return;
    }

    const clientesRows = mapSupabaseClienteRows(clientesRes.data);
    const tiposRows = mapSupabaseCatalogRows(tiposRes.data);
    const especialidadRows = mapSupabaseCatalogRows(especialidadRes.data);
    const institucionRows = mapSupabaseCatalogRows(institucionRes.data);
    const tipoDocumentoRows = mapSupabaseCatalogRows(tipoDocumentoRes.data);

    setClientes(mapRowsToOptions(clientesRows));
    setTiposTrabajo(mapRowsToOptions(tiposRows));
    setEspecialidades(mapRowsToOptions(especialidadRows));
    setInstituciones(mapRowsToOptions(institucionRows));
    setTiposDocumento(mapRowsToSimpleItems(tipoDocumentoRows));
    setLoadingCatalogs(false);

    try {
      await Promise.all([
        replaceCachedClientesConTelefono(clientesRows),
        replaceCachedCatalogo('tipo_trabajo', tiposRows),
        replaceCachedCatalogo('especialidad', especialidadRows),
        replaceCachedCatalogo('institucion', institucionRows),
        replaceCachedCatalogo('tipo_documento', tipoDocumentoRows),
      ]);
    } catch (cacheError) {
      console.warn('No se pudo actualizar cache local de catalogos.', cacheError);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCatalogs().catch((error) => {
        setLoadingCatalogs(false);
        setMessage(`Error cargando catalogos: ${String(error)}`);
      });
    }, [loadCatalogs])
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

  const toggleTipoDocumento = (tipoDocumentoId: number) => {
    setSelectedTipoDocumentoIds((prev) =>
      prev.includes(tipoDocumentoId)
        ? prev.filter((id) => id !== tipoDocumentoId)
        : [...prev, tipoDocumentoId]
    );
  };

  const handleSubmit = async () => {
    const cleanNombre = nombreTrabajo.trim();
    const cleanEnlaceDescargaMega = normalizeMegaLink(enlaceDescargaMega);
    const recibido = normalizeDate(fechaRecibido);
    const entrega = fechaEntrega ? normalizeDate(fechaEntrega) : null;

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
      .insert({
        nombre_trabajo: cleanNombre,
        tipo_trabajo_id: tipoTrabajoId,
        cliente_id: clienteId,
        especialidad_id: especialidadId,
        institucion_id: institucionId,
        enlace_descarga_mega: cleanEnlaceDescargaMega,
        pagado: false,
        fecha_recibido: formatDateISO(recibido),
        fecha_entrega: entrega ? formatDateISO(entrega) : null,
        estado: 'creado',
      })
      .select(
        'id,nombre_trabajo,tipo_trabajo_id,cliente_id,especialidad_id,institucion_id,enlace_descarga_mega,pagado,fecha_recibido,fecha_entrega,estado,created_at,estado_creado_at,estado_en_proceso_at,estado_terminado_at,estado_entregado_at'
      )
      .maybeSingle();

    setLoadingSubmit(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    if (data) {
      const trabajoCreadoId = Number(data.id);
      let documentosCreados = selectedTipoDocumentoIds.map((tipoDocumentoId, index) => ({
        id: -1 - index,
        nombreDocumento:
          tiposDocumento.find((item) => item.id === tipoDocumentoId)?.nombre ?? `Documento ${tipoDocumentoId}`,
        descripcion: null,
        fechaRecepcion: formatDateISO(new Date()),
        tipoDocumentoId,
      }));

      if (selectedTipoDocumentoIds.length > 0 && Number.isFinite(trabajoCreadoId)) {
        const documentosPayload = selectedTipoDocumentoIds.map((tipoDocumentoId) => ({
          trabajo_id: trabajoCreadoId,
          tipo_documento_id: tipoDocumentoId,
          nombre_documento:
            tiposDocumento.find((item) => item.id === tipoDocumentoId)?.nombre ?? `Documento ${tipoDocumentoId}`,
          descripcion: null,
          fecha_recepcion: formatDateISO(new Date()),
        }));

        const { data: documentosData, error: documentosError } = await supabase
          .from('documentos_recibidos')
          .insert(documentosPayload)
          .select('id,nombre_documento,descripcion,fecha_recepcion,tipo_documento_id');

        if (documentosError) {
          setMessage(`Trabajo creado, pero no se pudieron guardar documentos: ${documentosError.message}`);
        } else {
          documentosCreados = mapDocumentosRecibidosRows(documentosData);
        }
      }

      try {
        await upsertCachedTrabajoDetalle({
          id: trabajoCreadoId,
          nombreTrabajo: String(data.nombre_trabajo ?? cleanNombre),
          tipoTrabajoId: Number(data.tipo_trabajo_id ?? tipoTrabajoId),
          clienteId: Number(data.cliente_id ?? clienteId),
          especialidadId: Number(data.especialidad_id ?? especialidadId),
          institucionId: data.institucion_id === null ? null : Number(data.institucion_id),
          enlaceDescargaMega: data.enlace_descarga_mega
            ? String(data.enlace_descarga_mega)
            : null,
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
          pagado: data.pagado === true || Number(data.pagado) === 1,
          documentosRecibidos: documentosCreados,
          updatedAt: new Date().toISOString(),
        });
      } catch (cacheError) {
        console.warn('No se pudo actualizar cache local de detalle al crear trabajo.', cacheError);
      }
    }

    setNombreTrabajo('');
    setTipoTrabajoId(null);
    setClienteId(null);
    setEspecialidadId(null);
    setInstitucionId(null);
    setEnlaceDescargaMega('');
    setSelectedTipoDocumentoIds([]);
    setFechaRecibido(new Date());
    setFechaEntrega(null);
    setMessage('Trabajo creado correctamente.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Nuevo trabajo</Text>
        <Text style={styles.help}>Completa los datos para poblar la tabla trabajos.</Text>

        <TextInput
          placeholder="Nombre del trabajo"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={nombreTrabajo}
          onChangeText={setNombreTrabajo}
        />
        <TextInput
          placeholder="Enlace de descarga MEGA (opcional)"
          placeholderTextColor={colors.inputPlaceholder}
          style={styles.input}
          value={enlaceDescargaMega}
          onChangeText={setEnlaceDescargaMega}
          autoCapitalize='none'
          autoCorrect={false}
        />

        {loadingCatalogs ? (
          <View style={styles.loadingCatalogs}>
            <ActivityIndicator color={colors.buttonBg} />
            <Text style={styles.loadingText}>Cargando catalogos...</Text>
          </View>
        ) : (
          <>
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

            <View style={styles.documentosBlock}>
              <Text style={styles.label}>Documentos recibidos</Text>
              {tiposDocumento.length === 0 ? (
                <Text style={styles.documentosHelpText}>
                  No hay tipos de documento registrados.
                </Text>
              ) : (
                <View style={styles.documentosChipsWrap}>
                  {tiposDocumento.map((tipoDocumento) => {
                    const selected = selectedTipoDocumentoIds.includes(tipoDocumento.id);
                    return (
                      <Pressable
                        key={tipoDocumento.id}
                        onPress={() => toggleTipoDocumento(tipoDocumento.id)}
                        style={[
                          styles.documentoChip,
                          selected ? styles.documentoChipSelected : null,
                        ]}
                      >
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={14}
                          color={selected ? colors.buttonText : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.documentoChipText,
                            selected ? styles.documentoChipTextSelected : null,
                          ]}
                        >
                          {tipoDocumento.nombre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

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

        <Pressable disabled={loadingSubmit} onPress={handleSubmit} style={styles.button}>
          {loadingSubmit ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>Guardar trabajo</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}

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

function mapRowsToSimpleItems(rows: unknown): TipoDocumentoItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const typedRow = row as { id?: number | string; nombre?: string };
      return {
        id: Number(typedRow.id),
        nombre: String(typedRow.nombre ?? ''),
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);
}

function mapDocumentosRecibidosRows(rows: unknown) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row, index) => {
      const typedRow = row as {
        id?: number | string;
        nombre_documento?: string;
        descripcion?: string | null;
        fecha_recepcion?: string | null;
        tipo_documento_id?: number | string | null;
      };

      const id = Number(typedRow.id ?? -1 - index);
      const nombreDocumento = String(typedRow.nombre_documento ?? '').trim();
      const fechaRecepcionRaw = typedRow.fecha_recepcion ? String(typedRow.fecha_recepcion) : '';
      const fechaRecepcion = /^\d{4}-\d{2}-\d{2}$/.test(fechaRecepcionRaw)
        ? fechaRecepcionRaw
        : formatDateISO(new Date());

      return {
        id,
        nombreDocumento,
        descripcion:
          typeof typedRow.descripcion === 'string' && typedRow.descripcion.trim().length > 0
            ? typedRow.descripcion.trim()
            : null,
        fechaRecepcion,
        tipoDocumentoId:
          typedRow.tipo_documento_id === null || typedRow.tipo_documento_id === undefined
            ? null
            : Number(typedRow.tipo_documento_id),
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombreDocumento.length > 0);
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

function normalizeMegaLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function parseEstado(rawValue: unknown): 'creado' | 'en_proceso' | 'terminado' | 'entregado' {
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

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 220,
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
    loadingCatalogs: {
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
    documentosBlock: {
      gap: 8,
    },
    documentosHelpText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    documentosChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    documentoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    documentoChipSelected: {
      borderColor: colors.buttonBg,
      backgroundColor: colors.buttonBg,
    },
    documentoChipText: {
      color: colors.inputText,
      fontSize: 12,
      fontWeight: '700',
    },
    documentoChipTextSelected: {
      color: colors.buttonText,
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
    message: {
      color: colors.textPrimary,
      fontSize: 13,
    },
  });
}
