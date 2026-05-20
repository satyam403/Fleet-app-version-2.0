import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Strip console.* and debugger from production bundles only
  esbuild:
    mode === "production"
      ? { drop: ["console", "debugger"] }
      : undefined,
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split big vendor chunks so the initial JS payload on mobile is smaller
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router", "react-router-dom"],
          "ui-vendor": ["framer-motion", "lucide-react"],
          "chart-vendor": ["recharts"],
          "i18n-vendor": ["i18next", "react-i18next"],
        },
      },
    },
  },
}));
