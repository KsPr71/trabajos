import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useAppTheme } from "@/providers/theme-provider";

type QuestionSearchProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  inHeader?: boolean;
  expandedWidth?: number;
  collapsedSize?: number;
  iconSize?: number;
  onOpenChange?: (isOpen: boolean) => void;
};

export function QuestionSearch({
  value,
  onChangeText,
  placeholder = "Buscar...",
  inHeader = false,
  expandedWidth,
  collapsedSize = 48,
  iconSize = 20,
  onOpenChange,
}: QuestionSearchProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, inHeader, collapsedSize);
  const FAB_SIZE = Math.max(28, collapsedSize);
  const COLLAPSED_WIDTH = FAB_SIZE;

  const [open, setOpen] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [maxWidth, setMaxWidth] = useState(0);
  const widthAnim = useRef(new Animated.Value(COLLAPSED_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput | null>(null);

  const runAnimation = useCallback(
    (nextOpen: boolean) => {
      const targetWidth = Math.max(expandedWidth ?? maxWidth, COLLAPSED_WIDTH);

      Animated.parallel([
        Animated.timing(widthAnim, {
          toValue: nextOpen ? targetWidth : COLLAPSED_WIDTH,
          duration: nextOpen ? 260 : 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: nextOpen ? 1 : 0,
          duration: nextOpen ? 210 : 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }

        if (nextOpen) {
          inputRef.current?.focus();
          return;
        }

        setShowInput(false);
      });
    },
    [COLLAPSED_WIDTH, expandedWidth, maxWidth, opacityAnim, widthAnim],
  );

  const handleToggle = () => {
    if (open) {
      Keyboard.dismiss();
      onChangeText("");
      setOpen(false);
      onOpenChange?.(false);
      runAnimation(false);
      return;
    }

    setShowInput(true);
    setOpen(true);
    onOpenChange?.(true);
    runAnimation(true);
  };

  const handleHostLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.max(
      COLLAPSED_WIDTH,
      Math.floor(event.nativeEvent.layout.width),
    );
    setMaxWidth(nextWidth);

    if (!open) {
      widthAnim.setValue(COLLAPSED_WIDTH);
    }
  };

  return (
    <View style={styles.container} onLayout={handleHostLayout}>
      <Animated.View style={[styles.shell, { width: widthAnim }]}>
        <Pressable
          accessibilityLabel="Abrir busqueda"
          onPress={handleToggle}
          style={styles.trigger}
        >
          <Ionicons
            name="search-outline"
            size={Math.max(14, iconSize)}
            color="#FFFFFF"
          />
        </Pressable>

        {showInput ? (
          <Animated.View style={[styles.inputWrap, { opacity: opacityAnim }]}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#DCE8FF"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  inHeader: boolean,
  collapsedSize: number,
) {
  const size = Math.max(30, collapsedSize);

  return StyleSheet.create({
    container: {
      marginBottom: inHeader ? 0 : 10,
      alignItems: "flex-end",
    },
    shell: {
      height: size,
      borderRadius: 999,
      backgroundColor: colors.buttonBg,
      borderWidth: 0,
      borderColor: colors.buttonBg,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    trigger: {
      width: size,
      height: size,
      borderRadius: 999,
      backgroundColor: colors.buttonBg,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    inputWrap: {
      flex: 1,
      paddingRight: 10,
      paddingLeft: 8,
    },
    input: {
      backgroundColor: "transparent",
      color: "#FFFFFF",
      paddingVertical: 8,
      paddingHorizontal: 0,
      fontSize: 15,
    },
  });
}
