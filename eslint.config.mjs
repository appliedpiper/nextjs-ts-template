// eslint-config-next 16 ships native flat configs, so these are spread directly.
// The previous `FlatCompat` bridge crashed on load: it tried to serialize a flat
// config containing circular plugin references as legacy eslintrc format.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
