import { GrafoBipartito } from '../models/GrafoBipartito';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';

/**
 * Verificación de integridad de rollback para EjectionChain.
 *
 * Ejecutar: npx tsx src/Code/greedy/testRollbackIntegridad.ts
 *
 * Invariante: tras un ciclo asignar → desasignar (o viceversa),
 * hashEstado() debe producir el mismo valor que antes del ciclo.
 */

function crearGrafoMinimo(): GrafoBipartito {
    const grafo = new GrafoBipartito();

    const profesores: ProfesorDTO[] = [
        { numeroEconomico: 1001, idArea: ['1'], horariosContratacion: [] },
        { numeroEconomico: 1002, idArea: ['1'], horariosContratacion: [] },
        { numeroEconomico: 1003, idArea: ['1'], horariosContratacion: [] },
    ];

    const grupos: GrupoDTO[] = [
        { idUeaGrupo: 100, idGrupo: 1, claveGrupo: 'T01', idArea: '1', ueaClave: 10, horarioStringRaw: '', horarios: [{ dia: 1, horaInicio: 8, horaFin: 10 }] },
        { idUeaGrupo: 101, idGrupo: 2, claveGrupo: 'T02', idArea: '1', ueaClave: 10, horarioStringRaw: '', horarios: [{ dia: 1, horaInicio: 10, horaFin: 12 }] },
        { idUeaGrupo: 102, idGrupo: 3, claveGrupo: 'T03', idArea: '1', ueaClave: 11, horarioStringRaw: '', horarios: [{ dia: 2, horaInicio: 8, horaFin: 10 }] },
        { idUeaGrupo: 103, idGrupo: 4, claveGrupo: 'T04', idArea: '1', ueaClave: 11, horarioStringRaw: '', horarios: [{ dia: 2, horaInicio: 10, horaFin: 12 }] },
    ];

    profesores.forEach(p => grafo.registrarProfesor(p));
    grupos.forEach(g => grafo.registrarGrupo(g));

    return grafo;
}

function poblarAsignaciones(grafo: GrafoBipartito): void {
    grafo.asignarMutable(1001, 100);
    grafo.asignarMutable(1002, 101);
    grafo.asignarMutable(1003, 102);
}

// ── Test 1: asignar → desasignar devuelve al estado original ──

function testRollbackDesasignar(): void {
    const grafo = crearGrafoMinimo();
    poblarAsignaciones(grafo);

    const hashAntes = grafo.hashEstado();

    grafo.asignarMutable(1001, 103);
    grafo.desasignarMutable(103);

    const hashDespues = grafo.hashEstado();

    assertIgual(hashAntes, hashDespues, 'rollback desasignar');
}

// ── Test 2: swap completo (desasignar A, asignar B, luego revertir) ──

function testRollbackSwapCompleto(): void {
    const grafo = crearGrafoMinimo();
    poblarAsignaciones(grafo);

    const hashAntes = grafo.hashEstado();

    // Simular swap: grupo 100 pasa de profesor 1001 a 1002
    grafo.desasignarMutable(100);
    // El grupo 101 ya está en 1002, así que asigno 100 a 1003 para evitar colisión
    grafo.asignarMutable(1003, 100);

    // Revertir: desasignar de 1003 y re-asignar a 1001 original
    grafo.desasignarMutable(100);
    grafo.asignarMutable(1001, 100);

    const hashDespues = grafo.hashEstado();

    assertIgual(hashAntes, hashDespues, 'rollback swap completo');
}

// ── Test 3: múltiples operaciones y rollback secuencial ──

function testRollbackMultiple(): void {
    const grafo = crearGrafoMinimo();
    poblarAsignaciones(grafo);

    const hashAntes = grafo.hashEstado();

    grafo.desasignarMutable(100);
    grafo.desasignarMutable(101);
    grafo.desasignarMutable(102);

    grafo.asignarMutable(1001, 100);
    grafo.asignarMutable(1002, 101);
    grafo.asignarMutable(1003, 102);

    const hashDespues = grafo.hashEstado();

    assertIgual(hashAntes, hashDespues, 'rollback múltiple');
}

// ── Test 4: hashEstado es determinista ──

function testHashDeterminista(): void {
    const grafo = crearGrafoMinimo();
    poblarAsignaciones(grafo);

    const hash1 = grafo.hashEstado();
    const hash2 = grafo.hashEstado();

    assertIgual(hash1, hash2, 'hash determinista');
}

// ── Test 5: grafos con mismas asignaciones en distinto orden producen mismo hash ──

function testHashIndependienteDeOrdenInsercion(): void {
    const grafo1 = crearGrafoMinimo();
    grafo1.asignarMutable(1001, 100);
    grafo1.asignarMutable(1002, 101);

    const grafo2 = crearGrafoMinimo();
    grafo2.asignarMutable(1002, 101);
    grafo2.asignarMutable(1001, 100);

    assertIgual(grafo1.hashEstado(), grafo2.hashEstado(), 'hash independiente de orden insercion');
}

// ── Utilidades ──

function assertIgual(esperado: string, actual: string, nombre: string): void {
    if (esperado === actual) {
        console.log(`[PASS] ${nombre}`);
    } else {
        console.error(`[FAIL] ${nombre}`);
        console.error(`  esperado: ${esperado}`);
        console.error(`  actual:   ${actual}`);
        process.exit(1);
    }
}

// ── Ejecución ──

console.log('─── Verificación de Integridad de Rollback ───\n');

testRollbackDesasignar();
testRollbackSwapCompleto();
testRollbackMultiple();
testHashDeterminista();
testHashIndependienteDeOrdenInsercion();

console.log('\n─── Todos los tests pasaron ───');
