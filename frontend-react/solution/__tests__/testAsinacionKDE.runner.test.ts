import { describe, it } from 'vitest';
import { runTestAsignacionKDE } from '../greedy/testAsinacionKDE';

describe('testAsinacionKDE wrapper', () => {
    it('ejecuta GRASP con ZScoreFunction KDE', async () => {
        await runTestAsignacionKDE();
    }, 600_000);
});
