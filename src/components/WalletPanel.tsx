import { useState } from 'react'
import { CHAINS_LIST, type SimLookupType } from '../types/dune.types'

const LOOKUP_TABS: { id: SimLookupType; label: string; icon: string }[] = [
  { id: 'balances',      label: 'Баланси',    icon: '💰' },
  { id: 'activity',      label: 'Активність', icon: '⚡' },
  { id: 'nfts',          label: 'NFTs',        icon: '🖼️' },
  { id: 'defi-positions',label: 'DeFi',        icon: '🏦' },
  { id: 'transactions',  label: 'Транзакції',  icon: '🔄' },
]

function formatUsd(v?: number) {
  if (!v) return '—'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shortAddr(addr: string) {
  return addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr
}

// Render data depending on lookup type
function RenderResults({ data, type }: { data: unknown; type: SimLookupType }) {
  const json = data as Record<string, unknown>

  if (type === 'balances') {
    const tokens = (json.balances || json.tokens || []) as Array<Record<string, unknown>>
    if (!tokens.length) return <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>Немає даних</p>
    const total = tokens.reduce((s, t) => s + (Number(t.value_usd ?? t.balanceUsd) || 0), 0)
    return (
      <div>
        <div className="data-card" style={{ marginBottom: 12 }}>
          <div className="data-card-header">
            <span className="data-card-title">Загальний баланс</span>
            <span className="data-card-value">{formatUsd(total)}</span>
          </div>
        </div>
        <div className="token-list">
          {tokens.slice(0, 30).map((t, i) => (
            <div key={i} className="token-row">
              <span className="token-symbol">{String(t.symbol || t.token_symbol || '?')}</span>
              <div style={{ textAlign: 'right' }}>
                <div className="token-usd">{formatUsd(Number(t.value_usd ?? t.balanceUsd))}</div>
                <div className="token-balance">{String(t.amount || t.balance || '')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'nfts') {
    const nfts = (json.nfts || json.items || []) as Array<Record<string, unknown>>
    if (!nfts.length) return <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>NFTs не знайдено</p>
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {nfts.slice(0, 20).map((n, i) => (
          <div key={i} className="data-card">
            {n.image_url && <img src={String(n.image_url)} alt="" style={{ width: '100%', borderRadius: 6, marginBottom: 8, maxHeight: 120, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text)' }}>{String(n.name || n.collection_name || 'NFT')}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>#{String(n.token_id ?? '')}</div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'defi-positions') {
    const positions = (json.positions || json.defi_positions || []) as Array<Record<string, unknown>>
    if (!positions.length) return <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>DeFi позиції не знайдено</p>
    return (
      <div className="token-list">
        {positions.map((p, i) => (
          <div key={i} className="data-card">
            <div className="data-card-header">
              <span className="data-card-title">{String(p.protocol || p.protocol_name || '?')}</span>
              <span className="data-card-value">{formatUsd(Number(p.value_usd ?? p.valueUsd))}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>{String(p.type || p.position_type || '')}</div>
          </div>
        ))}
      </div>
    )
  }

  // activity / transactions / fallback — raw table
  const rows = (json.activity || json.transactions || json.items || []) as Array<Record<string, unknown>>
  if (!rows.length) return (
    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {JSON.stringify(json, null, 2)}
    </pre>
  )

  return (
    <div className="results-table-wrap">
      <table className="results-table">
        <thead>
          <tr>{Object.keys(rows[0]).slice(0, 6).map(k => <th key={k}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map((r, i) => (
            <tr key={i}>{Object.values(r).slice(0, 6).map((v, j) => <td key={j}>{String(v ?? '—').slice(0, 40)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WalletPanel() {
  const [address, setAddress] = useState('')
  const [lookupType, setLookupType] = useState<SimLookupType>('balances')
  const [chains, setChains] = useState<number[]>([8453])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState('')

  function toggleChain(id: number) {
    setChains(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(c => c !== id) : prev) : [...prev, id])
  }

  async function lookup() {
    if (!address.trim()) return
    setLoading(true); setError(''); setData(null)
    try {
      const body: Record<string, unknown> = { lookup_type: lookupType, chain_ids: chains, limit: 25 }
      if (['balances', 'activity', 'transactions', 'nfts', 'defi-positions'].includes(lookupType)) {
        body.address = address.trim()
      } else {
        body.token_address = address.trim()
      }
      const res = await fetch('/.netlify/functions/dune-sim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка')
    } finally { setLoading(false) }
  }

  return (
    <div className="wallet-panel">
      <div className="wallet-form">
        <div className="address-row">
          <input
            type="text" value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="0x… адреса гаманця або токену"
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={lookup} disabled={loading || !address.trim()} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {loading ? '…' : '🔍'}
          </button>
        </div>

        <div className="chip-group">
          {LOOKUP_TABS.map(t => (
            <button key={t.id} className={`chip ${lookupType === t.id ? 'active' : ''}`} onClick={() => setLookupType(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="chip-group">
          {CHAINS_LIST.map(c => (
            <button key={c.id} className={`chip ${chains.includes(c.id) ? 'active' : ''}`} onClick={() => toggleChain(c.id)}>
              {c.short}
            </button>
          ))}
        </div>
      </div>

      <div className="wallet-results">
        {error && <div className="error-msg">{error}</div>}
        {data && <RenderResults data={data} type={lookupType} />}
        {!data && !error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👛</div>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: '0.95rem', letterSpacing: '0.06em' }}>ВВЕДІТЬ АДРЕСУ ГАМАНЦЯ</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginTop: 8, color: 'var(--text-muted)' }}>{shortAddr('0xda905450166c6574cee0cd276b898f62d7368ee9')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
