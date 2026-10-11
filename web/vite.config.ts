import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Le plugin Vite officiel de Tailwind v4 remplace l'ancien couple
  // tailwind.config.js + postcss.config.js : plus rapide, pas de config JS
  // séparée (le thème se configure directement en CSS, voir src/index.css).
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias "@/..." utilisé par shadcn/ui pour ses imports de composants.
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {

      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
