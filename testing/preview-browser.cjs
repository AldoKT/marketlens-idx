/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS offline browser regression test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const root = path.resolve(__dirname, '..');
    const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-preview-browser-'));
    const artifacts = path.join(screenshots, 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    const server = spawn(process.execPath, ['testing/chart-preview.cjs', '--market', '--port=0'], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let browser;
    const errors = [], forbidden = [], failedAssets = [];
    try {
        const base = await new Promise((resolve, reject) => {
            let output = '';
            const timeout = setTimeout(() => reject(new Error('Preview startup timed out')), 45_000);
            server.stdout.on('data', chunk => {
                output += chunk.toString();
                const match = /Offline fixture ready: (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
                if (match) { clearTimeout(timeout); resolve(match[1]); }
            });
            server.stderr.on('data', chunk => output += chunk.toString());
            server.on('error', error => { clearTimeout(timeout); reject(error); });
            server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited ${code}: ${output}`)); });
        });
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`); });
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            // Permit only local documents and JS assets, never any API path or external host.
            if (url.origin === base && !url.pathname.startsWith('/api/')) return route.continue();
            forbidden.push(url.href); return route.abort();
        });
        if (process.argv.includes('--baseline')) {
            await page.setViewportSize({ width: 1366, height: 768 });
            await page.goto(`${base}/?scenario=full`);
            await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
            await expect(page.locator('main article:visible')).toHaveCount(3);
            await page.screenshot({ path: path.join(screenshots, 'baseline-landing.png'), fullPage: true });
            await page.getByRole('link', { name: 'Buka analisis BBCA →', exact: true }).click();
            await page.getByRole('button', { name: 'Analisis', exact: true }).click();
            await expect(page.locator('canvas').first()).toBeVisible();
            await page.screenshot({ path: path.join(screenshots, 'baseline-detail.png') });
            await page.locator('#marketlens-report').screenshot({ path: path.join(screenshots, 'baseline-report.png') });
            await page.locator('.observations').screenshot({ path: path.join(screenshots, 'baseline-observations.png') });
            assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
            console.log(`Baseline browser 100%, zero API requests: ${screenshots}`);
            return;
        }
        const cases = [
            ['full', 'Hasil pemuatan: complete.', 3],
            ['partial', 'Hasil pemuatan: partial.', 2],
            ['empty', 'Tidak ada kandidat untuk dipantau', 0],
            ['error', 'Hasil pemuatan: error.', 0],
            ['load-error', 'Request fixture gagal dimuat.', 0],
            ['short', 'Hasil pemuatan: complete.', 0],
            ['index-error', 'Hasil pemuatan: partial.', 3],
            ['review', 'Hasil pemuatan: complete.', 3],
        ];
        for (const [scenario, resultText, cards] of cases) {
            const response = await page.goto(`${base}/?scenario=${scenario}`);
            assert.equal(response.status(), 200);
            assert.match(response.headers()['content-security-policy'], /connect-src 'none'/);
            await expect(page.getByRole('heading', { level: 1 })).toContainText('Pasar dalam konteks.');
            await expect(page.getByRole('combobox', { name: 'Skenario' })).toHaveValue(scenario);
            await expect(page.getByText('Daftar belum dimuat.', { exact: true })).toBeVisible();
            assert.equal(await page.locator('#preview-error').isVisible(), false);
            if (scenario === 'full') await page.screenshot({ path: path.join(artifacts, 'redesign-landing-empty-desktop-100.png') });
            await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Memuat kondisi pasar…', exact: true })).toBeDisabled();
            await expect(page.locator('main')).toContainText(resultText);
            if (scenario === 'partial') await expect(page.getByText('BBRI: Data saham gagal diambil.', { exact: true })).toBeVisible();
            if (scenario === 'error') await expect(page.getByText('IHSG: Data IHSG gagal diambil.', { exact: true })).toBeVisible();
            await expect(page.locator('main article:visible')).toHaveCount(cards);
            if (scenario === 'full') {
                const card = await page.locator('main article').last().boundingBox();
                assert.ok(card.y + card.height <= 950, 'All candidate cards fit initial desktop viewport');
                assert.equal(await page.evaluate(() => window.visualViewport.scale), 1);
                const index = await page.locator('.index-panel').boundingBox();
                const shortlist = await page.locator('.shortlist-panel').boundingBox();
                assert.ok(index.x + index.width <= shortlist.x && index.width > 650);
                await page.screenshot({ path: path.join(artifacts, 'redesign-landing-desktop-100.png') });
                await page.getByRole('group', { name: 'Jelajahi penutupan IHSG' }).focus();
                await page.keyboard.press('Home');
                await expect(page.locator('.index-readout')).toContainText('2026-08-31');
                await page.keyboard.press('End');
                await expect(page.locator('.index-readout')).toContainText('2026-09-25');
                await page.getByRole('img', { name: /IHSG/ }).hover({ position: { x: 68, y: 60 } });
                await expect(page.locator('.index-readout')).toContainText('2026-08-31');
                await page.getByText('Tabel penutupan IHSG (20 sesi)', { exact: true }).click();
                await expect(page.getByRole('table', { name: 'Tanggal dan nilai penutupan indeks dalam poin' })).toBeVisible();
                await page.getByText('Tabel penutupan IHSG (20 sesi)', { exact: true }).click();
            }
            if (['full', 'partial', 'empty'].includes(scenario)) {
                await expect(page.getByRole('img', { name: /IHSG — penutupan harian/ })).toBeVisible();
                await expect(page.locator('main')).toContainText('2026-09-25');
            }
            const colors = await page.locator('main').evaluate(element => ({
                background: getComputedStyle(element).backgroundColor,
                foreground: getComputedStyle(element).color,
                width: element.getBoundingClientRect().width,
            }));
            // Tailwind 4 uses OKLCH; Chrome may preserve that rather than serialize to RGB.
            assert.equal(colors.background, 'rgb(9, 14, 20)');
            assert.equal(colors.foreground, 'rgb(237, 243, 250)');
            assert.ok(colors.width > 0);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            await page.screenshot({ path: path.join(screenshots, `${scenario}.png`), fullPage: true });
            console.log(`PASS browser: ${scenario}, landing + loaded result visible, ${cards} watch cards, assets/CSS loaded`);
        }
        for (const [width, height] of [[1920, 1080], [1366, 768]]) {
            await page.setViewportSize({ width, height });
            assert.equal(await page.evaluate(() => window.visualViewport.scale), 1);
            await page.goto(`${base}/?scenario=review`);
            await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
            await expect(page.locator('main article:visible')).toHaveCount(3);
            await expect(page.locator('.criteria-fraction').first()).toHaveText('1/3');
            await expect(page.locator('.watch-counter').first()).toContainText('Kriteria sideways belum terpenuhi');
            await page.screenshot({ path: path.join(artifacts, `revision2-landing-${width}x${height}.png`) });
            const ihsg = await page.locator('.index-chart svg').boundingBox();
            const lastCard = await page.locator('.watch-card').last().boundingBox();
            console.log(`GEOMETRY ${width}x${height}: IHSG bottom ${Math.round(ihsg.y + ihsg.height)}, shortlist bottom ${Math.round(lastCard.y + lastCard.height)}`);
            assert.ok(ihsg.y + ihsg.height <= height && lastCard.y + lastCard.height <= height, 'IHSG plot and all three rows fit viewport');
            await page.getByRole('link', { name: 'Buka analisis BBCA →', exact: true }).click();
            await page.getByRole('button', { name: 'Analisis', exact: true }).click();
            await expect(page.locator('canvas').first()).toBeVisible();
            await expect(page.locator('.summary-status')).toContainText('unconfirmed');
            await expect(page.locator('.criterion-row')).toHaveCount(3);
            await expect(page.locator('.criterion-row').nth(0)).toContainText('Belum terpenuhi');
            await expect(page.locator('.criterion-row').nth(1)).toContainText('Terpenuhi');
            await expect(page.locator('.criterion-row').nth(2)).toContainText('Belum terpenuhi');
            await page.screenshot({ path: path.join(artifacts, `revision2-detail-${width}x${height}.png`) });
            const canvas = await page.locator('.candle-canvas').boundingBox();
            const criteria = await page.locator('.evidence-panel').boundingBox();
            console.log(`GEOMETRY detail ${width}x${height}: candle/volume bottom ${Math.round(canvas.y + canvas.height)}, criteria bottom ${Math.round(criteria.y + criteria.height)}`);
            assert.ok(canvas.y + canvas.height <= height && criteria.y + criteria.height <= height, 'Candle, volume and criteria fit viewport');
            await expect(page.locator('.observations')).not.toHaveAttribute('open', '');
            await page.locator('#marketlens-report').screenshot({ path: path.join(artifacts, `revision2-report-${width}x${height}.png`) });
            await expect(page.locator('.report-stage')).toHaveCount(6);
            console.log(`REPORT ${width}x${height}: ${Math.round((await page.locator('#marketlens-report').boundingBox()).height)} px, archive initially closed`);
            await page.getByText('Metodologi dan seluruh pengamatan', { exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Bukti bertentangan', exact: true })).toBeVisible();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}/?scenario=full`);
        await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
        await page.getByRole('link', { name: 'Buka analisis BBCA →', exact: true }).click();
        await expect(page).toHaveURL(`${base}/analyze/BBCA?scenario=full`);
        await expect(page.getByRole('heading', { name: 'Analisis BBCA', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Analisis', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Harga harian · candle 1D', exact: true })).toBeVisible();
        await expect(page.locator('canvas').first()).toBeVisible();
        const canvasBounds = await page.locator('.candle-canvas').boundingBox();
        const evidenceBounds = await page.locator('.evidence-panel').boundingBox();
        assert.ok(canvasBounds.y + canvasBounds.height < 1000 && evidenceBounds.x > canvasBounds.x + canvasBounds.width);
        await page.screenshot({ path: path.join(artifacts, 'redesign-detail-desktop-100.png') });
        await page.getByRole('link', { name: 'Periksa bukti', exact: true }).click();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'evidence');
        await expect(page.getByRole('heading', { name: 'Bukti mendukung', exact: true })).toBeVisible();
        await page.getByRole('group', { name: 'Grafik candlestick, MA 5, MA 20, dan volume harian' }).focus();
        await page.keyboard.press('Home');
        await expect(page.getByLabel('Tanggal sesi')).toHaveValue('2026-08-31');
        assert.ok(await page.locator('.candle-canvas').evaluate(element => getComputedStyle(element).outlineStyle !== 'none'));
        await page.getByText('Tabel data grafik (20 sesi)', { exact: true }).click();
        await expect(page.getByRole('table', { name: /Data per sesi/ })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'MA 20', exact: true })).toBeVisible();
        for (const width of [1920, 1280, 1024, 768, 360]) {
            await page.setViewportSize({ width, height: 1000 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            const plot = await page.locator('.candle-canvas').boundingBox();
            assert.ok(plot.width > 200);
        }
        await page.reload(); // Deep link and query strings must also serve HTML on refresh.
        await expect(page.getByRole('heading', { name: 'Analisis BBCA', exact: true })).toBeVisible();
        await page.getByRole('link', { name: '← Beranda MarketLens', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Pasar dalam konteks.');
        for (const width of [1920, 1280, 1024, 768]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(`${base}/?scenario=full`);
            await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
            await expect(page.locator('main article:visible')).toHaveCount(3);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            if (width === 1920) await page.screenshot({ path: path.join(artifacts, 'redesign-landing-wide-100.png') });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${base}/?scenario=full`);
        await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
        await expect(page.locator('main article:visible')).toHaveCount(3);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await page.screenshot({ path: path.join(screenshots, 'mobile.png'), fullPage: true });
        await page.screenshot({ path: path.join(artifacts, 'redesign-landing-mobile.png'), fullPage: true });
        await page.getByLabel('Ticker IDX').fill('bad');
        await page.getByRole('button', { name: 'Buka analisis', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Gunakan ticker IDX empat huruf');
        await page.getByLabel('Ticker IDX').fill('bbca');
        await page.getByRole('button', { name: 'Buka analisis', exact: true }).click();
        await expect(page).toHaveURL(`${base}/analyze/BBCA?scenario=full`);
        await page.getByRole('button', { name: 'Analisis', exact: true }).click();
        await expect(page.locator('canvas').first()).toBeVisible();
        await page.getByText('Tabel data grafik (20 sesi)', { exact: true }).click();
        await expect(page.getByRole('table', { name: /Data per sesi/ })).toBeVisible();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByText('Tabel data grafik (20 sesi)', { exact: true }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(artifacts, 'redesign-detail-mobile.png'), fullPage: true });
        await page.screenshot({ path: path.join(artifacts, 'redesign-detail-mobile-viewport.png') });
        await page.goto(`${base}/?scenario=review`);
        await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
        await expect(page.locator('main article:visible')).toHaveCount(3);
        await page.screenshot({ path: path.join(artifacts, 'revision2-landing-mobile.png'), fullPage: true });
        await page.getByRole('link', { name: 'Buka analisis BBCA →', exact: true }).click();
        await page.getByRole('button', { name: 'Analisis', exact: true }).click();
        await expect(page.locator('canvas').first()).toBeVisible();
        await page.screenshot({ path: path.join(artifacts, 'revision2-detail-mobile.png'), fullPage: true });
        for (const scenario of ['short', 'error']) {
            await page.goto(`${base}/analyze/BBCA?scenario=${scenario}`);
            await page.getByRole('button', { name: 'Analisis', exact: true }).click();
            if (scenario === 'error') await expect(page.getByRole('alert')).toContainText('Analisis fixture gagal dimuat.');
            else {
                await expect(page.locator('.summary-status')).toContainText('insufficient_data');
                await expect(page.locator('canvas').first()).toBeVisible();
            }
        }
        for (const scenario of ['partial', 'empty', 'error', 'load-error']) {
            await page.goto(`${base}/?scenario=${scenario}`);
            await page.getByRole('button', { name: 'Muat kondisi pasar', exact: true }).click();
            await expect(page.locator('main article:visible')).toHaveCount(scenario === 'partial' ? 2 : 0);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        }
        assert.deepEqual(forbidden, [], 'No external requests or Sectors-backed application endpoint requests');
        assert.deepEqual(failedAssets, [], 'No failed document/JS asset requests');
        assert.deepEqual(errors, [], 'No runtime/console errors');
        console.log('PASS: deep links/reload/navigation, real candlestick canvas, mobile layout; zero runtime errors and zero API/external requests.');
        const failurePage = await browser.newPage();
        await failurePage.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== base || url.pathname.startsWith('/api/')) return route.abort();
            // Deliberately fail a lazy module chunk to verify visible boot diagnostics.
            return url.pathname.endsWith('.js') && url.pathname !== '/chart.js' ? route.abort() : route.continue();
        });
        await failurePage.goto(`${base}/?scenario=full`);
        await expect(failurePage.locator('#preview-error')).toContainText('Preview offline gagal dimuat:');
        await expect(failurePage.locator('#preview-error')).toBeVisible();
        await failurePage.close();
        console.log('PASS: failed JavaScript chunk displays an error panel instead of a silent blank screen.');
        console.log(`Screenshots: ${screenshots}`);
    } finally {
        await browser?.close();
        server.kill();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
