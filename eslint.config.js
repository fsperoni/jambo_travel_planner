import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

// One shared flat config for the whole monorepo. Type-aware lint rules are
// deliberately not enabled: `tsc --noEmit` (the `typecheck` script) already
// catches type errors in a separate, faster CI step, so turning on
// typescript-eslint's type-checked rules here would just duplicate that work
// while slowing every lint run down.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // apps/api runs under Node, no browser/DOM globals.
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: { globals: globals.node },
  },

  // apps/web runs in the browser; add React Hooks correctness rules and the
  // Vite "only export components from a component file" fast-refresh rule.
  // We pick specific rules rather than the plugin's full "recommended-latest"
  // preset because that preset also bundles a set of experimental
  // React-Compiler-oriented rules (e.g. "purity", "immutability") that don't
  // apply here since the project doesn't use the React Compiler.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Config files (this one included) execute directly under Node via the CLI.
  {
    files: ["**/*.config.{js,ts}", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },

  // Must be last: turns off stylistic ESLint rules that would otherwise
  // conflict with Prettier, which owns all formatting decisions.
  eslintConfigPrettier,
);
