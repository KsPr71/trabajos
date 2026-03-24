import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemeColors } from '@/providers/theme-provider';

export type ComboOption = {
  id: number;
  label: string;
};

type ComboBoxProps = {
  label: string;
  placeholder: string;
  options: ComboOption[];
  value: number | null;
  onChange: (value: number) => void;
  colors: ThemeColors;
  disabled?: boolean;
};

export function ComboBox({
  label,
  placeholder,
  options,
  value,
  onChange,
  colors,
  disabled = false,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const styles = createStyles(colors);

  const selectedLabel = options.find((option) => option.id === value)?.label;
  const filteredOptions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(cleanQuery));
  }, [options, query]);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, disabled && styles.triggerDisabled]}>
        <Text style={[styles.triggerText, !selectedLabel && styles.placeholderText]}>
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar..."
              placeholderTextColor={colors.inputPlaceholder}
              style={styles.searchInput}
            />
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={styles.option}>
                  <Text style={styles.optionText}>{item.label}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Sin resultados</Text>}
            />
            <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    block: {
      gap: 6,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    trigger: {
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    triggerDisabled: {
      opacity: 0.6,
    },
    triggerText: {
      color: colors.inputText,
      fontSize: 16,
    },
    placeholderText: {
      color: colors.inputPlaceholder,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 14,
      maxHeight: '80%',
      gap: 10,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
    },
    searchInput: {
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.inputText,
      fontSize: 16,
    },
    list: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    option: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: {
      color: colors.inputText,
      fontSize: 15,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 14,
    },
    closeButton: {
      alignSelf: 'flex-end',
      backgroundColor: colors.buttonBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    closeButtonText: {
      color: colors.buttonText,
      fontWeight: '700',
    },
  });
}
