import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion } from '../fsm/FSMAsignador';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { SemanaLaboral } from '../models/SemanaLaboral';
import {
    AsignacionInput,
    CandidatoProfesor,
    ResultadoGreedy,
    MetricasGreedy,
    EstrategiaOrdenamiento
} from './GreedyTypes';
import { EstrategiaMCV } from './EstrategiaMCV';
import { IModeloML, ModeloMLUniforme, scoreNormalizado } from '../ml/IModeloML';
import {
    IPerfilCargaConsecutivaProvider,
    PESO_PENALIZACION_CONSECUTIVA,
    PerfilCargaConsecutivaConstante
} from '../ml/PerfilCargaConsecutiva';
import { FuncionObjetivoZ, ConstraintPonderada } from '../objective/FuncionObjetivoZ';
import { ViabilidadHuecos } from '../objective/SoftConstraints';
import { calcularPenalizacionCargaConsecutivaCandidato } from '../objective/CargaConsecutivaHistorica';
import { EjectionChain } from './EjectionChain';

export class GreedyOrchestrator {
    private readonly _estrategia: EstrategiaOrdenamiento;
    private readonly _limiteHorasSemanales: number;
    private readonly _modelo: IModeloML;
    private readonly _perfilCargaProvider: IPerfilCargaConsecutivaProvider;
    private readonly _funcionZ: FuncionObjetivoZ;
    private readonly _ejectionChain: EjectionChain;

    constructor(
        estrategia: EstrategiaOrdenamiento = new EstrategiaMCV(),
        limiteHorasSemanales: number = 24,
        modelo?: IModeloML,
        constraintsPersonalizados?: ConstraintPonderada[],
        ejectionChain?: EjectionChain,
        perfilCargaProvider?: IPerfilCargaConsecutivaProvider
    ) {
        this._estrategia = estrategia;
        this._limiteHorasSemanales = limiteHorasSemanales;
        this._modelo = modelo ?? new ModeloMLUniforme();
        this._perfilCargaProvider = perfilCargaProvider ?? new PerfilCargaConsecutivaConstante();

        const constraints = constraintsPersonalizados ?? [
            { constraint: new ViabilidadHuecos(), lambda: 2.0 }
        ];

        this._funcionZ = new FuncionObjetivoZ(
            constraints,
            this._modelo,
            this._perfilCargaProvider
        );
        this._ejectionChain = ejectionChain ?? new EjectionChain();
    }

    public ejecutar(profesores: ProfesorDTO[], grupos: GrupoDTO[]): ResultadoGreedy {
        const inicio = performance.now();

        SemanaLaboral.invalidarCache();

        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        const reglas = ReglasPipeline.crear(this._limiteHorasSemanales);
        const fsm = new FSMAsignador(grafo, reglas);
        const gruposPorArea = this._agruparPorArea(grupos);
        const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);
        const profesoresPorArea = this._agruparProfesoresPorArea(profesores);

        const gruposAsignados = new Set<number>();
        let totalEvaluaciones = 0;
        let totalRechazados = 0;

        for (const [idArea, gruposDelArea] of areasOrdenadas) {
            const profesoresDelArea = profesoresPorArea.get(idArea) || [];
            if (profesoresDelArea.length === 0) continue;

            const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);

            for (const grupo of gruposOrdenados) {
                if (gruposAsignados.has(grupo.idUeaGrupo)) continue;

                const resultadoCandidatos = this._construirCandidatosFactibles(
                    profesoresDelArea,
                    grupo,
                    grafo,
                    fsm
                );

                totalEvaluaciones += resultadoCandidatos.evaluaciones;
                totalRechazados += resultadoCandidatos.rechazados;

                const elegido = this._estrategia.seleccionarProfesorParaGrupo(
                    resultadoCandidatos.candidatos,
                    grupo
                );

                if (!elegido) continue;

                grafo.asignarMutable(elegido.profesor.numeroEconomico, grupo.idUeaGrupo);
                fsm.actualizarGrafo(grafo);
                gruposAsignados.add(grupo.idUeaGrupo);
            }
        }

        fsm.actualizarGrafo(grafo);

        const todosLosGrupoIds = grupos.map(g => g.idUeaGrupo);
        const huerfanosPreRepair = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const resultadoMejora = this._ejectionChain.mejorar(grafo, fsm, this._funcionZ, huerfanosPreRepair);
        const resultadoZ = this._funcionZ.evaluarGrafo(grafo);
        const asignaciones: AsignacionInput[] = [];

        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            asignaciones.push({
                numeroEconomico: numEco,
                idUeaGrupo: idGrupo
            });
        }

        const gruposSinAsignar = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));
        const fin = performance.now();

        const metricas: MetricasGreedy = {
            totalEvaluaciones,
            totalAsignados: asignaciones.length,
            totalRechazados,
            tiempoMs: Math.round(fin - inicio),
            gruposSinAsignar,
            scoreZ: resultadoZ.Z,
            mejorasLocales: resultadoMejora.mejoras,
            reparaciones: resultadoMejora.reparaciones
        };

        return { asignaciones, metricas };
    }

    private _construirCandidatosFactibles(
        profesores: ProfesorDTO[],
        grupo: GrupoDTO,
        grafo: GrafoBipartito,
        fsm: FSMAsignador
    ): { candidatos: CandidatoProfesor[]; evaluaciones: number; rechazados: number } {
        const candidatos: CandidatoProfesor[] = [];
        let evaluaciones = 0;
        let rechazados = 0;

        fsm.actualizarGrafo(grafo);

        for (const profesor of profesores) {
            evaluaciones++;

            const resultado = fsm.procesarAsignacion(
                profesor.numeroEconomico,
                grupo.idUeaGrupo
            );

            if (resultado.estado !== EstadoAsignacion.ASIGNACION_OK) {
                rechazados++;
                continue;
            }

            const scoreML = scoreNormalizado(this._modelo, profesor.numeroEconomico, grupo.idUeaGrupo);
            const penalizacionConsecutiva = calcularPenalizacionCargaConsecutivaCandidato(
                grafo,
                profesor.numeroEconomico,
                grupo.idUeaGrupo,
                this._perfilCargaProvider
            );

            candidatos.push({
                profesor,
                grupo,
                scoreML,
                penalizacionConsecutiva,
                scoreRCL: scoreML - PESO_PENALIZACION_CONSECUTIVA * penalizacionConsecutiva
            });
        }

        return { candidatos, evaluaciones, rechazados };
    }

    private _agruparPorArea(grupos: GrupoDTO[]): Map<number, GrupoDTO[]> {
        const mapa = new Map<number, GrupoDTO[]>();
        for (const grupo of grupos) {
            if (!mapa.has(grupo.idArea)) {
                mapa.set(grupo.idArea, []);
            }
            mapa.get(grupo.idArea)!.push(grupo);
        }
        return mapa;
    }

    private _agruparProfesoresPorArea(profesores: ProfesorDTO[]): Map<number, ProfesorDTO[]> {
        const mapa = new Map<number, ProfesorDTO[]>();
        for (const profesor of profesores) {
            if (!mapa.has(profesor.idArea)) {
                mapa.set(profesor.idArea, []);
            }
            mapa.get(profesor.idArea)!.push(profesor);
        }
        return mapa;
    }
}
