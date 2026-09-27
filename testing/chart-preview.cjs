/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness uses the bundled webpack compiler. */
// Compile and serve an isolated fixture page without running Next or loading env files.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const root = path.resolve(__dirname, '..');
const marketMode = process.argv.includes('--market');
const portArgument = process.argv.find(argument => argument.startsWith('--port='));
const port = portArgument ? Number(portArgument.slice(7)) : marketMode ? 4313 : 4312;
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid --port value');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-chart-preview-'));
const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(__dirname, 'preview-bootstrap.ts'),
    output: { path: output, filename: 'chart.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'], alias: {
        '@': path.join(root, 'src'),
        'next/link$': path.join(__dirname, 'preview-link.tsx'),
    } },
    plugins: [new webpack.DefinePlugin({ __SIGNAL_MARKET_PREVIEW__: JSON.stringify(marketMode) })],
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(__dirname, 'chart-preview-loader.cjs') }] },
});
compiler.run(async (error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) {
        console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return;
    }
    const css = await postcss([tailwind({ base: root })]).process(
        '@import "tailwindcss" source(none); @import "./workspace.css"; @source "../components/*.tsx"; @source "../../testing/chart-preview.tsx"; @source "../../testing/market-preview.tsx"; body { margin:0; background:#090e14; color:#edf3fa; font-family:Arial,sans-serif; color-scheme:dark; }',
        { from: path.join(root, 'src/app/preview.css') });
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIGNAL offline ${marketMode ? 'market' : 'chart'} fixture</title><style>${css.css}</style></head><body><div id="preview-error" role="alert" hidden style="margin:20px;padding:16px;border:2px solid #fb7185;color:#ffe4e6;background:#4c0519"></div><noscript>Preview memerlukan JavaScript. Aktifkan JavaScript untuk menampilkan fixture offline.</noscript><div id="root"></div><script src="/chart.js" defer></script></body></html>`;
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'");
        const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
        if (pathname === '/' || (marketMode && /^\/analyze\/[A-Z]{4}$/.test(pathname))) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
        if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const name = pathname.slice(1);
        if (!name || !/^[\w.-]+\.js$/.test(name)) { res.writeHead(404); res.end(); return; }
        const file = path.join(output, name);
        if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type', 'text/javascript'); fs.createReadStream(file).pipe(res);
    });
    server.on('error', error => {
        console.error(error.code === 'EADDRINUSE'
            ? `Port ${port} sedang dipakai. Hentikan preview lama dengan Ctrl+C, lalu jalankan ulang; atau gunakan --port=4314.`
            : error.message);
        process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`Offline fixture ready: http://127.0.0.1:${server.address().port} (no Next, no env, CSP connect-src none)`));
});
