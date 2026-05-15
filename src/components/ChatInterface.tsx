import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import type { ChatMessage, ApiResponse } from '../types/dune.types'

const SUGGESTIONS = [
  '📊 Топ трейдери Aerodrome на Base за 30 днів',
  '👛 Баланс гаманця 0xda905450166c6574cee0cd276b898f62d7368ee9',
  '💹 DEX об\'єм по мережах за 7 днів',
  '🦄 DeFi позиції гаманця на Base та Optimism',
]

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '0',
    role: 'assistant',
    content: 'Привіт! Я Dune AI Agent 🔗\n\nЗапитай про on-chain дані — гаманці, токени, DeFi позиції або блокчейн аналітику. Підтримую Base, Ethereum, Optimism, Arbitrum, Polygon та 130+ інших мереж.',
    timestamp: Date.now()
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [openRaw, setOpenRaw] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  function autoResize() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '42px'

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/.netlify/functions/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      })

      const data: ApiResponse = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.analysis || data.content || 'Отримано відповідь.',
        rawData: data.rawData,
        tool: data.tool,
        toolInput: data.toolInput,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Невідома помилка'
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Помилка: ${msg}`,
        timestamp: Date.now()
      }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const TOOL_LABELS: Record<string, string> = {
    dune_sim_lookup: '⚡ Dune Sim API',
    dune_sql_query: '📊 Dune SQL Query'
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.tool && (
              <div className="tool-badge">
                {TOOL_LABELS[msg.tool] || msg.tool}
              </div>
            )}
            <div className="message-bubble">{msg.content}</div>
            {msg.rawData && (
              <div>
                <button className="raw-data-toggle" onClick={() => setOpenRaw(openRaw === msg.id ? null : msg.id)}>
                  {openRaw === msg.id ? '▲' : '▼'} Raw JSON
                </button>
                {openRaw === msg.id && (
                  <div className="raw-data-panel">{JSON.stringify(msg.rawData, null, 2)}</div>
                )}
              </div>
            )}
            <span className="message-meta">{formatTime(msg.timestamp)}</span>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-bubble" style={{ padding: '8px 16px' }}>
              <div className="loading-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '0.82rem', padding: '10px 14px',
                textAlign: 'left', transition: 'border-color 0.15s'
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-act)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >{s}</button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize() }}
          onKeyDown={onKeyDown}
          placeholder="Запитай про гаманець, токен або дані блокчейну..."
          rows={1}
          disabled={loading}
        />
        <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
          ↑
        </button>
      </div>
    </div>
  )
}
