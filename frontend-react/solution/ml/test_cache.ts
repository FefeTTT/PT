import { SijhCacheManager } from './SijhCacheManager';
import { Redis } from 'ioredis';

const payload = {
    profesores_vigentes: ["28650", "14416"], // 14416 es el de prueba
    programacion: [
        {
            uea: "1112034",
            grupos: ["14:30-16:00", "08:30-10:00"]
        }
    ]
};

async function runTest() {
    console.log('=================================');
    console.log(' INICIANDO PRUEBA CACHE MANAGER');
    console.log('=================================');
    try {
        await SijhCacheManager.preCargarDirectorio(payload, true);
        
        console.log('\n=================================');
        console.log(' VERIFICANDO DB EN REDIS');
        console.log('=================================');
        
        const redis = new Redis({ host: '127.0.0.1', port: 6379 });
        const keys = await redis.keys('Sijh:v2:*');
        console.log(`\n Total de llaves generadas exitosamente: ${keys.length}`);
        console.log(' Lista de llaves en caché:', keys);
        
        if (keys.length > 0) {
            console.log('\n Instrucción de prueba completada - Llave seleccionada:');
            const data = await redis.get(keys[0]);
            console.log(` -> ${keys[0]}: ${data}`);
        }
        
        await redis.quit();
        await SijhCacheManager.disconnect();
        console.log('\n Prueba finalizada correctamente.');
    } catch (e) {
        console.error(" Error critico en la ejecucion:", e);
    }
}

runTest();
