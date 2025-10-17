import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? process.env.VITE_BASE_PATH ?? "/finflow/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "lucide-react": path.resolve(__dirname, "src/vendor/lucide-react.jsx"),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    sourcemap: true,
  },
}));
