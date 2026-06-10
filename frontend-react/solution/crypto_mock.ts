export function createHash(_algo: string) {
    return {
        update: (data: string) => ({
            digest: (_format: string) => {
                // simple hash mock
                let hash = 0;
                for (let i = 0; i < data.length; i++) {
                    hash = ((hash << 5) - hash) + data.charCodeAt(i);
                    hash |= 0;
                }
                return Math.abs(hash).toString(16);
            }
        })
    };
}
export default { createHash };
