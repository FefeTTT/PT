import { create } from 'zustand';
import { BackendConfigDAO } from '../dao/BackendConfigDAO';
import type { BackendConfigDTO } from '../dtos';

export const DEFAULT_BACKEND_CONFIG: BackendConfigDTO = {
    connectionMode: 'viteProxy',
    pythonHost: '127.0.0.1',
    pythonPort: '8000',
    redisHost: '127.0.0.1',
    redisPort: '6379',
};

interface BackendConfigState {
    config: BackendConfigDTO;
    hydrated: boolean;
    hydrate: () => Promise<void>;
    setConfig: (next: BackendConfigDTO) => void;
}

let hydratePromise: Promise<void> | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let configVersion = 0;

export const useBackendConfigStore = create<BackendConfigState>((set, get) => ({
    config: DEFAULT_BACKEND_CONFIG,
    hydrated: false,

    hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (hydratePromise) return hydratePromise;

        const hydrateVersion = configVersion;
        hydratePromise = BackendConfigDAO.load()
            .then((stored) => {
                set((state) => ({
                    config: stored && configVersion === hydrateVersion
                        ? { ...DEFAULT_BACKEND_CONFIG, ...stored }
                        : state.config,
                    hydrated: true,
                }));
            })
            .catch((e) => {
                console.warn('No se pudo hidratar backend_config desde SQLite:', e);
                set({ hydrated: true });
            })
            .finally(() => {
                hydratePromise = null;
            });

        return hydratePromise;
    },

    setConfig: (next: BackendConfigDTO) => {
        configVersion += 1;
        set({ config: next });
        saveQueue = saveQueue
            .then(() => BackendConfigDAO.save(next))
            .catch(e => {
                console.warn('No se pudo persistir backend_config en SQLite:', e);
            });
        void saveQueue;
    },
}));
