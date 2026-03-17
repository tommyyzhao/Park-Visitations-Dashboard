import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'duckdb': ['@duckdb/duckdb-wasm'],
          'recharts': ['recharts'],
          'vendor': ['react', 'react-dom', 'lucide-react'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
})
