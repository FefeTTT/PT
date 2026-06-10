/**
* Retorna el score de factibilidad w_ig ∈ [0, 1] para el par dado.
* @param profesorId  Número económico del profesor.
* @param grupoId     ID de la UEA-grupo.
**/
export interface IModeloML {
    score(profesorId: number, grupoId: number): number;
}

/**
 * Implementación por defecto: peso uniforme w_ig = 1 para todo par.
 * Usada cuando el modelo XGBoost externo aún no está integrado.
 * Con esta implementación, Z evalúa solo penalizaciones de restricciones suaves.
 */
export class ModeloMLUniforme implements IModeloML {
    score(_profesorId: number, _grupoId: number): number {
        return 1.0;
    }
}
