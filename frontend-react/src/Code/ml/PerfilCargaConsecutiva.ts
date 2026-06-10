export interface PerfilCargaConsecutiva {
    eco: number;
    tauHoras: number;
    fallback: boolean;
    version: string;
}

export interface IPerfilCargaConsecutivaProvider {
    getTauHoras(numeroEconomico: number): number;
    getPerfil?(numeroEconomico: number): PerfilCargaConsecutiva;
}

export const VERSION_CARGA_CONSECUTIVA = 'consecutiva-v1';
export const TAU_MIN_HORAS = 1.5;
export const TAU_MAX_HORAS = 6.0;
export const PESO_PENALIZACION_CONSECUTIVA = 0.75;
export const BACKEND_CARGA_CONSECUTIVA_PRIMARIO = 'http://127.0.0.1:8000';
export const BACKEND_CARGA_CONSECUTIVA_FALLBACK = 'http://localhost:8000';
export const ENDPOINT_CARGA_CONSECUTIVA = '/ml/features/carga-consecutiva';

export function normalizarTauHoras(tauHoras: number): number {
    if (!Number.isFinite(tauHoras)) return TAU_MAX_HORAS;
    return Math.max(TAU_MIN_HORAS, Math.min(TAU_MAX_HORAS, tauHoras));
}

export class PerfilCargaConsecutivaConstante implements IPerfilCargaConsecutivaProvider {
    private readonly _tauHoras: number;

    constructor(tauHoras: number = TAU_MAX_HORAS) {
        this._tauHoras = normalizarTauHoras(tauHoras);
    }

    getTauHoras(_numeroEconomico: number): number {
        return this._tauHoras;
    }

    getPerfil(numeroEconomico: number): PerfilCargaConsecutiva {
        return {
            eco: numeroEconomico,
            tauHoras: this._tauHoras,
            fallback: true,
            version: VERSION_CARGA_CONSECUTIVA
        };
    }
}

export class PerfilCargaConsecutivaMemoria implements IPerfilCargaConsecutivaProvider {
    private readonly _perfiles = new Map<number, PerfilCargaConsecutiva>();
    private readonly _fallbackTauHoras: number;

    constructor(
        perfiles: Map<number, number | Partial<PerfilCargaConsecutiva>> | Record<string, number | Partial<PerfilCargaConsecutiva>>,
        fallbackTauHoras: number = TAU_MAX_HORAS
    ) {
        this._fallbackTauHoras = normalizarTauHoras(fallbackTauHoras);

        if (perfiles instanceof Map) {
            for (const [eco, perfil] of perfiles) {
                this._perfiles.set(eco, this._normalizarPerfil(eco, perfil));
            }
        } else {
            for (const [ecoRaw, perfil] of Object.entries(perfiles)) {
                const eco = Number(ecoRaw);
                if (Number.isFinite(eco)) {
                    this._perfiles.set(eco, this._normalizarPerfil(eco, perfil));
                }
            }
        }
    }

    getTauHoras(numeroEconomico: number): number {
        return this.getPerfil(numeroEconomico).tauHoras;
    }

    getPerfil(numeroEconomico: number): PerfilCargaConsecutiva {
        const perfil = this._perfiles.get(numeroEconomico);
        if (perfil) return perfil;

        return {
            eco: numeroEconomico,
            tauHoras: this._fallbackTauHoras,
            fallback: true,
            version: VERSION_CARGA_CONSECUTIVA
        };
    }

    private _normalizarPerfil(
        eco: number,
        perfil: number | Partial<PerfilCargaConsecutiva>
    ): PerfilCargaConsecutiva {
        if (typeof perfil === 'number') {
            return {
                eco,
                tauHoras: normalizarTauHoras(perfil),
                fallback: false,
                version: VERSION_CARGA_CONSECUTIVA
            };
        }

        return {
            eco,
            tauHoras: normalizarTauHoras(perfil.tauHoras ?? this._fallbackTauHoras),
            fallback: perfil.fallback ?? false,
            version: perfil.version ?? VERSION_CARGA_CONSECUTIVA
        };
    }
}

interface BackendCargaConsecutivaItem {
    tauHoras: number;
    fallback: boolean;
}

interface BackendCargaConsecutivaResponse {
    version: string;
    items: Record<string, BackendCargaConsecutivaItem>;
}

export async function cargarPerfilesCargaConsecutivaDesdeBackend(
    ecos: number[],
    baseUrl: string = BACKEND_CARGA_CONSECUTIVA_PRIMARIO
): Promise<PerfilCargaConsecutivaMemoria> {
    const data = await solicitarPerfilesCargaConsecutiva(ecos, urlsBackendCargaConsecutiva(baseUrl));
    const perfiles = new Map<number, Partial<PerfilCargaConsecutiva>>();

    for (const [ecoRaw, item] of Object.entries(data.items ?? {})) {
        const eco = Number(ecoRaw);
        if (!Number.isFinite(eco)) continue;

        perfiles.set(eco, {
            tauHoras: item.tauHoras,
            fallback: item.fallback,
            version: data.version || VERSION_CARGA_CONSECUTIVA
        });
    }

    return new PerfilCargaConsecutivaMemoria(perfiles);
}

function urlsBackendCargaConsecutiva(baseUrl: string): string[] {
    const urls = [baseUrl];
    if (baseUrl === BACKEND_CARGA_CONSECUTIVA_PRIMARIO) {
        urls.push(BACKEND_CARGA_CONSECUTIVA_FALLBACK);
    }
    return urls;
}

async function solicitarPerfilesCargaConsecutiva(
    ecos: number[],
    baseUrls: string[]
): Promise<BackendCargaConsecutivaResponse> {
    let ultimoError: unknown;

    for (const baseUrl of baseUrls) {
        try {
            const response = await fetch(`${baseUrl}${ENDPOINT_CARGA_CONSECUTIVA}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ecos: ecos.map(String) })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json() as BackendCargaConsecutivaResponse;
        } catch (error) {
            ultimoError = error;
        }
    }

    if (ultimoError instanceof Error) {
        throw new Error(`No se pudieron cargar perfiles de carga consecutiva: ${ultimoError.message}`);
    }

    throw new Error('No se pudieron cargar perfiles de carga consecutiva.');
}
