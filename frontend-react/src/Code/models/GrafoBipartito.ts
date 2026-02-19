import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';

export class GrafoBipartito {
    public readonly profesores: Map<string, ProfesorDTO>;
    public readonly grupos: Map<string, GrupoDTO>;
    public readonly adyacencias: Map<string, string[]>;
    public readonly asignacionesInversas: Map<string, string>;

    /**
     * El constructor copia las estructuras para garantizar inmutabilidad
     * entre estados. Si se omiten mapas, se inicializan vacíos.
     */
    constructor(
        profesores?: Map<string, ProfesorDTO>,
        grupos?: Map<string, GrupoDTO>,
        adyacencias?: Map<string, string[]>,
        asignacionesInversas?: Map<string, string>
    ) {
        this.profesores = profesores ? new Map(profesores) : new Map();
        this.grupos = grupos ? new Map(grupos) : new Map();

        const copyAdy = new Map<string, string[]>();
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
        this.grupos.set(g.idGrupo, g);
    }

    public asignar(numeroEconomico: string, idGrupo: string): GrafoBipartito {
        if (this.asignacionesInversas.has(idGrupo)) {
            throw new Error(`El grupo ${idGrupo} ya está asignado a otro profesor`);
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
        listaGruposProf.push(idGrupo);
        nuevoGrafo.adyacencias.set(numeroEconomico, listaGruposProf);

        nuevoGrafo.asignacionesInversas.set(idGrupo, numeroEconomico);

        return nuevoGrafo;
    }
}
