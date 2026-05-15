# Dune AI Agent PWA

Blockchain data explorer powered by **Dune Analytics** + **Claude AI**.  
Підтримує 130+ мереж: Base, Ethereum, Optimism, Arbitrum, Polygon та ін.

## Можливості

- 🤖 **AI Chat** — природна мова → Dune API (Claude orchestrator)
- 👛 **Wallet Lookup** — баланси, NFTs, DeFi позиції, транзакції в реальному часі
- 📊 **SQL Query** — виконання збережених Dune запитів по ID

## Стек

- **Frontend:** React 18 + Vite 5 + TypeScript, PWA
- **Backend:** Netlify Functions (Node.js 20)
- **AI:** Claude claude-sonnet-4-20250514 з tool use
- **Data:** Dune Query API + Dune Sim API

---

## Деплой на Netlify

### 1. Клонуй та встанови

```bash
git clone <repo>
npm install
```

### 2. Налаштуй env vars в Netlify Dashboard

**Site settings → Environment variables → Add variable:**

| Ключ | Де взяти |
|------|----------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| `DUNE_API_KEY` | [dune.com/settings/api](https://dune.com/settings/api) |
| `DUNE_SIM_API_KEY` | dune.com/settings/api → Sim API tab |

### 3. Деплой

**Варіант А — через GitHub (рекомендовано):**
```
Netlify → Add new site → Import from Git
Build command: npm run build
Publish directory: dist
```

**Варіант Б — drag & drop:**
```bash
npm run build
# Перетягни папку dist/ в Netlify Dashboard
# ⚠️ Functions не будуть включені — потрібен Варіант А
```

**Варіант В — Netlify CLI:**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

---

## Локальна розробка

```bash
# Створи .env з ключами
cp .env.example .env

# Запусти з Netlify Functions
npm install -g netlify-cli
netlify dev

# Відкрий http://localhost:8888
```

---

## Структура проекту

```
dune-pwa-agent/
├── netlify/
│   └── functions/
│       ├── claude-proxy.js    ← AI orchestrator (tool use)
│       ├── dune-sim.js        ← Dune Sim API proxy
│       └── dune-query.js      ← Dune Query API proxy
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx  ← AI Chat
│   │   ├── WalletPanel.tsx    ← Wallet lookup
│   │   └── QueryBuilder.tsx   ← SQL query
│   ├── types/dune.types.ts
│   └── styles/globals.css
├── SKILL.md                   ← Dune skill specification
├── netlify.toml
└── vite.config.ts
```

---

## Env vars без деплою (тестування)

Якщо DUNE_API_KEY не встановлено — QueryBuilder показує згенерований SQL з посиланням на dune.com.  
Якщо DUNE_SIM_API_KEY не встановлено — WalletPanel повертає помилку з підказкою.  
Якщо ANTHROPIC_API_KEY не встановлено — Chat повертає помилку з інструкцією.

## Ліцензія

MIT — author: antlab
