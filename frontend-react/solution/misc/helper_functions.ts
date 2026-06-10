let jsonFiles: Record<string, unknown> = {};

export function setJsonFiles(files: Record<string, unknown>) {
    // Allows injecting the files from the browser directly
    jsonFiles = {};
    for (const [key, value] of Object.entries(files)) {
        jsonFiles[`../ml/files/${key}`] = value;
    }
}

export function loadJsonFile<T = Record<string, unknown>>(filename: string): T {
    const key = `../ml/files/${filename}`;
    const data = jsonFiles[key];

    if (data !== undefined) {
        return data as T;
    }

    // Fallback for Node.js environment (e.g. running scripts with tsx)
    if (typeof window === 'undefined') {
        try {
            const fs = require('fs');
            const path = require('path');
            if (fs && path) {
                let resolvedPath = '';
                if (typeof __dirname !== 'undefined') {
                    resolvedPath = path.resolve(__dirname, '../ml/files', filename);
                } else {
                    const cwd = process.cwd();
                    if (cwd.endsWith('greedy')) {
                        resolvedPath = path.resolve(cwd, '../ml/files', filename);
                    } else if (cwd.endsWith('solution')) {
                        resolvedPath = path.resolve(cwd, 'ml/files', filename);
                    } else {
                        resolvedPath = path.resolve(cwd, 'frontend-react/solution/ml/files', filename);
                    }
                }

                if (fs.existsSync(resolvedPath)) {
                    return JSON.parse(fs.readFileSync(resolvedPath, 'utf-8')) as T;
                }
            }
        } catch (err) {
            console.error(`loadJsonFile (Node.js fallback): failed to read ${filename}`, err);
        }
    }

    console.warn(`Could not load ${filename}: file is not part of the bundled ml/files set.`);
    return {} as T;
}


