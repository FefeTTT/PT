import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import Redis from 'ioredis';
import { sqlitePersistencePlugin } from './server/sqliteMiddleware';

const timetablingBackendTarget = process.env.VITE_TIMETABLING_BACKEND_TARGET || 'http://127.0.0.1:8000';

// Host/puerto de Redis configurables por env, para apuntar al Redis dockerizado
// (p.ej. la IP de la VM de WSL si los puertos no se reenvian a 127.0.0.1 de Windows).
const redisHost = process.env.VITE_REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.VITE_REDIS_PORT || 6379);

let redisInstance: Redis | null = null;
const getRedis = () => {
    if (!redisInstance) {
        redisInstance = new Redis({ host: redisHost, port: redisPort, lazyConnect: true, maxRetriesPerRequest: 1 });
    }
    return redisInstance;
};

export default defineConfig({
    plugins: [
        react(),
        sqlitePersistencePlugin(),
        {
            name: 'redis-mget-proxy',
            configureServer(server) {
                server.middlewares.use('/api/redis/mget', (req, res) => {
                    if (req.method === 'POST') {
                        let body = '';
                        req.on('data', chunk => { body += chunk; });
                        req.on('end', async () => {
                            try {
                                const { keys } = JSON.parse(body);
                                if (!Array.isArray(keys)) {
                                    res.statusCode = 400;
                                    res.end('keys must be an array');
                                    return;
                                }
                                const chunkSize = 5000;
                                const results = [];
                                const redis = getRedis();
                                for (let i = 0; i < keys.length; i += chunkSize) {
                                    const chunk = keys.slice(i, i + chunkSize);
                                    const resChunk = await redis.mget(...chunk);
                                    results.push(...resChunk);
                                }
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify(results));
                            } catch (e) {
                                console.error(`[redis-mget-proxy] fallo contra ${redisHost}:${redisPort} ->`, e);
                                res.statusCode = 500;
                                res.end(`redis mget fallo (host=${redisHost}:${redisPort}): ${String(e)}`);
                            }
                        });
                    } else {
                        res.statusCode = 405;
                        res.end('Method Not Allowed');
                    }
                });
            }
        }
    ],
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
    resolve: {
        alias: {
            '@solution': path.resolve(__dirname, 'solution'),
            ioredis: path.resolve(__dirname, 'src/timetabling/engine/kde/stubs/ioredis-browser-stub.ts'),
            crypto: path.resolve(__dirname, 'src/timetabling/engine/kde/stubs/crypto-browser-stub.ts'),
        },
    },
    worker: {
        format: 'es',
    },
    server: {
        cors: true,
        origin: 'http://localhost:5173',
        proxy: {
            '/py': {
                target: timetablingBackendTarget,
                changeOrigin: true,
                rewrite: (proxyPath) => proxyPath.replace(/^\/py/, ''),
            },
            '/controlador': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/modelo': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
});
