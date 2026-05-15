// netlify/functions/claude-proxy.js
// Agentic Claude orchestrator: routes user intent → Dune Sim API or Dune SQL

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── SKILL.md system prompt ───────────────────────────────────
const SYSTEM_PROMPT = `You are a Dune Analytics AI Agent — expert in blockchain data across 130+ chains.

## Decision Rule (CRITICAL)
- User mentions specific wallet/token ADDRESS → use dune_sim_lookup
- User wants analytics, trends, aggregations, top traders → use dune_sql_query
- General blockchain question → answer directly from knowledge

## Chain IDs
- Ethereum: 1 | Base: 8453 | Optimism: 10 | Arbitrum: 42161 | Polygon: 137 | BNB: 56

## DuneSQL Best Practices
Always add WHERE block_time >= NOW() - INTERVAL 'N' DAY for performance.
Use varbinary for addresses: WHERE taker = 0xda905...  (NOT quoted string).
Filter bots: AND taker != 0x1111111254EEB25477B68fb85Ed929f73A960582 -- 1inch router
Common tables: dex.trades, dex_aggregator.trades, tokens.erc20, prices.usd

## After receiving tool results
Provide a clear, structured analysis in Ukrainian or English (match user language).
Format numbers with thousands separators. Show USD values where available.
Highlight key insights. If data is empty, explain why and suggest alternatives.`;

// ── Tool definitions (Anthropic tool-use format) ─────────────
const TOOLS = [
  {
    name: 'dune_sim_lookup',
    description: 'Real-time on-chain lookup by wallet or token address using Dune Sim API. Use for: token balances, wallet activity, NFT holdings, DeFi positions, transaction history, token metadata, token holder leaderboard.',
    input_schema: {
      type: 'object',
      properties: {
        lookup_type: {
          type: 'string',
          enum: ['balances', 'activity', 'transactions', 'nfts', 'defi-positions', 'token-metadata', 'token-holders'],
          description: 'Type of data to fetch'
        },
        address: { type: 'string', description: 'Wallet address (for balances, activity, transactions, nfts, defi-positions)' },
        token_address: { type: 'string', description: 'Token contract address (for token-metadata, token-holders)' },
        chain_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Chain IDs to query. Default [8453] for Base. Use [1] for Ethereum, [8453,10,1] for multi-chain.'
        },
        limit: { type: 'number', description: 'Max results (default 25, max 100)' }
      },
      required: ['lookup_type', 'chain_ids']
    }
  },
  {
    name: 'dune_sql_query',
    description: 'Generate and execute DuneSQL for blockchain analytics: top traders, DEX volume, protocol stats, token flows, NFT trends. Use when user needs aggregations or custom analytics — NOT for specific address lookups.',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Valid DuneSQL query. Must include LIMIT <= 100. Filter by block_time for performance. Use varbinary for addresses.'
        },
        title: { type: 'string', description: 'Short descriptive title for this query (e.g. "Top Aerodrome traders on Base")' },
        saved_query_id: {
          type: 'string',
          description: 'Optional: if user has a Dune saved query ID, provide it to execute that instead of ad-hoc SQL'
        }
      },
      required: ['title']
    }
  }
];

// ── Dune Sim API caller ───────────────────────────────────────
async function callDuneSimAPI(input, apiKey) {
  if (!apiKey) {
    return {
      error: 'DUNE_SIM_API_KEY not configured in Netlify env vars',
      hint: 'Add DUNE_SIM_API_KEY in Netlify → Site settings → Environment variables'
    };
  }

  const { lookup_type, address, token_address, chain_ids = [8453], limit = 25 } = input;
  const chainParam = chain_ids.join(',');
  const BASE = 'https://sim-api.dune.com/v1/evm';

  let url;
  switch (lookup_type) {
    case 'balances':
      url = `${BASE}/balances?address=${address}&chain_ids=${chainParam}`;
      break;
    case 'activity':
      url = `${BASE}/activity?address=${address}&chain_ids=${chainParam}&limit=${limit}`;
      break;
    case 'transactions':
      url = `${BASE}/transactions?address=${address}&chain_ids=${chainParam}&limit=${limit}`;
      break;
    case 'nfts':
      url = `${BASE}/nfts?address=${address}&chain_ids=${chainParam}&filter_spam=true`;
      break;
    case 'defi-positions':
      url = `${BASE}/defi-positions?address=${address}&chain_ids=${chainParam}`;
      break;
    case 'token-metadata':
      url = `${BASE}/token-metadata?token_address=${token_address}&chain_ids=${chainParam}`;
      break;
    case 'token-holders':
      url = `${BASE}/token-holders?token_address=${token_address}&chain_ids=${chainParam}&limit=${limit}`;
      break;
    default:
      return { error: `Unknown lookup_type: ${lookup_type}` };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'X-Sim-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return { error: `Dune Sim API ${res.status}: ${errText}`, url };
    }

    return await res.json();
  } catch (err) {
    return { error: `Network error calling Dune Sim API: ${err.message}` };
  }
}

