import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';

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
}
