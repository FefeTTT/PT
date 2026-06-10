import fs from 'fs';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { JSONAssignmentAdapter } from './JSONAssignmentAdapter';

export class JSONAssignmentAdapterIO {
    static parsearProfesores(ecoHorarioPath: string, areaProfesorPath: string, ecoHorarioIrregularPath?: string): ProfesorDTO[] {
        const rawEcoHorario = JSON.parse(fs.readFileSync(ecoHorarioPath, 'utf-8'));
        const rawAreaProfesor = JSON.parse(fs.readFileSync(areaProfesorPath, 'utf-8'));

        let rawIrregulares: any = {};
        if (ecoHorarioIrregularPath && fs.existsSync(ecoHorarioIrregularPath)) {
            rawIrregulares = JSON.parse(fs.readFileSync(ecoHorarioIrregularPath, 'utf-8'));
        }

        return JSONAssignmentAdapter.parsearProfesoresDesdeObjeto(rawEcoHorario, rawAreaProfesor, rawIrregulares);
    }

    static parsearGrupos(programacionPath: string): GrupoDTO[] {
        const rawProg = JSON.parse(fs.readFileSync(programacionPath, 'utf-8'));
        return JSONAssignmentAdapter.parsearGruposDesdeObjeto(rawProg);
    }
}
