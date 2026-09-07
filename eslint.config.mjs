import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config, imported directly - `FlatCompat` does not work with the
 * eslint-config-next shipped with Next 16.
 */
const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "db/migrations/**"],
  },
  {
    rules: {
      // Restoring a draft after mount is a deliberate pattern in the wizard.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
