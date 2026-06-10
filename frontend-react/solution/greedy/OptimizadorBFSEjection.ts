import { GrafoBipartito } from '../models/GrafoBipartito';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { EvaluationContext } from '../objective/SoftConstraints';
import { ReglaBase } from '../rules/ReglaBase';
import { ProfesorDTO } from '../types/AssignmentTypes';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { BFSEjectionChain } from './BFSEjectionChain';
import {
    TelemetriaEjectionChain,
    ResultadoOptimizacionBFS,
    InstantaneaEstadoBFS,
    DiagnosticoDeltaZ
} from './EjectionChainTypes';
import { CriterioAceptacion } from '../objective/Tolerancia';

export type ObservadorEstadoBFS = (instantanea: InstantaneaEstadoBFS) => void;

interface ConfiguracionOptimizadorBFS {
    maxIteraciones: number;
    maxIteracionesSinMejora: number;
    profundidadMaximaCadena: number;
    criterioAceptacion: CriterioAceptacion;
    reglasContratoFSM: readonly ReglaBase[];
}

export class OptimizadorBFSEjection {
    private readonly _config: ConfiguracionOptimizadorBFS;
    private readonly _motorBFS: BFSEjectionChain;
    private _observadorUI: ObservadorEstadoBFS | null = null;

    constructor(config: Partial<ConfiguracionOptimizadorBFS> = {}) {
        this._config = {
            maxIteraciones: config.maxIteraciones ?? 100,
            maxIteracionesSinMejora: config.maxIteracionesSinMejora ?? 20,
            profundidadMaximaCadena: config.profundidadMaximaCadena ?? 5,
            criterioAceptacion: config.criterioAceptacion ?? new CriterioAceptacion(),
            reglasContratoFSM: config.reglasContratoFSM ?? [
                ...ReglasPipeline.getReglasFastFail(),
                ...ReglasPipeline.getReglasRestantes()
            ]
        };

        this._motorBFS = new BFSEjectionChain(
            this._config.reglasContratoFSM,
            this._config.profundidadMaximaCadena
        );
    }

    public registrarObservadorUI(observador: ObservadorEstadoBFS): void {
        this._observadorUI = observador;
    }

    public desregistrarObservadorUI(): void {
        this._observadorUI = null;
    }

    public optimizar(
        grafo: GrafoBipartito,
        funcionZ: FuncionObjetivoZ,
        profesoresDelGrafo: ProfesorDTO[],
        modelo: { score(eco: number, idGrupo: number): number }
    ): ResultadoOptimizacionBFS {
        const telemetria = this._crearTelemetriaVacia();
        let zActual = funcionZ.evaluarGrafo(grafo).Z;
        let sinMejoraConsecutiva = 0;
        let iteracion = 0;

        this._notificarObservador(grafo, iteracion, zActual, telemetria.mejorasAceptadas, sinMejoraConsecutiva);

        while (iteracion < this._config.maxIteraciones && sinMejoraConsecutiva < this._config.maxIteracionesSinMejora) {
            iteracion++;

            const profesorOrigen = BFSEjectionChain.seleccionarProfesorInicialPonderadoPorPotencial(
                grafo, modelo, profesoresDelGrafo
            );

            if (!profesorOrigen) {
                sinMejoraConsecutiva++;
                continue;
            }

            const dominioInicial = this._motorBFS.calcularDominioInicialDelProfesor(
                grafo, profesorOrigen.numeroEconomico
            );

            if (dominioInicial.length === 0) {
                telemetria.rechazosPorDominiVacio++;
                sinMejoraConsecutiva++;
                continue;
            }

            let mejoraCadenaEncontrada = false;

            for (const grupoDestino of dominioInicial) {
                const cadena = this._motorBFS.buscarCadenaMinima(
                    grafo,
                    profesorOrigen.numeroEconomico,
                    grupoDestino,
                    telemetria.rechazosFSMDetallados,
                    iteracion
                );

                if (!cadena) continue;

                const snapshotAntesDeCadena = this._motorBFS.capturarAsignacionesAfectadasPorCadena(grafo, cadena);
                this._motorBFS.aplicarCadenaEnGrafo(grafo, cadena);

                const zDespues = funcionZ.evaluarGrafo(grafo).Z;
                const deltaZ = zDespues - zActual;

                const diagnosticoDelta: DiagnosticoDeltaZ = {
                    iteracion,
                    profesorVictima: profesorOrigen.numeroEconomico,
                    profesorCandidato: cadena.nodos[cadena.nodos.length - 1].profesorEyectado,
                    idGrupoAfectado: grupoDestino,
                    zAntes: zActual,
                    zDespues,
                    deltaZ,
                    longitidCadena: cadena.longitudTotal
                };
                telemetria.distribucionDeltaZ.push(diagnosticoDelta);

                const esMejora = this._config.criterioAceptacion.esMejoraSignificativa(zDespues, zActual);

                if (esMejora) {
                    zActual = zDespues;
                    telemetria.mejorasAceptadas++;
                    telemetria.deltaZAcumulado += deltaZ;
                    sinMejoraConsecutiva = 0;
                    mejoraCadenaEncontrada = true;
                    this._notificarObservador(grafo, iteracion, zActual, telemetria.mejorasAceptadas, sinMejoraConsecutiva);
                    break;
                } else {
                    this._motorBFS.revertirCadenaEnGrafo(grafo, cadena, snapshotAntesDeCadena);
                    telemetria.rechazosPorDeltaNegativo++;
                }
            }

            if (!mejoraCadenaEncontrada) {
                sinMejoraConsecutiva++;
            }
        }

        this._notificarObservador(grafo, iteracion, zActual, telemetria.mejorasAceptadas, sinMejoraConsecutiva);

        return {
            mejoras: telemetria.mejorasAceptadas,
            iteracionesEjecutadas: iteracion,
            telemetria,
            grafoFinal: grafo
        };
    }

