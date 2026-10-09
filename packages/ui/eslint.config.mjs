import reactHooks from "eslint-plugin-react-hooks";
import base from "../config/eslint.base.mjs";

export default [
  ...base,
  { ignores: ["playground/dist/**"] },
  { files: ["**/*.{ts,tsx}"], ...reactHooks.configs.flat.recommended },
];
