import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.output/**", "**/cdk.out/**", "**/dist/**", "**/.wxt/**", "docs/**", "**/next-env.d.ts"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Only packages/db touches MongoDB.
      "no-restricted-imports": ["error", { paths: [{ name: "mongodb", message: "Only packages/db touches MongoDB." }] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  { files: ["packages/db/**"], rules: { "no-restricted-imports": "off" } },
);
