/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        include: ['solution/__tests__/**/*.test.ts', 'src/Code/__tests__/**/*.test.ts', 'src/timetabling/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['solution/**/*.ts'],
            exclude: ['solution/__tests__/**', 'solution/types/**'],
            reporter: ['text', 'html'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@solution': path.resolve(__dirname, 'solution'),
        },
    },
});
