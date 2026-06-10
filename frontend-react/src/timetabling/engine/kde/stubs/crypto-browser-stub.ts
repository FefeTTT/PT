/**
 * Stub funcional de 'crypto' (Node) para el bundle del browser/worker.
 *
 * `@solution/ml/PenaltyObservedCache` y `CacheKeys.penaltyObservedKey` usan
 * `createHash('sha1').update(str).digest('hex')` de forma SINCRONA para derivar
 * la clave de cache de cada payload de penalty. `crypto.subtle.digest` es async,
 * asi que aqui implementamos un SHA-1 sincrono en JS puro.
 *
 * Importante: este hash se usa unicamente como clave del cache en memoria del
 * worker (no se persiste ni se compara contra el servidor), por lo que solo
 * necesita ser deterministico. La respuesta ML depende del payload enviado, no
 * de esta clave, de modo que la paridad con testAsinacionKDE se conserva.
 */

function sha1Hex(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const bitLen = bytes.length * 8;

    // Padding: 0x80, ceros, y longitud de 64 bits big-endian.
    const blocks = Math.ceil((bytes.length + 9) / 64);
    const total = blocks * 64;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[bytes.length] = 0x80;

    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    const w = new Uint32Array(80);

    for (let i = 0; i < blocks; i++) {
        const off = i * 64;
        for (let j = 0; j < 16; j++) {
            w[j] = dv.getUint32(off + j * 4, false);
        }
        for (let j = 16; j < 80; j++) {
            const n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
            w[j] = (n << 1) | (n >>> 31);
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;

        for (let j = 0; j < 80; j++) {
            let f: number;
            let k: number;
            if (j < 20) {
                f = (b & c) | (~b & d);
                k = 0x5a827999;
            } else if (j < 40) {
                f = b ^ c ^ d;
                k = 0x6ed9eba1;
            } else if (j < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8f1bbcdc;
            } else {
                f = b ^ c ^ d;
                k = 0xca62c1d6;
            }

            const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0;
            e = d;
            d = c;
            c = ((b << 30) | (b >>> 2)) >>> 0;
            b = a;
            a = t;
        }

        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
    }

    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

class HashStub {
    private _data = '';

    update(data: string | Uint8Array): this {
        this._data += typeof data === 'string' ? data : new TextDecoder().decode(data);
        return this;
    }

    digest(_encoding?: string): string {
        // Solo soportamos hex (el unico uso en @solution).
        return sha1Hex(this._data);
    }
}

export function createHash(_algorithm: string): HashStub {
    return new HashStub();
}

export default { createHash };
