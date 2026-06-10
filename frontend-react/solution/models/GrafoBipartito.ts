import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';

export class GrafoBipartito {
    public readonly profesores: Map<number, ProfesorDTO>;
    public readonly grupos: Map<number, GrupoDTO>;
    public readonly adyacencias: Map<number, number[]>;
    public readonly asignacionesInversas: Map<number, number>;

    /**
     * El constructor copia las estructuras para garantizar inmutabilidad
     * entre estados. Si se omiten mapas, se inicializan vacíos.
     */
    constructor(
        profesores?: Map<number, ProfesorDTO>,
        grupos?: Map<number, GrupoDTO>,
        adyacencias?: Map<number, number[]>,
        asignacionesInversas?: Map<number, number>
    ) {
        this.profesores = profesores ? new Map(profesores) : new Map();
        this.grupos = grupos ? new Map(grupos) : new Map();

        const copyAdy = new Map<number, number[]>();
        if (adyacencias) {
            adyacencias.forEach((listaGrupos, profId) => {
                copyAdy.set(profId, [...listaGrupos]);
            });
        }
        this.adyacencias = copyAdy;

        this.asignacionesInversas = asignacionesInversas ? new Map(asignacionesInversas) : new Map();
    }

    public clonar(): GrafoBipartito {
        return new GrafoBipartito(
            this.profesores,
            this.grupos,
            this.adyacencias,
            this.asignacionesInversas
        );
    }
    public registrarProfesor(p: ProfesorDTO) {
        this.profesores.set(p.numeroEconomico, p);
        if (!this.adyacencias.has(p.numeroEconomico)) {
            this.adyacencias.set(p.numeroEconomico, []);
        }
    }

    public registrarGrupo(g: GrupoDTO) {
        this.grupos.set(g.idUeaGrupo, g);
    }

    public asignar(numeroEconomico: number, idUeaGrupo: number): GrafoBipartito {
        if (this.asignacionesInversas.has(idUeaGrupo)) {
            throw new Error(`El grupo ${idUeaGrupo} ya está asignado a otro profesor`);
        }

        // Construir la nueva instancia propagando maps actuales
        const nuevoGrafo = new GrafoBipartito(
            this.profesores,
            this.grupos,
            this.adyacencias,
            this.asignacionesInversas
        );

        // Aplicar la mutación sobre la nueva instancia
        const listaGruposProf = nuevoGrafo.adyacencias.get(numeroEconomico) || [];
        listaGruposProf.push(idUeaGrupo);
        nuevoGrafo.adyacencias.set(numeroEconomico, listaGruposProf);

        nuevoGrafo.asignacionesInversas.set(idUeaGrupo, numeroEconomico);

        return nuevoGrafo;
    }

    /**
     * Asignación in-place (mutable). NO crea una nueva instancia.
     * Uso exclusivo del GreedyOrchestrator para evitar el costo O(P+G+E) de copia por éxito.
     * Para uso desde React/debugger, usar `asignar()` inmutable.
     */
    public asignarMutable(numeroEconomico: number, idUeaGrupo: number): void {
        if (this.asignacionesInversas.has(idUeaGrupo)) {
            throw new Error(`El grupo ${idUeaGrupo} ya está asignado a otro profesor`);
        }

        const listaGruposProf = this.adyacencias.get(numeroEconomico) || [];
        listaGruposProf.push(idUeaGrupo);
        this.adyacencias.set(numeroEconomico, listaGruposProf);

        this.asignacionesInversas.set(idUeaGrupo, numeroEconomico);
    }

    /**
     * Des-asignación in-place (mutable). Revierte una asignación existente.
     * Uso exclusivo de EjectionChain para búsqueda local O(1).
     */
    public desasignarMutable(idUeaGrupo: number): void {
        const numEco = this.asignacionesInversas.get(idUeaGrupo);
        if (numEco === undefined) {
            throw new Error(`El grupo ${idUeaGrupo} no está asignado a ningún profesor`);
        }

        const listaGruposProf = this.adyacencias.get(numEco);
        if (listaGruposProf) {
            const idx = listaGruposProf.indexOf(idUeaGrupo);
            if (idx !== -1) {
                listaGruposProf.splice(idx, 1);
            }
        }

        this.asignacionesInversas.delete(idUeaGrupo);
    }

    /**
     * Serialización determinista del estado mutable para verificación de rollback.
     * Dos grafos con las mismas asignaciones producen el mismo string.
     */
    public hashEstado(): string {
        const parteInversas = this._serializarAsignacionesInversas();
        const parteAdyacencias = this._serializarAdyacencias();
        return `INV:${parteInversas}|ADY:${parteAdyacencias}`;
    }

    private _serializarAsignacionesInversas(): string {
        const entradas = Array.from(this.asignacionesInversas.entries());
        entradas.sort((a, b) => a[0] - b[0]);
        return entradas.map(([g, p]) => `${g}:${p}`).join(',');
    }

    private _serializarAdyacencias(): string {
        const claves = Array.from(this.adyacencias.keys()).sort((a, b) => a - b);
        return claves
            .map(k => {
                const grupos = [...(this.adyacencias.get(k) || [])].sort((a, b) => a - b);
                return `${k}=[${grupos.join(',')}]`;
            })
            .join(';');
    }
}
