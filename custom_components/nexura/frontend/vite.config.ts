import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/nexura_static/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `[name]-v68.js`,
        chunkFileNames: `[name]-v68.js`,
        assetFileNames: `[name]-v68.[ext]`
      }
    }
  }
})
