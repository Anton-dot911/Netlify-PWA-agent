// netlify/functions/dune-sim.js
// Direct proxy for Dune Sim API — real-time wallet/token lookups

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BASE_URL = 'https://sim-api.dune.com/v1/evm';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.DUNE_SIM_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'DUNE_SIM_API_KEY не налаштований.', hint: 'Netlify → Site settings → Environment variables' })
    };
  }

  let params;
  try {
    params = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { lookup_type, address, token_address, chain_ids = [8453], limit = 25, offset } = params;

  if (!lookup_type) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'lookup_type required' }) };
  }

  const chainParam = Array.isArray(chain_ids) ? chain_ids.join(',') : chain_ids;
  const jsonHeaders = { ...CORS, 'Content-Type': 'application/json' };

  try {
    let url;
    const q = new URLSearchParams();
    q.set('chain_ids', chainParam);
    if (limit) q.set('limit', String(limit));
    if (offset) q.set('offset', String(offset));

    switch (lookup_type) {
      case 'balances':
        if (!address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'address required for balances' }) };
        q.set('address', address);
        url = `${BASE_URL}/balances?${q}`;
        break;

      case 'activity':
        if (!address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'address required for activity' }) };
        q.set('address', address);
        url = `${BASE_URL}/activity?${q}`;
        break;

      case 'transactions':
        if (!address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'address required for transactions' }) };
        q.set('address', address);
        url = `${BASE_URL}/transactions?${q}`;
        break;

      case 'nfts':
        if (!address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'address required for nfts' }) };
        q.set('address', address);
        q.set('filter_spam', 'true');
        url = `${BASE_URL}/nfts?${q}`;
        break;

      case 'defi-positions':
        if (!address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'address required for defi-positions' }) };
        q.set('address', address);
        url = `${BASE_URL}/defi-positions?${q}`;
        break;

      case 'token-metadata':
        if (!token_address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'token_address required for token-metadata' }) };
        q.set('token_address', token_address);
        url = `${BASE_URL}/token-metadata?${q}`;
        break;

      case 'token-holders':
        if (!token_address) return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'token_address required for token-holders' }) };
        q.set('token_address', token_address);
        url = `${BASE_URL}/token-holders?${q}`;
        break;

      case 'supported-chains':
        url = `${BASE_URL}/supported-chains`;
        break;

      default:
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: `Unknown lookup_type: ${lookup_type}` }) };
    }

    const res = await fetch(url, {
      headers: { 'X-Sim-Api-Key': apiKey, 'Content-Type': 'application/json' }
    });

    const data = await res.json().catch(() => ({ error: 'Non-JSON response from Dune' }));

    if (!res.ok) {
      return { statusCode: res.status, headers: jsonHeaders, body: JSON.stringify({ error: data?.error || `Dune Sim API error ${res.status}`, detail: data }) };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data) };

  } catch (err) {
    console.error('dune-sim error:', err);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
