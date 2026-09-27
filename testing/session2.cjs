/* eslint-disable @typescript-eslint/no-require-imports -- This offline verifier is intentionally CommonJS because it transpiles and loads TypeScript with Module._compile. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
global.fetch = () => { throw new Error('Live requests forbidden'); };
function load(relative, aliases = {}) {
    const filename = path.resolve(__dirname, '..', relative);
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = module.paths;
    const originalRequire = mod.require.bind(mod);
    mod.require = name => aliases[name] ?? originalRequire(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    return mod.exports;
}
const data = load('src/lib/chart-data.ts');
const { chartFixture, invalidChartFixture } = load('testing/fixtures/chart.ts');
const { buildChartData, chartSummary, sessionDirection } = data;
const { sessions } = buildChartData(chartFixture);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
assert.equal(sessions.length, 30);
assert.ok(sessions.slice(0, 4).every(row => row.ma5 === null));
near(sessions[4].ma5, 102);
near(sessions[29].ma5, 127);
assert.ok(sessions.slice(0, 19).every(row => row.ma20 === null));
near(sessions[19].ma20, 109.5);
near(sessions[29].ma20, 119.5);
assert.ok(buildChartData(chartFixture.slice(0, 19)).sessions.every(row => row.ma20 === null));
assert.deepEqual(buildChartData([...chartFixture].reverse()), buildChartData(chartFixture));
assert.equal(sessions[0].volume, 1000);
assert.ok(sessionDirection(sessions[0]).startsWith('Turun'));
assert.ok(sessionDirection(sessions[1]).startsWith('Naik'));
assert.ok(sessionDirection(sessions[2]).startsWith('Tetap'));
const invalid = buildChartData(invalidChartFixture);
assert.equal(data.movingAverageSegments(buildChartData(chartFixture.slice(0, 4)).sessions, 'ma5').length, 0);
assert.equal(data.movingAverageSegments(invalid.sessions, 'ma5').length, 2);
assert.equal(data.movingAverageSegments(invalid.sessions, 'ma5')[1][0].time, '2026-09-12');
assert.equal(invalid.omittedCandles, 3);
assert.equal(invalid.omittedVolumes, 1);
assert.equal(invalid.sessions[2].candle, null);
assert.equal(invalid.sessions[2].close, 102); // Valid close still contributes to MA.
near(invalid.sessions[4].ma5, 102);
assert.ok(invalid.sessions.slice(6, 11).every(row => row.ma5 === null));
near(invalid.sessions[11].ma5, 109);
assert.ok(invalid.sessions.slice(6, 26).every(row => row.ma20 === null));
near(invalid.sessions[26].ma20, 116.5);
assert.equal(invalid.sessions[8].volume, null);
for (const change of [{ open: null }, { high: null }, { low: null }, { low: 1000 }, { high: 1 }, { open: Infinity }, { close: 0 }]) {
    assert.equal(buildChartData([{ ...chartFixture[0], ...change }]).sessions[0].candle, null);
}
assert.equal(buildChartData([{ ...chartFixture[0], volume: 0 }]).sessions[0].volume, 0);
const duplicate = buildChartData([...chartFixture, chartFixture[0]]);
assert.equal(duplicate.duplicateDates, 1);
assert.equal(duplicate.sessions[0].candle, null);
assert.equal(duplicate.sessions[4].ma5, null);
near(duplicate.sessions[5].ma5, 103);
assert.equal(buildChartData([{ ...chartFixture[0], date: '2026-02-30' }]).invalidDates, 1);
assert.equal(buildChartData([{ ...chartFixture[0], date: 'invalid' }]).sessions.length, 0);
assert.ok(chartSummary([]).includes('belum tersedia'));
assert.ok(chartSummary(sessions).includes('2026-09-30'));
// Render the real React component on the server: client library must not be loaded here.
const { PriceChart } = load('src/components/PriceChart.tsx', { '@/lib/chart-data': data });
for (const records of [chartFixture, invalidChartFixture, chartFixture.slice(0, 1), []]) {
    const html = renderToStaticMarkup(React.createElement(PriceChart, { records }));
    assert.ok(html.includes('Harga harian'));
    assert.ok(html.includes('Volume hanya konteks'));
    if (records.length) {
        assert.ok(html.includes('tabindex="0"'));
        assert.ok(html.includes('role="status"'));
        assert.ok(html.includes('<table'));
        assert.ok(html.includes('scope="col"'));
        assert.ok(html.includes('Naik: badan kosong'));
    } else assert.ok(html.includes('Data grafik belum tersedia'));
}
console.log('PASS: exact MA 5/20 and warm-up, invalid windows/recovery, OHLC rejection, zero/invalid volume, dates/duplicates/sorting, empty/single session, React SSR and accessible fallback. No network.');
