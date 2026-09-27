/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader executes transpiled TypeScript without a Next server. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

module.exports = function makeLoader(overrides = {}) {
    const root = path.resolve(__dirname, '..');
    const cache = new Map();
    function load(relative) {
        const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
        if (cache.has(filename)) return cache.get(filename).exports;
        const mod = new Module(filename, module);
        mod.filename = filename; mod.paths = module.paths;
        const nativeRequire = mod.require.bind(mod);
        mod.require = name => {
            if (Object.hasOwn(overrides, name)) return overrides[name];
            const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2))
                : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
            if (base) {
                const file = [base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file));
                if (file) return load(file);
            }
            return nativeRequire(name);
        };
        cache.set(filename, mod);
        mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
        } }).outputText, filename);
        return mod.exports;
    }
    return load;
};
