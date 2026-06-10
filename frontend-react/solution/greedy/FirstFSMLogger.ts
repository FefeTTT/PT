export interface FSMRejectionLog {
    eco: number;
    grupoId: number;
    reglaFallo: string;
    motivo: string;
}

export class FirstFSMLogger {
    private logsRechazo: FSMRejectionLog[] = [];

    public registrarCandidatoRechazado(eco: number, grupoId: number, reglaFallo: string, motivo: string): void {
        this.logsRechazo.push({
            eco,
            grupoId,
            reglaFallo,
            motivo
        });
    }

    public obtenerReporte(): FSMRejectionLog[] {
        return this.logsRechazo;
    }
}
