// Shared outbound HTTP config for the data scripts.
// One User-Agent for every request (mlbbhub API/pages, wsrv.nl icons), derived
// from package.json so name/version cannot drift apart. The source is a
// community stats site, so we identify the project instead of impersonating a
// browser or a search engine crawler (verified: it does not gate on User-Agent,
// bot UA / "Mozilla/5.0" / full Chrome UA / no UA all return identical bodies).

import pkg from '../package.json' with { type: 'json' };

export const USER_AGENT = `${pkg.name}/${pkg.version}`;

// Pure so it can be unit-tested; explicit per-call headers still win.
export const buildHeaders = (headers) => ({ 'User-Agent': USER_AGENT, ...headers });

export const fetchWithUA = (url, init = {}) => fetch(url, { ...init, headers: buildHeaders(init.headers) });
