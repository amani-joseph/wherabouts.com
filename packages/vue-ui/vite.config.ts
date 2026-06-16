import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "WheraboutsVueUI",
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["vue", "@wherabouts/sdk"],
      output: {
        globals: {
          vue: "Vue",
          "@wherabouts/sdk": "WheraboutsSDK",
        },
      },
    },
    target: "es2020",
    sourcemap: true,
  },
});
