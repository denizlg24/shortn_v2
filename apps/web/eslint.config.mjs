import reactHooks from "eslint-plugin-react-hooks";
import base from "../../packages/config/eslint.base.mjs";

export default [
  ...base,
  { ignores: [".next/**", "next-env.d.ts"] },
  { files: ["**/*.{ts,tsx}"], ...reactHooks.configs.flat.recommended },
];
