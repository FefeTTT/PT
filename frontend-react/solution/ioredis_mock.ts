export class Redis {
    constructor() {
        console.warn('Mock Redis initialized in browser. Using memory/Webdis instead of TCP Redis.');
    }
    async get(_key: string) { return null; }
    async set(_key: string, _value: string) { return 'OK'; }
    async mget(...keys: string[]) { return keys.map(() => null); }
    async quit() { return 'OK'; }
}
