import globals from "globals";
export default [
  {
    files: ["server/**/*.js", "api/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-constant-condition": "error",
    },
  },
  { files: ["api/**/*.js"], languageOptions: { sourceType: "commonjs" } },
];
