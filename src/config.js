import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

export async function loadConfig(filePath) {
    const absolutePath = path.resolve(filePath);

    try {
        const stat = await fs.stat(absolutePath);
        if (!stat.isFile()) {
            throw new Error(`Path is not a file: ${filePath}`);
        }
    } catch (e) {
        throw new Error(`Config file not found: ${filePath}`);
    }

    try {
        if (absolutePath.endsWith('.json')) {
            const content = await fs.readFile(absolutePath, 'utf8');
            return JSON.parse(content);
        } else if (absolutePath.endsWith('.js') || absolutePath.endsWith('.mjs') || absolutePath.endsWith('.cjs')) {
            const module = await import(pathToFileURL(absolutePath));

            let config = module.default || module.config;

            if (!config) {
                throw new Error('JS config must export default object or "config" object');
            }

            // Handle WDIO config structure
            if (Array.isArray(config)) {
                // If it's just an array of capabilities
                return config[0];
            }

            if (config.capabilities) {
                // WDIO config object
                return Array.isArray(config.capabilities) ? config.capabilities[0] : config.capabilities;
            }

            return config;
        } else {
            throw new Error('Unsupported file extension. Use .json, .js, .mjs, or .cjs');
        }
    } catch (error) {
        throw new Error(`Failed to load config: ${error.message}`);
    }
}
