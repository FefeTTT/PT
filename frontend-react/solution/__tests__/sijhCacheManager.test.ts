import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const sets: Array<{ key: string; value: string }> = [];
    const post = vi.fn();
    const mget = vi.fn();
    return { sets, post, mget };
});

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({ post: mocks.post })),
        post: mocks.post,
    },
}));

vi.mock('ioredis', () => {
    class Redis {
        async mget(...keys: string[]): Promise<Array<string | null>> {
            return mocks.mget(...keys);
        }

        pipeline(): { set: (key: string, value: string) => void; exec: () => Promise<Array<[null, string]>> } {
            return {
                set: (key: string, value: string) => {
                    mocks.sets.push({ key, value });
                },
                exec: async () => mocks.sets.map(() => [null, 'OK']),
            };
        }

        async get(): Promise<string | null> {
            return null;
        }

        async set(key: string, value: string): Promise<string> {
            mocks.sets.push({ key, value });
            return 'OK';
        }

        async quit(): Promise<void> {}
    }

    return { Redis };
});

import { SijhCacheManager } from '../ml/SijhCacheManager';

describe('SijhCacheManager', () => {
    beforeEach(() => {
        mocks.sets.length = 0;
        mocks.post.mockReset();
        mocks.mget.mockReset();
        mocks.mget.mockImplementation((...keys: string[]) => keys.map(() => null));
        mocks.post.mockResolvedValue({ data: { rhat: 0.75, h_ih: 0.2 } });
    });

    it('calienta Sijh:v2 usando /S_ijh con horario semanal canonico', async () => {
        await SijhCacheManager.preCargarDirectorio({
            profesores_vigentes: ['19834'],
            programacion: [{
                uea: '1112030',
                grupos: ['Mi:08:30-10:00|L:08:30-10:00|V:08:30-10:00'],
            }],
        });

        expect(mocks.post).toHaveBeenCalledWith('/S_ijh', {
            eco: '19834',
            uea: '1112030',
            horario: 'L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00',
        });
        expect(mocks.sets[0].key).toBe(
            'Sijh:v2:19834:1112030:L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00'
        );
        expect(JSON.parse(mocks.sets[0].value)).toEqual({ rhat: 0.75, h_ih: 0.2 });
    });
});
