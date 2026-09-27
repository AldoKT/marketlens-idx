/* eslint-disable @typescript-eslint/no-require-imports -- Node preload for explicitly authorized live smoke only. */
// Never reads env files or inspects/logs headers. Next alone resolves its server credential.
const { channel } = require('node:diagnostics_channel');
const allowed = new Set(['/v2/daily/BBCA/', '/v2/foreign-flow/BBCA/']);
if (process.env.SIGNAL_SMOKE_MARKET === '1') {
    allowed.add('/v2/index-daily/ihsg/');
    for (const symbol of ['BBRI', 'TLKM']) {
        allowed.add(`/v2/daily/${symbol}/`);
        allowed.add(`/v2/foreign-flow/${symbol}/`);
    }
}
const seen = new Set();
const emit = value => console.log('SIGNAL_SMOKE ' + JSON.stringify(value));
const nativeFetch = global.fetch;
channel('undici:request:create').subscribe(({ request }) => {
    if (String(request.origin) === 'https://api.sectors.app') emit({ event: 'wire-request', path: request.path, method: request.method });
});
channel('undici:request:headers').subscribe(({ request, response }) => {
    if (String(request.origin) === 'https://api.sectors.app') emit({ event: 'wire-status', path: request.path, status: response.statusCode });
});
global.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.hostname !== 'api.sectors.app') return nativeFetch(input, options);
    if (!allowed.has(url.pathname) || url.search || seen.has(url.pathname)) {
        emit({ event: 'blocked-request', path: url.pathname });
        throw new Error('Smoke test allows each configured endpoint only once');
    }
    seen.add(url.pathname);
    const response = await nativeFetch(input, options);
    if (response.ok) {
        const body = await response.clone().json();
        const rows = Array.isArray(body) ? body : body.data;
        const finite = value => typeof value === 'number' && Number.isFinite(value);
        const dates = Array.isArray(rows) ? rows.map(row => row.date).sort() : [];
        const stats = { event: 'source-summary', path: url.pathname, shape: Array.isArray(body) ? 'array' : 'object.data', count: rows?.length ?? null, firstDate: dates[0], lastDate: dates.at(-1), duplicateDates: dates.length - new Set(dates).size };
        if (Array.isArray(rows) && url.pathname.includes('/daily/')) {
            stats.invalidOhlc = rows.filter(row => ![row.open, row.high, row.low, row.close].every(value => finite(value) && value > 0) || row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close) || row.low > row.high).length;
            stats.invalidVolume = rows.filter(row => !finite(row.volume) || row.volume < 0).length;
        } else if (Array.isArray(rows) && url.pathname.includes('/foreign-flow/')) {
            stats.invalidNetFlow = rows.filter(row => !finite(row.net_foreign_inflow)).length;
            stats.invalidForeignShare = rows.filter(row => row.foreign_share !== null && (!finite(row.foreign_share) || row.foreign_share < 0 || row.foreign_share > 1)).length;
            stats.buySellChecked = rows.filter(row => finite(row.foreign_buy_idr) && finite(row.foreign_sell_idr)).length;
            stats.buySellMismatches = rows.filter(row => finite(row.foreign_buy_idr) && finite(row.foreign_sell_idr) && Math.abs(row.foreign_buy_idr - row.foreign_sell_idr - row.net_foreign_inflow) > 1).length;
            stats.rangeStart = body.start; stats.rangeEnd = body.end;
        } else if (Array.isArray(rows)) {
            stats.invalidIndexClose = rows.filter(row => !finite(row.price) || row.price <= 0).length;
        }
        emit(stats);
    }
    return response;
};
