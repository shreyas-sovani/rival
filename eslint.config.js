import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const testFiles = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.stories.ts",
  "**/*.stories.tsx",
  "**/__fixtures__/**",
];

const fetchAllowed = [
  "packages/solver-sdk/**",
  "packages/arkiv/**",
  "packages/chain/**",
  "apps/runner/**",
  "apps/web/src/data/**",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "contracts/lib/**",
      "contracts/out/**",
      "contracts/cache/**",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.es2022,
        ...globals.node,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/__fixtures__",
                "**/__fixtures__/**",
                "**/*.test",
                "**/*.test.*",
                "**/*.spec",
                "**/*.spec.*",
                "**/*.stories",
                "**/*.stories.*",
              ],
              message:
                "Import fixtures, tests, and stories only from test code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: testFiles,
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    ignores: fetchAllowed,
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "fetch is only allowed in packages/solver-sdk, packages/arkiv, packages/chain, apps/runner, and apps/web/src/data.",
        },
        {
          name: "XMLHttpRequest",
          message:
            "XMLHttpRequest is only allowed in packages/solver-sdk, packages/arkiv, packages/chain, apps/runner, and apps/web/src/data.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "fetch",
          message: "fetch is restricted outside the data-access packages.",
        },
        {
          object: "globalThis",
          property: "fetch",
          message: "fetch is restricted outside the data-access packages.",
        },
        {
          object: "window",
          property: "XMLHttpRequest",
          message: "XMLHttpRequest is restricted outside the data-access packages.",
        },
        {
          object: "globalThis",
          property: "XMLHttpRequest",
          message: "XMLHttpRequest is restricted outside the data-access packages.",
        },
      ],
    },
  },
);
