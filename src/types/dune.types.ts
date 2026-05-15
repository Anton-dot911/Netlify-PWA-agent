// src/types/dune.types.ts
// Dune Analytics types — adapted from project specification

export type Chain = 'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'optimism' | 'avalanche' | 'bnb' | 'solana';

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, optimism: 10, arbitrum: 42161,
  polygon: 137, avalanche: 43114, bnb: 56
};

export const CHAINS_LIST = [
  { id: 1,     name: 'Ethereum', short: 'ETH' },
  { id: 8453,  name: 'Base',     short: 'BASE' },
  { id: 10,    name: 'Optimism', short: 'OP' },
  { id: 42161, name: 'Arbitrum', short: 'ARB' },
  { id: 137,   name: 'Polygon',  short: 'MATIC' },
  { id: 56,    name: 'BNB',      short: 'BNB' },
];

export type SimLookupType =
  | 'balances' | 'activity' | 'transactions'
  | 'nfts' | 'defi-positions'
  | 'token-metadata' | 'token-holders';

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUsd?: number;
  priceUsd?: number;
  priceChange24h?: number;
  chain?: string;
}

export interface WalletActivity {
  txHash: string;
  blockTime: string;
  type: string;
  protocol?: string;
  valueUsd?: number;
  chain: string;
}

export interface NFTItem {
  contractAddress: string;
  tokenId: string;
  name?: string;
  collection?: string;
  imageUrl?: string;
  chain: string;
}

export interface DeFiPosition {
  protocol: string;
  type: string;
  chain: string;
  valueUsd?: number;
  assets: { symbol: string; amount: string; valueUsd?: number }[];
  apy?: number;
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply?: string;
  priceUsd?: number;
  marketCapUsd?: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rawData?: unknown;
  tool?: string;
  toolInput?: unknown;
  timestamp: number;
}

export interface ApiResponse {
  type: 'text' | 'tool_result';
  content?: string;
  analysis?: string;
  rawData?: unknown;
  tool?: string;
  toolInput?: unknown;
  error?: string;
}
