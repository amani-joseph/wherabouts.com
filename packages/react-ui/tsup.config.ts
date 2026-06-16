import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "@wherabouts/sdk", "@wherabouts/react"],
  treeshake: true,
  target: "es2020",
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
