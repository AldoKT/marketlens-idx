/* eslint-disable @typescript-eslint/no-require-imports -- Explicit, bounded live browser smoke; never part of offline regression. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');

async function main() {
    if (!process.argv.includes('--live-market')) throw new Error('Explicit --live-market required. Maximum seven Sectors requests; one click, no retry.');
    const root = path.resolve(__dirname, '..');
    const events = [];
    const server = spawn(process.execPath, ['--require', path.join(__dirname, 'live-request-guard.cjs'), 'node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '4315'], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SIGNAL_SMOKE_MARKET: '1' },
    });
    let browser, ready = false, buffer = '';
    server.stdout.on('data', chunk => {
        const text = chunk.toString();
        if (/Ready in/.test(text)) ready = true;
        buffer += text;
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
            const index = line.indexOf('SIGNAL_SMOKE ');
            if (index >= 0) { try { events.push(JSON.parse(line.slice(index + 13))); } catch { /* Non-JSON CLI output is never forwarded. */ } }
        }
    });
    server.stderr.on('data', () => {});
    try {
        await new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (ready) { clearInterval(timer); resolve(); }
                else if (server.exitCode !== null || Date.now() - started > 45_000) { clearInterval(timer); reject(new Error('Next startup failed; no click.')); }
            }, 200);
            server.on('error', () => { clearInterval(timer); reject(new Error('Next launch failed')); });
        });
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const calls = [], runtimeErrors = [];
        page.on('pageerror', () => runtimeErrors.push('Runtime error'));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:4315') return route.abort();
            if (url.pathname.startsWith('/api/')) {
                if (url.pathname !== '/api/market' || url.search || route.request().method() !== 'POST' || calls.length) return route.abort();
                calls.push('POST /api/market');
            }
            return route.continue();
        });
        await page.goto('http://127.0.0.1:4315/', { timeout: 90_000 });
        await expect(page.getByRole('heading', { name: 'Kandidat untuk Dipantau', exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Daftar belum dimuat.', { exact: true })).toBeVisible();
        assert.equal(calls.length, 0);
        assert.equal(events.filter(event => event.event === 'wire-request').length, 0);
        assert.equal(await page.getByText(/Preview offline/).count(), 0);
        const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/market', { timeout: 60_000 });
        await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
        const response = await responsePromise;
        const body = await response.json();
        // Only aggregates, whitelisted endpoint paths and HTTP statuses; never headers or raw response.
        console.log(JSON.stringify({ applicationHttp: response.status(), clicks: 1, applicationRequests: calls.length,
            sectorsWireRequests: events.filter(event => event.event === 'wire-request').length,
            endpointStatuses: events.filter(event => ['wire-request', 'wire-status', 'blocked-request'].includes(event.event)),
            sourceSummaries: events.filter(event => event.event === 'source-summary'),
            overviewStatus: body.status, failures: body.failures ?? [],
            ihsg: body.ihsg ? { lastDate: body.ihsg.asOfDate, records: body.ihsg.records.length, latestClose: body.ihsg.latestClose, condition: body.ihsg.condition } : null,
            ranking: body.stocks?.map(stock => ({ symbol: stock.symbol, lastDate: stock.as_of_date, records: stock.record_count, status: stock.analysis.investigation.status, criteria: stock.analysis.investigation.criteriaMet })),
        }, null, 2));
        if (!response.ok()) throw new Error('Application failed; no retry.');
        await expect(page.locator('main')).toContainText(`Hasil pemuatan: ${body.status}.`);
        assert.deepEqual(body.universe, ['BBCA', 'BBRI', 'TLKM']);
        assert.equal(body.maxSectorsRequests, 7);
        const watch = body.stocks.filter(stock => ['candidate', 'unconfirmed'].includes(stock.analysis.investigation.status));
        await expect(page.locator('main article:visible')).toHaveCount(watch.length);
        const cards = page.locator('main article:visible');
        for (let index = 0; index < watch.length; index++) {
            const stock = watch[index];
            await expect(cards.nth(index).getByRole('heading', { level: 3 })).toHaveText(stock.symbol);
            await expect(cards.nth(index)).toContainText(`Status ${stock.analysis.investigation.status}`);
            await expect(cards.nth(index)).toContainText(`Data hingga ${stock.as_of_date}`);
            await cards.nth(index).locator('summary').click();
            if (stock.report.supportingEvidence.length) await expect(cards.nth(index)).toContainText(stock.report.supportingEvidence[0]);
        }
        if (body.ihsg?.records.length) {
            await expect(page.getByRole('img', { name: /IHSG/ })).toBeVisible();
            await expect(page.getByRole('img', { name: /IHSG/ }).locator('polyline')).toHaveAttribute('points', /\d/);
            await expect(page.locator('main')).toContainText(`Data hingga ${body.ihsg.asOfDate}`);
        }
        assert.deepEqual(runtimeErrors, []);
        assert.ok(events.filter(event => event.event === 'wire-request').length <= 7);
        assert.ok(!events.some(event => event.event === 'blocked-request'));
        console.log(JSON.stringify({ liveNextPage: true, fixtureImports: false, visibleWatchRanking: watch.map(stock => stock.symbol), cardsMatchLiveResponse: true, ihsgChartRendered: !!body.ihsg?.records.length, runtimeErrors: runtimeErrors.length, noRetry: true }));
    } finally {
        await browser?.close();
        if (process.platform === 'win32' && server.pid) await new Promise(resolve => {
            const stop = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
            stop.on('exit', resolve); stop.on('error', resolve);
        });
        else server.kill();
    }
}
main().catch(() => { console.error('Market smoke stopped on startup/application/validation failure. No live retry. Use offline fixtures for diagnosis.'); process.exitCode = 1; });
