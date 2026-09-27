/* eslint-disable @typescript-eslint/no-require-imports -- This offline verifier is intentionally CommonJS because it transpiles and loads TypeScript with Module._compile. */
// Offline verification: only load the two pure libraries, never the API route.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
global.fetch = () => { throw new Error('Network forbidden in Session 1 verification'); };
function load(relative) {
    const filename = path.resolve(__dirname, '..', relative);
    const source = fs.readFileSync(filename, 'utf8');
    const code = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = module.paths;
    mod._compile(code, filename);
    return mod.exports;
}
const { analyzeMarket } = load('src/lib/analyze.ts');
const { createMarketReport } = load('src/lib/report.ts');
// Fictional dates and values, explicitly not BBCA market observations.
const candidate = [100, 102, 101, 103, 102, 101, 102, 101, 100, 100].map((close, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    close, volume: i < 5 ? 1000 : 1500,
    net_foreign_inflow: i === 8 ? -1000000 : 2000000,
}));
function check(records, status, count) {
    const analysis = analyzeMarket(records);
    assert.equal(analysis.investigation.status, status);
    assert.equal(analysis.investigation.criteriaMet, count);
    const report = createMarketReport('TEST', analysis);
    for (const key of ['headline', 'summary']) assert.equal(typeof report[key], 'string');
    for (const key of ['evidence', 'watchNext']) assert.ok(Array.isArray(report[key]));
    assert.ok(report.summary.includes('belum diperiksa'));
    assert.equal(Object.keys(report.signal).length, 6);
    assert.equal(report.supportingEvidence.length, count);
    assert.equal(report.contradictingEvidence.length, analysis.investigation.criteria.filter(c => c.met === false).length);
    assert.ok(report.signal.gauge.includes('bukan bukti otomatis'));
    return { analysis, report };
}
const result = check(candidate, 'candidate', 3);
assert.equal(result.analysis.price.state, 'sideways');
assert.equal(result.analysis.price.rangePercent, 3);
assert.equal(result.analysis.price.netChangePercent, 0);
assert.equal(result.analysis.foreignFlow.netFlowIdr, 7000000);
assert.equal(result.analysis.volume.recentAverage, 1500);
assert.equal(result.analysis.volume.previousAverage, 1000);
assert.equal(result.analysis.volume.changePercent, 50);
assert.equal(result.analysis.volume.ratio, 1.5);
assert.deepEqual(analyzeMarket([...candidate].reverse()), result.analysis);
check(candidate.map(row => ({ ...row, net_foreign_inflow: -1 })), 'unconfirmed', 2);
check(candidate.map((row, i) => ({ ...row, close: 100 + 10 * i, net_foreign_inflow: -1 })), 'not_matching', 0);
check([], 'insufficient_data', 0);
check(candidate.slice(-5), 'insufficient_data', 1);
check(candidate.map(row => ({ ...row, close: NaN })), 'insufficient_data', 1);
check(candidate.map(row => ({ ...row, net_foreign_inflow: NaN })), 'insufficient_data', 2);
check(candidate.map(row => ({ ...row, date: candidate[0].date })), 'insufficient_data', 0);
const noVolume = check(candidate.map(row => ({ ...row, volume: NaN })), 'candidate', 3);
assert.equal(noVolume.analysis.volume.state, 'insufficient_data');
const zeroBaseline = check(candidate.map((row, i) => ({ ...row, volume: i < 5 ? 0 : 1500 })), 'candidate', 3);
assert.equal(zeroBaseline.analysis.volume.ratio, null);
assert.equal(zeroBaseline.analysis.volume.changePercent, null);
check(candidate.map(row => ({ ...row, close: 100 })), 'unconfirmed', 2);
assert.equal(analyzeMarket(candidate.slice(-9)).volume.state, 'insufficient_data');
assert.equal(analyzeMarket(candidate.map(row => ({ ...row, volume: -1 }))).volume.state, 'insufficient_data');
console.log('PASS: candidate, unconfirmed, not_matching, insufficient_data; legacy fields; periods; volume; invalid/duplicate data; flat price; sorting. No network.');
console.log('BBCA: skipped — no existing local fixture in repository. TEST is synthetic, not BBCA.');
if (process.argv.includes('--example')) {
    console.log(JSON.stringify({ symbol: 'TEST', as_of_date: result.analysis.asOfDate,
        record_count: candidate.length, ...result, records: candidate }, null, 2));
}
