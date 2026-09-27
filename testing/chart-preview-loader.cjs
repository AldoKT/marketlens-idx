/* eslint-disable @typescript-eslint/no-require-imports -- Webpack loaders use Node CommonJS exports. */
const ts = require('typescript');
module.exports = function(source) {
    return ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    }, fileName: this.resourcePath }).outputText;
};
