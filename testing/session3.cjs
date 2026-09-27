/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests share the CommonJS transpilation harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const makeLoader = require('./offline-load.cjs');
global.fetch = () => { throw new Error('Live network forbidden'); };
const load = makeLoader({ 'server-only': {} });
const { MARKET_CONFIG, marketRequestBudget, marketCreditEstimate, normalizeTicker, validTicker } = load('src/lib/market-config.ts');
const { loadMarketOverview, rankStocks, isWatchCandidate, summarizeIndex } = load('src/lib/market-overview.ts');
const { marketFixtureSource, stockFixture, indexFixture } = load('testing/fixtures/market.ts');
const { MarketLanding } = load('src/components/MarketLanding.tsx');
const { StockAnalysis } = load('src/components/StockAnalysis.tsx');
async function main() {
    assert.equal(marketRequestBudget(), 7);
    assert.equal(marketCreditEstimate(), 7);
    assert.equal(marketRequestBudget(5), 11);
    assert.equal(normalizeTicker(' bbca '), 'BBCA');
    assert.equal(validTicker('BBCA'), true);
    assert.equal(validTicker('BBCA.JK'), false);
    const full = await loadMarketOverview(marketFixtureSource());
    assert.equal(full.status, 'complete');
    assert.deepEqual(full.universe, ['BBCA', 'BBRI', 'TLKM']);
    assert.deepEqual(full.universe, MARKET_CONFIG.symbols);
    assert.deepEqual(full.stocks.map(stock => stock.symbol), ['BBCA', 'BBRI', 'TLKM']);
    assert.deepEqual(full.stocks.map(stock => stock.analysis.investigation.criteriaMet), [3, 3, 2]);
    assert.deepEqual(rankStocks([...full.stocks].reverse()), full.stocks);
    assert.equal(full.ihsg.asOfDate, '2026-09-25');
    assert.equal(full.ihsg.changePoints, 5);
    assert.equal(full.ihsg.condition, 'naik');
    assert.equal(full.estimatedColdCredits, 7);
    assert.equal(full.cacheTtlSeconds, 86400);
    const partial = await loadMarketOverview(marketFixtureSource('partial'));
    assert.equal(partial.status, 'partial'); assert.equal(partial.stocks.length, 2);
    assert.deepEqual(partial.failures.map(item => item.symbol), ['BBRI']);
    const indexError = await loadMarketOverview(marketFixtureSource('index-error'));
    assert.equal(indexError.status, 'partial'); assert.equal(indexError.stocks.length, 3);
    const indexEmpty = await loadMarketOverview(marketFixtureSource('index-empty'));
    assert.equal(indexEmpty.status, 'partial');
    const error = await loadMarketOverview(marketFixtureSource('error'));
    assert.equal(error.status, 'error'); assert.equal(error.failures.length, 4);
    const empty = await loadMarketOverview(marketFixtureSource('empty'));
    assert.equal(empty.stocks.filter(isWatchCandidate).length, 0);
    const short = await loadMarketOverview(marketFixtureSource('short'));
    assert.ok(short.stocks.every(stock => stock.analysis.investigation.status === 'insufficient_data'));
    let called = 0;
    await assert.rejects(loadMarketOverview({ index: async () => { called++; return []; }, stock: async () => { called++; } }, Array(6).fill('BBCA')));
    assert.equal(called, 0);
    await assert.rejects(loadMarketOverview(marketFixtureSource(), ['BBCA', 'BBCA']));
    assert.equal(summarizeIndex([]).condition, 'insufficient_data');
    assert.equal(summarizeIndex(indexFixture.slice(0, 1)).changePercent, null);
    assert.equal(summarizeIndex([{ date: '2026-09-25', close: 0 }, { date: '2026-02-30', close: 100 }]).omittedRows, 2);
    assert.equal(summarizeIndex([indexFixture[0], indexFixture[0]]).records.length, 0);
    // Rendering pages/fixtures must not invoke the source, even when an initial result is present.
    const forbidden = () => { throw new Error('Loader invoked during render'); };
    for (const initialOverview of [null, full, partial, error, empty, short, indexError]) {
        const html = renderToStaticMarkup(React.createElement(MarketLanding, { initialOverview, loadOverview: forbidden }));
        assert.ok(html.includes('Kandidat untuk Dipantau'));
        assert.ok(html.includes('Muat kondisi pasar'));
        assert.ok(html.includes('BBCA, BBRI, TLKM'));
        assert.ok(html.includes('market-grid') && html.includes('Konteks pasar IHSG'));
        assert.ok(html.includes('Metodologi &amp; pemuatan data'));
        assert.ok(!html.includes('real-time'));
        if (initialOverview?.stocks.length) assert.ok(html.includes('/analyze/BBCA'));
        if (initialOverview?.ihsg?.records.length) assert.ok(html.includes('2026-09-25') && html.includes('<polyline'));
        if (initialOverview === empty) assert.ok(html.includes('Tidak ada kandidat'));
        if (initialOverview === partial) assert.ok(html.includes('BBRI: Data saham gagal diambil'));
    }
    const detail = stockFixture('BBCA');
    const review = stockFixture('BBCA', 'review');
    assert.deepEqual(review.analysis.investigation.criteria.map(item => item.met), [false, true, false]);
    assert.equal(review.analysis.investigation.criteriaMet, 1);
    const { shortlistFacts, criterionFact } = load('src/components/investigation-display.ts');
    assert.ok(shortlistFacts(review.analysis).counter.includes('Kriteria sideways belum terpenuhi'));
    assert.ok(shortlistFacts(review.analysis).support.includes('Posisi bawah'));
    const missing = stockFixture('BBCA', 'short');
    assert.ok(criterionFact(missing.analysis, missing.analysis.investigation.criteria[0]).detail.includes('belum cukup'));
    const detailHtml = renderToStaticMarkup(React.createElement(StockAnalysis, { symbol: 'BBCA', initialResult: detail, loadAnalysis: forbidden }));
    assert.ok(detailHtml.includes('candle 1D') && detailHtml.includes(detail.report.headline));
    // Every original report string remains available even when its disclosure is closed.
    const originalStrings = [detail.report.headline, detail.report.summary, ...detail.report.evidence,
        ...detail.report.supportingEvidence, ...detail.report.contradictingEvidence,
        ...detail.report.watchNext, ...Object.values(detail.report.signal).flat()];
    for (const value of originalStrings) {
        const escaped = renderToStaticMarkup(React.createElement('span', null, value)).slice(6, -7);
        assert.ok(detailHtml.includes(escaped), `Original report content preserved: ${value.slice(0, 35)}`);
    }
    assert.ok(detailHtml.includes('Metodologi dan seluruh pengamatan'));
    for (const label of ['Bukti mendukung', 'Bukti bertentangan', 'Spot', 'Investigate', 'Gauge', 'Narrative', 'Assess', 'Look Ahead']) assert.ok(detailHtml.includes(label));
    for (const id of ['price-chart', 'evidence', 'marketlens-report']) assert.ok(detailHtml.includes(`href="#${id}"`) && detailHtml.includes(`id="${id}"`));
    const firstDetail = renderToStaticMarkup(React.createElement(StockAnalysis, { symbol: 'BBCA', loadAnalysis: forbidden }));
    assert.ok(firstDetail.includes('Data belum dimuat otomatis'));
    // Test the server adapter with a fully local fetch mock, never native fetch.
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/index-daily/ihsg/')) return Response.json(indexFixture.map(row => ({ index_code: 'IHSG', date: row.date, price: row.close })));
        const symbol = url.split('/').at(-2);
        const fixture = stockFixture(symbol);
        if (url.includes('/daily/')) return Response.json(fixture.records);
        if (url.includes('/foreign-flow/')) return Response.json({ data: fixture.records });
        throw new Error('Unexpected adapter path');
    };
    const sectors = load('src/lib/sectors.ts');
    assert.equal(calls.length, 0); // Module import is inert.
    const adapted = await loadMarketOverview({ index: () => sectors.getIhsgRecords('fixture-key'), stock: symbol => sectors.getStockAnalysis(symbol, 'fixture-key') });
    assert.equal(calls.length, 7);
    assert.deepEqual(adapted, full);
    for (const call of calls) {
        assert.equal(call.options.cache, 'force-cache');
        assert.equal(call.options.next.revalidate, 86400);
        assert.equal(call.options.redirect, 'error');
    }
    global.fetch = () => { throw new Error('Live network forbidden'); };
    // Loading is event-driven: no effect initiates a request on either page.
    for (const file of ['src/components/MarketLanding.tsx', 'src/components/StockAnalysis.tsx']) {
        assert.ok(!fs.readFileSync(path.join(__dirname, '..', file), 'utf8').includes('useEffect'));
    }
    console.log('PASS: stable ranking/ties, dates/IHSG price mapping, 7-request budget/TTL, partial/index/total failures, empty/insufficient cases, bounded universe, landing/detail SSR without loading, existing chart/report preserved. All sources mocked; no network.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