    public async optimizarAsync(
        grafo: GrafoBipartito,
        funcionZ: FuncionObjetivoZ,
        profesoresDelGrafo: ProfesorDTO[],
        modelo: { score(eco: number, idGrupo: number): number },
        context: EvaluationContext = {}
    ): Promise<ResultadoOptimizacionBFS> {
        const telemetria = this._crearTelemetriaVacia();
        let zActual = (await funcionZ.evaluarGrafoAsync(grafo, { ...context, fase: 'bfs-ejection:init' })).Z;
        let sinMejoraConsecutiva = 0;
        let iteracion = 0;

        this._notificarObservador(grafo, iteracion, zActual, telemetria.mejorasAceptadas, sinMejoraConsecutiva);

        while (iteracion < this._config.maxIteraciones && sinMejoraConsecutiva < this._config.maxIteracionesSinMejora) {
            iteracion++;

            const profesorOrigen = BFSEjectionChain.seleccionarProfesorInicialPonderadoPorPotencial(
                grafo, modelo, profesoresDelGrafo
            );

            if (!profesorOrigen) {
                sinMejoraConsecutiva++;
                continue;
            }

            const dominioInicial = this._motorBFS.calcularDominioInicialDelProfesor(
                grafo, profesorOrigen.numeroEconomico
            );

            if (dominioInicial.length === 0) {
                telemetria.rechazosPorDominiVacio++;
                sinMejoraConsecutiva++;
                continue;
            }

            let mejoraCadenaEncontrada = false;

            for (const grupoDestino of dominioInicial) {
                const cadena = this._motorBFS.buscarCadenaMinima(
                    grafo,
                    profesorOrigen.numeroEconomico,
                    grupoDestino,
                    telemetria.rechazosFSMDetallados,
                    iteracion
                );

                if (!cadena) continue;

                const snapshotAntesDeCadena = this._motorBFS.capturarAsignacionesAfectadasPorCadena(grafo, cadena);
                this._motorBFS.aplicarCadenaEnGrafo(grafo, cadena);

                const zDespues = (await funcionZ.evaluarGrafoAsync(grafo, {
                    ...context,
                    fase: 'bfs-ejection:eval',
                    iteracionEjection: iteracion
                })).Z;

                const deltaZ = zDespues - zActual;

                const diagnosticoDelta: DiagnosticoDeltaZ = {
                    iteracion,
                    profesorVictima: profesorOrigen.numeroEconomico,
                    profesorCandidato: cadena.nodos[cadena.nodos.length - 1].profesorEyectado,
                    idGrupoAfectado: grupoDestino,
                    zAntes: zActual,
                    zDespues,
                    deltaZ,
                    longitidCadena: cadena.longitudTotal
                };
                telemetria.distribucionDeltaZ.push(diagnosticoDelta);

                const esMejora = this._config.criterioAceptacion.esMejoraSignificativa(zDespues, zActual);

                if (esMejora) {
                    zActual = zDespues;
                    telemetria.mejorasAceptadas++;
                    telemetria.deltaZAcumulado += deltaZ;
                    sinMejoraConsecutiva = 0;
                    mejoraCadenaEncontrada = true;
                    this._notificarObservador(grafo, iteracion, zActual, telemetria.mejorasAceptadas, sinMejoraConsecutiva);
                    break;
                } else {
                    this._motorBFS.revertirCadenaEnGrafo(grafo, cadena, snapshotAntesDeCadena);
                    telemetria.rechazosPorDeltaNegativo++;
                }
            }

            if (!mejoraCadenaEncontrada) {
                sinMejoraConsecutiva++;
            }
        }

        this._notificarObservador(grafo, iteracion, zActual, telemetria.mejorasAceptadas, sinMejoraConsecutiva);

        return {
            mejoras: telemetria.mejorasAceptadas,
            iteracionesEjecutadas: iteracion,
            telemetria,
            grafoFinal: grafo
        };
    }

