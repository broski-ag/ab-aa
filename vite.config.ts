import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info'],
    drop: ['debugger'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // React is the only large dependency; keep it in its own long-cached file
        manualChunks(id: string) {
          if (id.includes('node_modules') && /node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
        },
      },
    },
  },
});
