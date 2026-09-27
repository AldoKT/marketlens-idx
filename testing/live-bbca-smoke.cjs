/* eslint-disable @typescript-eslint/no-require-imports -- Explicit one-click browser integration smoke. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');

async function main() {
    if (!process.argv.includes('--live-bbca')) throw new Error('Explicit --live-bbca required; costs up to two Sectors requests. No retry.');
    const root = path.resolve(__dirname, '..');
    const events = [];
    const server = spawn(process.execPath, ['--require', path.join(__dirname, 'live-request-guard.cjs'), 'node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '4315'], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    });
    let browser;
    let ready = false;
    let textBuffer = '';
    server.stdout.on('data', chunk => {
        const text = chunk.toString();
        if (/Ready in/.test(text)) ready = true;
        textBuffer += text;
        const lines = textBuffer.split('\n'); textBuffer = lines.pop();
        for (const line of lines) {
            const index = line.indexOf('SIGNAL_SMOKE ');
            if (index >= 0) { try { events.push(JSON.parse(line.slice(index + 13))); } catch { /* Ignore incomplete non-JSON CLI lines. */ } }
        }
    });
    // Do not forward Next logs/errors: only selected safe aggregate fields leave this test.
    server.stderr.on('data', () => {});
    try {
        await new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (ready) { clearInterval(timer); resolve(); }
                else if (server.exitCode !== null || Date.now() - started > 45_000) { clearInterval(timer); reject(new Error('Next startup failed/timed out; no analysis click performed.')); }
            }, 200);
            server.on('error', () => { clearInterval(timer); reject(new Error('Next process launch failed')); });
        });
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const apiCalls = [], runtimeErrors = [];
        page.on('pageerror', () => runtimeErrors.push('Browser runtime error'));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:4315') return route.abort();
            if (url.pathname.startsWith('/api/')) {
                if (url.pathname !== '/api/analyze' || url.search !== '?symbol=BBCA' || apiCalls.length) return route.abort();
                apiCalls.push(url.pathname + url.search);
            }
            return route.continue();
        });
        await page.goto('http://127.0.0.1:4315/analyze/BBCA', { timeout: 90_000 });
        await expect(page.getByRole('heading', { name: 'Analisis BBCA', exact: true })).toBeVisible({ timeout: 30_000 });
        assert.equal(apiCalls.length, 0);
        assert.equal(events.filter(event => event.event === 'wire-request').length, 0);
        const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/analyze', { timeout: 60_000 });
        await page.getByRole('button', { name: 'Analisis', exact: true }).click();
        const response = await responsePromise;
        const body = await response.json();
        console.log(JSON.stringify({ applicationStatus: response.status(), analysisClicks: 1, applicationRequests: apiCalls.length, sectorsWireRequests: events.filter(event => event.event === 'wire-request').length, sourceEvents: events }, null, 2));
        if (!response.ok()) throw new Error('BBCA application response failed; no second click or retry.');
        await expect(page.getByRole('heading', { name: `Status ${body.analysis.investigation.status}`, exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Laporan SIGNAL', exact: true })).toBeVisible();
        await expect(page.locator('canvas').first()).toBeVisible();
        const records = body.records;
        assert.equal(body.record_count, records.length);
        assert.equal(body.as_of_date, records.at(-1).date);
        assert.equal(new Set(records.map(row => row.date)).size, records.length);
        assert.ok(records.every((row, index) => !index || records[index - 1].date < row.date));
        const finite = value => typeof value === 'number' && Number.isFinite(value);
        console.log(JSON.stringify({ symbol: body.symbol, lastDate: body.as_of_date, firstDate: records[0]?.date, recordCount: records.length, status: body.analysis.investigation.status, criteriaMet: body.analysis.investigation.criteriaMet, invalidClose: records.filter(row => !finite(row.close) || row.close <= 0).length, invalidVolume: records.filter(row => !finite(row.volume) || row.volume < 0).length, invalidNetFlow: records.filter(row => !finite(row.net_foreign_inflow)).length, analysisRendered: true, reportRendered: true, chartRendered: true, runtimeErrors: runtimeErrors.length }, null, 2));
        assert.deepEqual(runtimeErrors, []);
        assert.ok(!events.some(event => event.event === 'blocked-request'));
        assert.ok(events.filter(event => event.event === 'wire-request').length <= 2);
    } finally {
        await browser?.close();
        // Stop only this test-owned Next process tree; never an existing user server.
        if (process.platform === 'win32' && server.pid) await new Promise(resolve => {
            const stop = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
            stop.on('exit', resolve); stop.on('error', resolve);
        });
        else server.kill();
    }
}
main().catch(() => { console.error('Smoke stopped with a startup, validation, or application failure. No live retry.'); process.exitCode = 1; });
