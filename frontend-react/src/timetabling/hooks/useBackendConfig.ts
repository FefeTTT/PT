import { useEffect, useMemo } from 'react';
import type { BackendConfigDTO } from '../dtos';
import { useBackendConfigStore } from '../store/backendConfigStore';

export function useBackendConfig() {
    const config = useBackendConfigStore(state => state.config);
    const hydrate = useBackendConfigStore(state => state.hydrate);
    const setConfig = useBackendConfigStore(state => state.setConfig);

    // Hidratacion async compartida: todos los consumidores leen la misma config backend.
    useEffect(() => {
        void hydrate();
    }, [hydrate]);

    const baseUrl = useMemo(() => buildBackendBaseUrl(config), [config]);

    return { config, setConfig, baseUrl };
}

export function buildBackendBaseUrl(config: BackendConfigDTO): string {
    if (config.connectionMode === 'viteProxy') {
        return '/py';
    }

    return `http://${config.pythonHost}:${config.pythonPort}`;
}
