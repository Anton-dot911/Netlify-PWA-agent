// netlify/functions/dune-query.js
// Proxy for Dune Query API: execute saved queries by ID, poll for results

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const DUNE_BASE = 'https://api.dune.com/api/v1';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.DUNE_API_KEY;
  const jsonHeaders = { ...CORS, 'Content-Type': 'application/json' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { query_id, parameters = {}, action = 'execute' } = body;

  // No API key → return instructions
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        status: 'no_api_key',
        message: 'DUNE_API_KEY не налаштований. Додайте в Netlify → Site settings → Env vars.',
        dune_url: query_id ? `https://dune.com/queries/${query_id}` : 'https://dune.com/queries/new',
        hint: 'Без ключа — відкрийте query вручну на dune.com'
      })
    };
  }

  if (!query_id) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'query_id required' }) };
  }

  try {
    if (action === 'results') {
      // Get latest cached results (no credits spent)
      const res = await fetch(`${DUNE_BASE}/query/${query_id}/results`, {
        headers: { 'X-Dune-Api-Key': apiKey }
      });
      const data = await res.json();
      return { statusCode: res.status, headers: jsonHeaders, body: JSON.stringify(data) };
    }

    // Execute query
    const execRes = await fetch(`${DUNE_BASE}/query/${query_id}/execute`, {
      method: 'POST',
      headers: { 'X-Dune-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_parameters: parameters })
    });

    if (!execRes.ok) {
      const err = await execRes.json().catch(() => ({}));
      return { statusCode: execRes.status, headers: jsonHeaders, body: JSON.stringify({ error: err?.error || `Execution failed: ${execRes.status}` }) };
    }

    const { execution_id } = await execRes.json();

    // Poll for results — max 10 attempts × 3s = 30s
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(`${DUNE_BASE}/execution/${execution_id}/results`, {
        headers: { 'X-Dune-Api-Key': apiKey }
      });
      if (!statusRes.ok) continue;
      const data = await statusRes.json();
      if (data.state === 'QUERY_STATE_COMPLETED') {
        return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ query_id, execution_id, ...data }) };
      }
      if (data.state === 'QUERY_STATE_FAILED') {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Query failed', ...data }) };
      }
    }

    return {
      statusCode: 202,
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'pending', execution_id, message: 'Query still running. Use action=results to fetch later.' })
    };

  } catch (err) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