// ── Dune Query API caller ─────────────────────────────────────
async function callDuneQueryAPI(input, apiKey) {
  const { sql, title, saved_query_id } = input;

  // If a saved query ID is provided, execute it
  if (saved_query_id && apiKey) {
    try {
      // Step 1: Execute
      const execRes = await fetch(`https://api.dune.com/api/v1/query/${saved_query_id}/execute`, {
        method: 'POST',
        headers: { 'X-Dune-Api-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query_parameters: {} })
      });

      if (!execRes.ok) {
        const err = await execRes.json().catch(() => ({}));
        return { error: err?.error || `Execution failed: ${execRes.status}` };
      }

      const { execution_id } = await execRes.json();

      // Step 2: Poll for results (max 30s)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await fetch(`https://api.dune.com/api/v1/execution/${execution_id}/results`, {
          headers: { 'X-Dune-Api-Key': apiKey }
        });
        if (!statusRes.ok) continue;
        const data = await statusRes.json();
        if (data.state === 'QUERY_STATE_COMPLETED') return { title, execution_id, ...data };
        if (data.state === 'QUERY_STATE_FAILED') return { error: 'Query failed', ...data };
      }

      return { error: 'Query timeout (>30s). Try running directly on dune.com', execution_id };

    } catch (err) {
      return { error: `Dune Query API error: ${err.message}` };
    }
  }

  // No saved query ID or no API key — return generated SQL with instructions
  return {
    title,
    generated_sql: sql || 'No SQL provided',
    dune_url: 'https://dune.com/queries/new',
    instructions: [
      '1. Відкрийте https://dune.com/queries/new',
      '2. Вставте SQL нижче в редактор',
      '3. Натисніть "Run" для виконання',
      'Або додайте DUNE_API_KEY в Netlify Env Vars для прямого виконання'
    ],
    note: !apiKey
      ? 'DUNE_API_KEY not configured — SQL generated but not executed'
      : 'Add saved_query_id to execute a Dune saved query directly'
  };
}

// ── Main handler ──────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY не налаштований. Додайте в Netlify → Site settings → Environment variables.' })
    };
  }

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages array required');
  } catch (e) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }

  const jsonHeaders = { ...CORS, 'Content-Type': 'application/json' };

  try {
    // ── Step 1: Call Claude with tool definitions ──────────────
    const claudeRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages, tools: TOOLS })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return { statusCode: claudeRes.status, headers: jsonHeaders, body: JSON.stringify({ error: err?.error?.message || `Claude API error ${claudeRes.status}` }) };
    }

    const claudeData = await claudeRes.json();
    const toolUseBlock = claudeData.content?.find(b => b.type === 'tool_use');

    // No tool call — Claude answered directly
    if (!toolUseBlock) {
      const textBlock = claudeData.content?.find(b => b.type === 'text');
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ type: 'text', content: textBlock?.text || '' }) };
    }

    // ── Step 2: Execute the tool ───────────────────────────────
    const toolName = toolUseBlock.name;
    const toolInput = toolUseBlock.input;
    let toolResult;

    if (toolName === 'dune_sim_lookup') {
      toolResult = await callDuneSimAPI(toolInput, process.env.DUNE_SIM_API_KEY);
    } else if (toolName === 'dune_sql_query') {
      toolResult = await callDuneQueryAPI(toolInput, process.env.DUNE_API_KEY);
    } else {
      toolResult = { error: `Unknown tool: ${toolName}` };
    }

    // ── Step 3: Send tool result back to Claude ────────────────
    const messagesWithResult = [
      ...messages,
      { role: 'assistant', content: claudeData.content },
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult)
        }]
      }
    ];

    const finalRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages: messagesWithResult, tools: TOOLS })
    });

    const finalData = await finalRes.json();
    const finalText = finalData.content?.find(b => b.type === 'text')?.text || '';

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        type: 'tool_result',
        tool: toolName,
        toolInput,
        rawData: toolResult,
        analysis: finalText,
        usage: finalData.usage
      })
    };

  } catch (err) {
    console.error('claude-proxy error:', err);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};
