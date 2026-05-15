import { useState } from 'react'

const EXAMPLES = [
  {
    label: 'Aerodrome top traders',
    sql: `SELECT taker, COUNT(*) AS trades, SUM(amount_usd) AS volume_usd
FROM dex.trades
WHERE blockchain = 'base'
  AND project = 'aerodrome'
  AND block_time >= NOW() - INTERVAL '30' DAY
  AND amount_usd BETWEEN 5 AND 10000000
GROUP BY 1
HAVING COUNT(*) BETWEEN 5 AND 500
ORDER BY volume_usd DESC
LIMIT 20`
  },
  {
    label: 'DEX volume by chain',
    sql: `SELECT blockchain, SUM(amount_usd) AS volume_usd, COUNT(*) AS trades
FROM dex.trades
WHERE block_time >= NOW() - INTERVAL '7' DAY
GROUP BY 1
ORDER BY volume_usd DESC
LIMIT 10`
  },
  {
    label: 'Token prices (Base)',
    sql: `SELECT symbol, AVG(price) AS avg_price_usd, MIN(minute) AS from_time
FROM prices.usd
WHERE blockchain = 'base'
  AND minute >= NOW() - INTERVAL '24' HOUR
GROUP BY 1
ORDER BY avg_price_usd DESC
LIMIT 20`
  },
]

type Mode = 'sql' | 'id'

export default function QueryBuilder() {
  const [mode, setMode] = useState<Mode>('sql')
  const [sql, setSql] = useState(EXAMPLES[0].sql)
  const [queryId, setQueryId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  async function execute() {
    setLoading(true); setError(''); setResult(null)
    try {
      const body = mode === 'id'
        ? { query_id: queryId }
        : { query_id: null, sql_hint: sql }

      const res = await fetch('/.netlify/functions/dune-query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка виконання')
    } finally { setLoading(false) }
  }

  const rows = (result?.result as Record<string, unknown>)?.rows as Array<Record<string, unknown>> | undefined
  const cols = rows?.[0] ? Object.keys(rows[0]) : []

  return (
    <div className="query-builder">
      <div className="query-toolbar">
        <div className="query-mode-tabs">
          <button className={`mode-tab ${mode === 'sql' ? 'active' : ''}`} onClick={() => setMode('sql')}>SQL</button>
          <button className={`mode-tab ${mode === 'id' ? 'active' : ''}`} onClick={() => setMode('id')}>Query ID</button>
        </div>

        {mode === 'sql' && (
          <>
            <div className="examples-row">
              {EXAMPLES.map((ex, i) => (
                <button key={i} className="example-chip" onClick={() => setSql(ex.sql)}>{ex.label}</button>
              ))}
            </div>
            <textarea
              className="sql-editor"
              value={sql}
              onChange={e => setSql(e.target.value)}
              rows={8}
              spellCheck={false}
            />
          </>
        )}

        {mode === 'id' && (
          <div className="query-actions">
            <input
              className="query-id-input"
              type="text"
              value={queryId}
              onChange={e => setQueryId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && execute()}
              placeholder="Dune Query ID (наприклад: 3456789)"
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={execute} disabled={loading || (mode === 'id' && !queryId.trim())}>
            {loading ? '⏳ Виконання…' : '▶ Виконати'}
          </button>
          {mode === 'sql' && (
            <a href="https://dune.com/queries/new" target="_blank" rel="noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', textDecoration: 'none' }}
            >↗ Відкрити в Dune</a>
          )}
        </div>
      </div>

      <div className="query-results">
        {error && <div className="error-msg">{error}</div>}

        {result?.status === 'no_api_key' && (
          <div className="sql-link-box">
            <h4>⚠️ DUNE_API_KEY не налаштований</h4>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)', margin: '8px 0' }}>
              {String(result.message)}
            </p>
            <a href={String(result.dune_url)} target="_blank" rel="noreferrer">
              ↗ {String(result.dune_url)}
            </a>
            {sql && <pre>{sql}</pre>}
          </div>
        )}

        {rows && rows.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 10 }}>
              {rows.length} рядків · Query #{String(result?.query_id || '—')}
            </div>
            <div className="results-table-wrap">
              <table className="results-table">
                <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>{cols.map(c => <td key={c}>{String(row[c] ?? '—').slice(0, 50)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!result && !error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: '0.95rem', letterSpacing: '0.06em' }}>ВВЕДІТЬ SQL АБО QUERY ID</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: 8, color: 'var(--text-muted)' }}>
              Потребує DUNE_API_KEY в Netlify Env Vars
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
