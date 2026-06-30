import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      // Mock externals so Vite resolves them correctly
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
    }
  }
});
