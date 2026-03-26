import Logo from "@/components/ui/Logo";
import { Colors } from "@/constants/theme";
import {
  Image,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const Developer = () => {
  return (
    <TouchableOpacity
      onPress={() =>
        Linking.openURL("https://landing-page-ten-pi-77.vercel.app")
      }
    >
      <View
        style={[
          styles.company,
          {
            backgroundColor: Colors.light.background,
            borderColor: Colors.light.tint,
          },
        ]}
      >
        <Logo size={50} style={styles.headerLogo} />
        <Image
          source={require("@/assets/images/novadev1.png")}
          style={styles.novaDevImage}
          resizeMode="cover"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  company: {
    display: "flex",
    flexDirection: "row",
    marginTop: 20,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 5,
    marginBottom: 16,
    alignItems: "center",
    alignSelf: "center",
  },
  novaDevImage: {
    width: "50%",
    height: 30,
  },
  headerLogo: {
    marginRight: 8,
    borderRadius: 10,
    marginLeft: 20,
  },
});

export default Developer;
