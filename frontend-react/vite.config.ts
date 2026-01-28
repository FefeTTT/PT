import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        // Output to ../js/react_build so PHP can serve it
        outDir: path.resolve(__dirname, '../js/react_build'),
        emptyOutDir: true,
        manifest: true, // Generate manifest for PHP integration helper if needed
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'src/main.tsx'),
            },
            // Ensure distinct file names for cache busting, or keep simple? 
            // Vite default hashing is good.
        },
    },
    server: {
        cors: true,
        origin: 'http://localhost:5173',
    },
});
