module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["@typescript-eslint/eslint-plugin", "unused-imports", "import"],
  rules: {
    "prettier/prettier": "error",
    // for TypeScript 4.7 imports
    "import/no-unresolved": "off",
    "import/order": [
      "error",
      {
        alphabetize: { order: "asc" },
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "object",
          "type",
        ],
      },
    ],
    "unused-imports/no-unused-imports": "error",
  },
};
