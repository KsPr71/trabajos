import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
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

  const [fechaRecibido, setFechaRecibido] = useState<Date>(new Date());
  const [fechaEntrega, setFechaEntrega] = useState<Date | null>(null);
  const [pickerField, setPickerField] = useState<PickerField>(null);

  const [clientes, setClientes] = useState<ComboOption[]>([]);
  const [tiposTrabajo, setTiposTrabajo] = useState<ComboOption[]>([]);
  const [especialidades, setEspecialidades] = useState<ComboOption[]>([]);
  const [instituciones, setInstituciones] = useState<ComboOption[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!Number.isFinite(trabajoId)) {
        setLoadingData(false);
        setMessage('ID de trabajo invalido.');
        return;
      }

      setLoadingData(true);
      setMessage(null);

      const [clientesRes, tiposRes, especialidadRes, institucionRes, trabajoRes] = await Promise.all(
        [
          supabase.from('clientes').select('id,nombre').order('nombre', { ascending: true }),
          supabase.from('tipo_trabajo').select('id,nombre').order('nombre', { ascending: true }),
          supabase.from('especialidad').select('id,nombre').order('nombre', { ascending: true }),
          supabase.from('institucion').select('id,nombre').order('nombre', { ascending: true }),
          supabase
            .from('trabajos')
            .select(
              'id,nombre_trabajo,tipo_trabajo_id,cliente_id,especialidad_id,institucion_id,fecha_recibido,fecha_entrega,estado'
            )
            .eq('id', trabajoId)
            .maybeSingle(),
        ]
      );

      const firstError =
        clientesRes.error ??
        tiposRes.error ??
        especialidadRes.error ??
        institucionRes.error ??
        trabajoRes.error;

      if (firstError) {
        setLoadingData(false);
        setMessage(`Error cargando datos: ${firstError.message}`);
        return;
      }

      if (!trabajoRes.data) {
        setLoadingData(false);
        setMessage('No se encontro el trabajo.');
        return;
      }

      setClientes(mapRowsToOptions(clientesRes.data));
      setTiposTrabajo(mapRowsToOptions(tiposRes.data));
      setEspecialidades(mapRowsToOptions(especialidadRes.data));
      setInstituciones(mapRowsToOptions(institucionRes.data));

      setNombreTrabajo(String(trabajoRes.data.nombre_trabajo ?? ''));
      setTipoTrabajoId(Number(trabajoRes.data.tipo_trabajo_id ?? null));
      setClienteId(Number(trabajoRes.data.cliente_id ?? null));
      setEspecialidadId(Number(trabajoRes.data.especialidad_id ?? null));
      setInstitucionId(
        trabajoRes.data.institucion_id === null ? null : Number(trabajoRes.data.institucion_id)
      );
      setFechaRecibido(parseDateFromISO(String(trabajoRes.data.fecha_recibido)));
      setFechaEntrega(
        trabajoRes.data.fecha_entrega ? parseDateFromISO(String(trabajoRes.data.fecha_entrega)) : null
      );
      setEstado(parseEstado(trabajoRes.data.estado));
      setLoadingData(false);
    };

    loadData().catch((error) => {
      setLoadingData(false);
      setMessage(`Error cargando datos: ${String(error)}`);
    });
  }, [trabajoId]);

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

    const { error } = await supabase
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
      .eq('id', trabajoId);

    setLoadingSubmit(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      showToast('No se pudo actualizar el trabajo.', 'error');
      return;
    }

    if (estado === 'entregado') {
      showToast('Trabajo marcado como entregado.', 'success');
      router.replace('/(app)/trabajos-entregados');
      return;
    }

    showToast('Trabajo actualizado correctamente.', 'success');
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

            <Pressable disabled={loadingSubmit} onPress={handleSubmit} style={styles.button}>
              {loadingSubmit ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.buttonText}>Guardar cambios</Text>
              )}
            </Pressable>
          </>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
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
    message: {
      color: colors.textPrimary,
      fontSize: 13,
    },
  });
}
