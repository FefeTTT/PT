/**
 * Retorna el score de factibilidad s_ig en [0, 1] para el par profesor-grupo.
 * El grupo debe identificarse por idUeaGrupo, no por claveGrupo.
 */
export interface IModeloML {
    score(profesorId: number, grupoId: number): number;
}

export function clamp01(valor: number): number {
    if (!Number.isFinite(valor)) return 0;
    return Math.max(0, Math.min(1, valor));
}

export function scoreNormalizado(modelo: IModeloML, profesorId: number, grupoId: number): number {
    return clamp01(modelo.score(profesorId, grupoId));
}

/**
 * Implementacion por defecto: peso uniforme s_ig = 1 para todo par.
 * Usada cuando el modelo externo aun no esta integrado.
 */
export class ModeloMLUniforme implements IModeloML {
    score(_profesorId: number, _grupoId: number): number {
        return 1.0;
    }
}
