import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendConfigDTO } from '../dtos';

const daoMocks = vi.hoisted(() => ({
    load: vi.fn(),
    save: vi.fn(),
}));

vi.mock('../dao/BackendConfigDAO', () => ({
    BackendConfigDAO: {
        load: daoMocks.load,
        save: daoMocks.save,
    },
}));

import { DEFAULT_BACKEND_CONFIG, useBackendConfigStore } from '../store/backendConfigStore';

const directConfig: BackendConfigDTO = {
    connectionMode: 'direct',
    pythonHost: '10.0.0.5',
    pythonPort: '8100',
    redisHost: '10.0.0.6',
    redisPort: '6380',
};

const waitForQueuedPromises = () => new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
});

describe('backendConfigStore', () => {
    beforeEach(() => {
        useBackendConfigStore.setState({
            config: DEFAULT_BACKEND_CONFIG,
            hydrated: false,
        });
        daoMocks.load.mockReset();
        daoMocks.save.mockReset();
        daoMocks.save.mockResolvedValue(undefined);
    });

    it('hidrata una sola vez y comparte la config cargada', async () => {
        daoMocks.load.mockResolvedValue(directConfig);

        const firstHydration = useBackendConfigStore.getState().hydrate();
        const secondHydration = useBackendConfigStore.getState().hydrate();

        expect(secondHydration).toBe(firstHydration);
        await Promise.all([firstHydration, secondHydration]);

        expect(daoMocks.load).toHaveBeenCalledTimes(1);
        expect(useBackendConfigStore.getState().hydrated).toBe(true);
        expect(useBackendConfigStore.getState().config).toEqual(directConfig);

        await useBackendConfigStore.getState().hydrate();
        expect(daoMocks.load).toHaveBeenCalledTimes(1);
    });

    it('no permite que una hidratacion tardia sobrescriba un cambio local', async () => {
        let resolveLoad!: (stored: BackendConfigDTO | null) => void;
        daoMocks.load.mockReturnValue(new Promise<BackendConfigDTO | null>((resolve) => {
            resolveLoad = resolve;
        }));

        const hydration = useBackendConfigStore.getState().hydrate();
        const localConfig: BackendConfigDTO = {
            ...directConfig,
            pythonHost: '192.168.1.10',
        };

        useBackendConfigStore.getState().setConfig(localConfig);
        resolveLoad(directConfig);
        await hydration;

        expect(daoMocks.save).toHaveBeenCalledWith(localConfig);
        expect(useBackendConfigStore.getState().config).toEqual(localConfig);
        expect(useBackendConfigStore.getState().hydrated).toBe(true);
    });

    it('serializa guardados consecutivos para persistir la ultima config al final', async () => {
        let resolveFirstSave!: () => void;
        const firstSave = new Promise<void>((resolve) => {
            resolveFirstSave = resolve;
        });
        const secondConfig: BackendConfigDTO = {
            ...directConfig,
            pythonPort: '8200',
        };

        daoMocks.save
            .mockReturnValueOnce(firstSave)
            .mockResolvedValueOnce(undefined);

        useBackendConfigStore.getState().setConfig(directConfig);
        useBackendConfigStore.getState().setConfig(secondConfig);

        await Promise.resolve();
        expect(daoMocks.save).toHaveBeenCalledTimes(1);
        expect(daoMocks.save).toHaveBeenNthCalledWith(1, directConfig);

        resolveFirstSave();
        await waitForQueuedPromises();

        expect(daoMocks.save).toHaveBeenCalledTimes(2);
        expect(daoMocks.save).toHaveBeenNthCalledWith(2, secondConfig);
        expect(useBackendConfigStore.getState().config).toEqual(secondConfig);
    });
});
