import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["packages/lang/**/*.ts", "packages/layout/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "@flow/lang and @flow/layout must run in bare Node." },
        { name: "document", message: "@flow/lang and @flow/layout must run in bare Node." },
        { name: "localStorage", message: "@flow/lang and @flow/layout must run in bare Node." },
        { name: "navigator", message: "@flow/lang and @flow/layout must run in bare Node." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-*", "next", "next/*", "@xyflow/*"],
              message: "@flow/lang and @flow/layout must stay framework-free." },
          ],
        },
      ],
    },
  },
);
