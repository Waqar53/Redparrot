import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@services': path.resolve(__dirname, './src/services'),
            '@stores': path.resolve(__dirname, './src/stores'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@utils': path.resolve(__dirname, './src/utils'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
