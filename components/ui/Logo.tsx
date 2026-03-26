import { Image, ImageStyle, StyleProp } from "react-native";

const imagen = require("@/assets/images/icon.png");

type LogoProps = {
  size?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
};

export default function Logo({ size = 24, width, height, style }: LogoProps) {
  return (
    <Image
      source={imagen}
      resizeMode="contain"
      style={[
        {
          width: width ?? size,
          height: height ?? size,
        },
        style,
      ]}
    />
  );
}
