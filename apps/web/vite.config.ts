import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	// Load `.env*` from monorepo root so `CLERK_SECRET_KEY` matches `VITE_CLERK_PUBLISHABLE_KEY` when keys live in one file.
	envDir: path.resolve(__dirname, "../.."),
	plugins: [tsconfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
	server: {
		port: 3001,
	},
});
