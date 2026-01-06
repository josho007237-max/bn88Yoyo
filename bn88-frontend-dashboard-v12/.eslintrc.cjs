module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2020, sourceType: "module" },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "no-empty": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/exhaustive-deps": "off",

    // ปิดตัวที่ทำให้ขึ้น 7 warnings
    "react-refresh/only-export-components": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
