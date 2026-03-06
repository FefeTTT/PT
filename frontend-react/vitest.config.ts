/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        include: ['src/Code/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/Code/**/*.ts'],
            exclude: ['src/Code/__tests__/**', 'src/Code/types/**'],
            reporter: ['text', 'html'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
