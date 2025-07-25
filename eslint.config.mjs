import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        {
          error: {
            name: "next/link",
            message: "Please import @/i18n/navigation",
          },
        },
      ],
    },
  },
];

export default eslintConfig;
