import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5555,
    proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: true } }
  }
});

// https://vitejs.dev/config/