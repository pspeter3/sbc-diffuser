import preact from "@preact/preset-vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [preact()],
  base: "/sbc-diffuser/",
  css: {
    preprocessorOptions: {
      scss: { quietDeps: true },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: { sortImports: true },
  lint: {
    plugins: ["import", "jsx-a11y", "react", "typescript", "unicorn"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-inline"],
      "typescript/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "typescript/consistent-type-exports": "error",
      "typescript/explicit-function-return-type": "error",
      "typescript/explicit-module-boundary-types": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unsafe-type-assertion": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-floating-promises": ["error", { ignoreVoid: false, checkThenables: true }],
      "typescript/no-misused-promises": "error",
      "typescript/strict-boolean-expressions": [
        "error",
        { allowNullableObject: false, allowNumber: false, allowString: false },
      ],
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "unicorn/prefer-add-event-listener": "error",
    },
    overrides: [
      {
        files: ["src/**/*.{ts,tsx}"],
        rules: { "import/no-default-export": "error" },
      },
      {
        files: ["src/main.tsx"],
        rules: { "typescript/no-non-null-assertion": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
        perFile: true,
      },
    },
  },
});
