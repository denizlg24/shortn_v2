import { pixelBasedPreset, TailwindConfig } from "@react-email/components";

export const tailwindConfig: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: "#020618",
      },
    },
  },
};
