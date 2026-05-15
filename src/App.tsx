import { useState } from 'react'
import ChatInterface from './components/ChatInterface'
import WalletPanel from './components/WalletPanel'
import QueryBuilder from './components/QueryBuilder'
import './styles/globals.css'

type Tab = 'chat' | 'wallet' | 'query'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat',   label: 'AI Chat',  icon: '🤖' },
  { id: 'wallet', label: 'Wallet',   icon: '👛' },
  { id: 'query',  label: 'SQL',      icon: '📊' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <div className="logo-icon">⛓️</div>
          <div>
            <h1>Dune AI Agent</h1>
            <p>Blockchain Data Explorer · 130+ chains</p>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <div className="app-content">
        {tab === 'chat'   && <ChatInterface />}
        {tab === 'wallet' && <WalletPanel />}
        {tab === 'query'  && <QueryBuilder />}
      </div>
    </div>
  )
}
