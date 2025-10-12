import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? process.env.VITE_BASE_PATH ?? "/finflow/" : "/",
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    sourcemap: true,
  },
}));
