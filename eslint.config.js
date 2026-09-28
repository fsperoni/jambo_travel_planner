import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

// One shared flat config for the whole monorepo. Type-aware lint rules
// (typescript-eslint's "type-checked" presets) are deliberately not
// enabled — not because they'd only duplicate what `tsc --noEmit` already
// catches (they wouldn't: rules like `no-floating-promises` flag real
// problems `tsc` itself accepts, e.g. an unawaited async call whose
// rejection would otherwise go unhandled), but for scope and speed at this
// project's size: they need a full type-checking pass to run at all,
// which meaningfully slows down every lint run, and this project already
// runs `tsc --noEmit` as its own separate, faster step. A rule like
// `no-floating-promises` would be worth adding selectively if a real case
// of it showed up.
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

  // Express identifies an error-handling middleware by its parameter count
  // (err, req, res, next) alone, and a Request's "unused" params are
  // routinely needed just to match a handler signature (e.g. a 404 handler
  // that only uses `req`). An underscore prefix is the conventional way to
  // mark a required-but-unused parameter as intentional.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // apps/api runs under Node, no browser/DOM globals.
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: { globals: globals.node },
  },

  // e2e/ (Playwright + its stub servers/global setup) also runs under Node.
  {
    files: ["e2e/**/*.ts"],
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
