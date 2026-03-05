/**
 * src/lib/wallet-auth.ts
 * ──────────────────────────────────────────────────────────────
 * Client-side wallet connection for EVM, Solana, and TON.
 * Handles wallet detection, connection, message signing, and
 * JWT token management via localStorage.
 * ──────────────────────────────────────────────────────────────
 */

export type ChainType = 'evm' | 'solana' | 'ton';

export interface WalletUser {
  address: string;
  chain: ChainType;
  shortAddress: string;
}

export interface AuthSession {
  token: string;
  user: WalletUser;
}

const AUTH_KEY = 'axonqwen-auth';

// ─── EVM Chain definitions ───────────────────────────────────

export const EVM_CHAINS: Record<number, { name: string; symbol: string; icon: string }> = {
  1:     { name: 'Ethereum',    symbol: 'ETH',   icon: '⟠' },
  56:    { name: 'BNB Chain',   symbol: 'BNB',   icon: '⛓' },
  137:   { name: 'Polygon',     symbol: 'MATIC', icon: '⬡' },
  42161: { name: 'Arbitrum',    symbol: 'ETH',   icon: '🔵' },
  8453:  { name: 'Base',        symbol: 'ETH',   icon: '🔷' },
  43114: { name: 'Avalanche',   symbol: 'AVAX',  icon: '🔺' },
  10:    { name: 'Optimism',    symbol: 'ETH',   icon: '🔴' },
  250:   { name: 'Fantom',      symbol: 'FTM',   icon: '👻' },
};

// ─── Wallet detection ────────────────────────────────────────

export function detectWallets(): { evm: boolean; solana: boolean; ton: boolean } {
  const w = window as any;
  return {
    evm:    !!w.ethereum,
    solana: !!w.solana?.isPhantom || !!w.phantom?.solana,
    ton:    !!w.tonconnect || !!w.ton,
  };
}

// ─── Session management ──────────────────────────────────────

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    // Basic JWT expiry check (decode payload without verification)
    // JWT uses base64url — convert to standard base64 for atob()
    const b64url = session.token.split('.')[1];
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const session = getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.token}` };
}

// ─── Nonce request ───────────────────────────────────────────

async function requestNonce(address: string, chain: ChainType): Promise<{ nonce: string; message: string }> {
  const r = await fetch('/api/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chain }),
  });
  if (!r.ok) throw new Error('Failed to get nonce');
  return r.json();
}

async function verifySignature(address: string, chain: ChainType, signature: string, message: string): Promise<AuthSession> {
  const r = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chain, signature, message }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(err.error);
  }
  return r.json();
}

// ─── EVM wallet connection (MetaMask, etc.) ──────────────────

export async function connectEVM(): Promise<AuthSession> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('No EVM wallet detected. Please install MetaMask.');

  // Request accounts
  const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts.length) throw new Error('No accounts found');
  const address = accounts[0];

  // Get nonce
  const { message } = await requestNonce(address, 'evm');

  // Sign message
  const signature = await ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  });

  // Verify on server
  const session = await verifySignature(address, 'evm', signature, message);
  saveSession(session);
  return session;
}

// ─── Solana wallet connection (Phantom, etc.) ────────────────

export async function connectSolana(): Promise<AuthSession> {
  const phantom = (window as any).phantom?.solana || (window as any).solana;
  if (!phantom?.isPhantom) throw new Error('No Solana wallet detected. Please install Phantom.');

  // Connect
  const resp = await phantom.connect();
  const address = resp.publicKey.toString();

  // Get nonce
  const { message } = await requestNonce(address, 'solana');

  // Sign message
  const encodedMsg = new TextEncoder().encode(message);
  const signedMessage = await phantom.signMessage(encodedMsg, 'utf8');

  // Encode signature as base64 (browser-safe, no external deps)
  const sigBytes = new Uint8Array(signedMessage.signature);
  const signature = btoa(String.fromCharCode(...sigBytes));

  // Verify on server
  const session = await verifySignature(address, 'solana', signature, message);
  saveSession(session);
  return session;
}

// ─── TON wallet connection ───────────────────────────────────

export async function connectTON(): Promise<AuthSession> {
  // TON Connect — simplified approach
  // Uses window.ton or TON Connect bridge
  const ton = (window as any).ton;
  if (!ton) throw new Error('No TON wallet detected. Please install Tonkeeper or TON Wallet.');

  // Request accounts
  const accounts = await ton.send('ton_requestAccounts');
  if (!accounts?.length) throw new Error('No TON accounts found');
  const address = accounts[0];

  // Get nonce
  const { message } = await requestNonce(address, 'ton');

  // Sign message — TON wallets provide a signature method
  let signature: string;
  try {
    const result = await ton.send('ton_rawSign', [{ data: btoa(message) }]);
    signature = result.signature || result;
  } catch {
    // Fallback: some TON wallets use a different method
    signature = await ton.send('ton_signData', [{ data: btoa(message) }]);
  }

  // Verify on server
  const session = await verifySignature(address, 'ton', String(signature), message);
  saveSession(session);
  return session;
}

// ─── Generic connect by chain ────────────────────────────────

export async function connectWallet(chain: ChainType): Promise<AuthSession> {
  switch (chain) {
    case 'evm':    return connectEVM();
    case 'solana': return connectSolana();
    case 'ton':    return connectTON();
    default:       throw new Error(`Unsupported chain: ${chain}`);
  }
}

// ─── Get current EVM chain info ──────────────────────────────

export async function getEVMChainInfo(): Promise<{ chainId: number; name: string } | null> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;
  try {
    const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    const info = EVM_CHAINS[chainId];
    return { chainId, name: info?.name || `Chain ${chainId}` };
  } catch {
    return null;
  }
}