    private _notificarObservador(
        grafo: GrafoBipartito,
        iteracion: number,
        zActual: number,
        mejorasHastaAhora: number,
        sinMejoraConsecutiva: number
    ): void {
        if (!this._observadorUI) return;

        this._observadorUI({
            iteracionActual: iteracion,
            zActual,
            mejorasHastaAhora,
            sinMejoraConsecutiva,
            grafoActual: grafo
        });
    }

    private _crearTelemetriaVacia(): TelemetriaEjectionChain {
        return {
            mejorasAceptadas: 0,
            rechazosPorFSM: 0,
            rechazosPorDeltaNegativo: 0,
            rechazosPorDominiVacio: 0,
            deltaZAcumulado: 0,
            distribucionDeltaZ: [],
            rechazosFSMDetallados: [],
            frecuenciaRechazosPorRegla: new Map()
        };
    }

    public generarResumenDiagnostico(telemetria: TelemetriaEjectionChain): string {
        const lineas: string[] = [];

        lineas.push(`[BFSEjection] Mejoras aceptadas: ${telemetria.mejorasAceptadas}`);
        lineas.push(`[BFSEjection] Rechazos por dominio vacio: ${telemetria.rechazosPorDominiVacio}`);
        lineas.push(`[BFSEjection] Rechazos por delta Z negativo: ${telemetria.rechazosPorDeltaNegativo}`);
        lineas.push(`[BFSEjection] Delta Z acumulado: ${telemetria.deltaZAcumulado.toFixed(4)}`);

        if (telemetria.rechazosFSMDetallados.length > 0) {
            const conteosPorRegla = new Map<string, number>();
            for (const rechazo of telemetria.rechazosFSMDetallados) {
                conteosPorRegla.set(rechazo.reglaQueRechazo, (conteosPorRegla.get(rechazo.reglaQueRechazo) ?? 0) + 1);
            }

            lineas.push(`[BFSEjection] Rechazos FSM por regla:`);
            for (const [regla, cantidad] of conteosPorRegla) {
                lineas.push(`  - ${regla}: ${cantidad} rechazos`);
            }
        }

        if (telemetria.distribucionDeltaZ.length > 0) {
            const deltas = telemetria.distribucionDeltaZ.map(d => d.deltaZ);
            const deltaMin = Math.min(...deltas);
            const deltaMax = Math.max(...deltas);
            const deltaPromedio = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            lineas.push(`[BFSEjection] Delta Z — Min: ${deltaMin.toFixed(4)}, Max: ${deltaMax.toFixed(4)}, Promedio: ${deltaPromedio.toFixed(4)}`);

            const longitudesCadena = telemetria.distribucionDeltaZ.map(d => d.longitidCadena);
            const longMax = Math.max(...longitudesCadena);
            const longPromedio = longitudesCadena.reduce((a, b) => a + b, 0) / longitudesCadena.length;
            lineas.push(`[BFSEjection] Longitud cadena — Max: ${longMax}, Promedio: ${longPromedio.toFixed(2)}`);
        }

        return lineas.join('\n');
    }
}
