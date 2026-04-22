import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_PROTOCOL_VERSION__: JSON.stringify(pkg.protocolVersion),
  },
  base: '/collab-code/',
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor') || id.includes('@monaco-editor/react')) return 'monaco'
          if (id.includes('yjs') || id.includes('y-indexeddb') || id.includes('y-monaco') || id.includes('y-websocket')) return 'yjs'
          if (id.includes('@xterm/xterm') || id.includes('@xterm/addon-fit')) return 'xterm'
        },
      },
    },
  },
})
