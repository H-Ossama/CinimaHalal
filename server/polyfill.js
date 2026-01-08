import { File } from 'node:buffer';

if (typeof globalThis.File === 'undefined') {
    try {
        globalThis.File = File;
    } catch (e) {
        console.warn('Failed to polyfill File API:', e);
    }
}
