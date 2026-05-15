---
name: dune
version: "1.0"
description: >
  Expert in Dune — the leading blockchain data platform (130+ chains).
  Use for: (1) Querying blockchain data with DuneSQL via CLI or API,
  (2) Searching and discovering datasets, tables, decoded contracts,
  (3) Real-time wallet lookups — balances, activity, transactions, NFTs, DeFi positions,
  (4) Token metadata, prices, holder leaderboards via Sim API,
  (5) Managing and executing saved Dune queries,
  (6) Monitoring API credits and usage,
  (7) Cross-chain analytics across Base, Optimism, Ethereum and 130+ EVM/SVM chains.
triggers:
  - dune
  - blockchain data
  - on-chain
  - wallet lookup
  - token balance
  - defi position
  - nft holdings
  - dex trades
  - transaction history
  - sql query
  - dataset search
  - contract address
  - aerodrome
  - uniswap
  - base chain
  - optimism
requires:
  - dune-cli
  - dune-sim-api-key
chains:
  - base
  - optimism
  - ethereum
  - arbitrum
  - polygon
  - solana
  - "+126 more"
metadata:
  author: antlab
---

# Dune Skill — Blockchain Data Expert

## Overview

Dune provides two complementary tools:

| Tool | Best For | Auth |
|------|----------|------|
| Dune CLI (`dune`) | Historical queries, custom SQL, dataset discovery | `DUNE_API_KEY` |
| Dune Sim CLI (`dune sim`) | Real-time lookups by address — balances, activity, NFTs, DeFi | `DUNE_SIM_API_KEY` |

**Decision rule:**
- User asks about a specific wallet or token address → use `dune sim`
- User needs custom analytics, aggregations, trends → use `dune query run-sql`

---

## Chain IDs (EVM)

| Chain | ID |
|-------|-----|
| Ethereum | 1 |
| Base | 8453 |
| Optimism | 10 |
| Arbitrum One | 42161 |
| Polygon | 137 |
| BNB | 56 |

---

## 1. Dune CLI — Query Blockchain Data

```bash
# Run ad-hoc SQL
dune query run-sql "SELECT * FROM dex.trades WHERE blockchain='base' LIMIT 10" -o json

# Execute saved query
dune query execute <QUERY_ID> -o json

# Get latest cached results (no credits)
dune query results <QUERY_ID> -o json
```

### Common Tables

| Table | Contains | Chains |
|-------|----------|--------|
| `dex.trades` | All DEX swaps, normalized | All EVM |
| `dex_aggregator.trades` | Aggregator-routed swaps | All EVM |
| `tokens.erc20` | Token metadata, decimals | All EVM |
| `prices.usd` | Token prices by minute | All EVM |
| `erc20_{{chain}}.evt_Transfer` | Raw ERC20 transfers | Per-chain |
| `{{chain}}.transactions` | Raw transactions | Per-chain |

---

## 2. Dataset Discovery

```bash
dune datasets search "aerodrome swaps base" -o json
dune datasets schema dex.trades -o json
dune datasets search-by-contract 0x420DD381b31aEf6683db6B902084cB0FFECe40D --blockchain base -o json
```

---

## 3. Dune Sim — Real-Time Lookups

```bash
# Token balances (with USD pricing)
dune sim evm balances --address 0x... --chain-ids 8453 -o json

# Wallet activity (pre-decoded)
dune sim evm activity --address 0x... --chain-ids 8453 --limit 50 -o json

# NFT holdings (spam filtered)
dune sim evm nfts --address 0x... --chain-ids 8453 -o json

# DeFi positions
dune sim evm defi-positions --address 0x... --chain-ids 8453,10 -o json

# Token metadata & price
dune sim evm token metadata --token-address 0x... --chain-ids 8453 -o json

# Token holder leaderboard
dune sim evm token holders --token-address 0x... --chain-ids 8453 --limit 100 -o json
```

---

## 4. DuneSQL Best Practices

```sql
-- Always filter by block_time (partition pruning)
WHERE block_time >= NOW() - INTERVAL '90' DAY

-- Use varbinary for addresses (NOT quoted strings)
WHERE taker = 0xda905450166c6574cee0cd276b898f62d7368ee9

-- Filter aggregator routers from wallet analysis
AND taker != 0x1111111254EEB25477B68fb85Ed929f73A960582  -- 1inch
AND taker != 0xDEF1C0ded9bec7F1a1670819833240f027b25EfF  -- 0x Protocol

-- Price at trade time (NOT current price) for P&L
JOIN prices.usd p
  ON p.contract_address = t.token_bought_address
  AND p.blockchain = t.blockchain
  AND p.minute = DATE_TRUNC('minute', t.block_time)
```

---

## 5. Wallet Intelligence Workflow (Base/Optimism)

```bash
# Step 1: Find top wallets via SQL
dune query run-sql "
  SELECT taker, COUNT(*) as trades, SUM(amount_usd) as volume
  FROM dex.trades
  WHERE blockchain = 'base' AND project = 'aerodrome'
    AND block_time >= NOW() - INTERVAL '90' DAY
    AND amount_usd BETWEEN 5 AND 10000000
  GROUP BY 1 HAVING COUNT(*) BETWEEN 5 AND 500
  ORDER BY volume DESC LIMIT 50
" -o json

# Step 2: Deep-dive specific wallet
dune sim evm balances --address 0xda905... --chain-ids 8453,10 -o json
dune sim evm defi-positions --address 0xda905... --chain-ids 8453,10 -o json
```

---

## 6. Error Recovery

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Wrong/missing API key | Re-run `dune auth --api-key <key>` |
| `401 on dune sim` | Missing Sim API key | Set `DUNE_SIM_API_KEY` env var |
| `429 Too Many Requests` | Rate limit | Wait 60s, retry with backoff |
| Query timeout | Query too heavy | Add `LIMIT`, filter `block_time`, use date partitions |
| Table not found | Wrong table name | Use `dune datasets search` |
