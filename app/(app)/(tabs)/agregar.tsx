import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

export default function AgregarTrabajoTabScreen() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      router.push("/(app)/nuevo-trabajo");
    }, [router]),
  );

  return <View />;
}
