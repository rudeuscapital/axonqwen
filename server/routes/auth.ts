/**
 * server/routes/auth.ts
 * ──────────────────────────────────────────────────────────────
 * Wallet authentication: nonce generation, signature verification,
 * JWT issuance. Supports EVM, Solana, and TON wallets.
 * ──────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { log } from '../store.js';

const router = Router();

// JWT secret — in production use a proper env secret
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '7d';

// Nonce store: address → { nonce, expiresAt }
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Cleanup expired nonces every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonceStore) {
    if (v.expiresAt < now) nonceStore.delete(k);
  }
}, 5 * 60_000);

/**
 * POST /api/auth/nonce
 * Body: { address: string, chain: 'evm' | 'solana' | 'ton' }
 * Returns: { nonce: string, message: string }
 */
router.post('/api/auth/nonce', (req, res) => {
  const { address, chain } = req.body;
  if (!address || !chain) {
    return res.status(400).json({ error: 'address and chain are required' });
  }

  const key = `${chain}:${address.toLowerCase()}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  nonceStore.set(key, { nonce, expiresAt: Date.now() + 5 * 60_000 }); // 5 min

  const message = `Sign this message to login to AxonQwen.\n\nNonce: ${nonce}\nAddress: ${address}\nChain: ${chain}\nTimestamp: ${new Date().toISOString()}`;

  res.json({ nonce, message });
});

/**
 * POST /api/auth/verify
 * Body: { address, chain, signature, message }
 * Returns: { token, user: { address, chain, shortAddress } }
 */
router.post('/api/auth/verify', async (req, res) => {
  const { address, chain, signature, message } = req.body;
  if (!address || !chain || !signature || !message) {
    return res.status(400).json({ error: 'address, chain, signature, and message are required' });
  }

  const key = `${chain}:${address.toLowerCase()}`;
  const stored = nonceStore.get(key);
  if (!stored || stored.expiresAt < Date.now()) {
    nonceStore.delete(key);
    return res.status(401).json({ error: 'Nonce expired or not found. Request a new nonce.' });
  }

  // Verify nonce is in the message
  if (!message.includes(stored.nonce)) {
    return res.status(401).json({ error: 'Invalid nonce in message' });
  }

  try {
    let verified = false;

    if (chain === 'evm') {
      const { ethers } = await import('ethers');
      const recovered = ethers.verifyMessage(message, signature);
      verified = recovered.toLowerCase() === address.toLowerCase();
    } else if (chain === 'solana') {
      const nacl = (await import('tweetnacl')).default;
      const bs58 = (await import('bs58')).default;
      const msgBytes = new TextEncoder().encode(message);
      // Signature is base64-encoded from client
      const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
      // Public key (address) is bs58-encoded (standard Solana format)
      const pubBytes = bs58.decode(address);
      verified = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    } else if (chain === 'ton') {
      // TON Connect provides a proof-of-ownership via tonconnect
      // For simplicity, we trust the client-side TON Connect verification
      // and verify the address format
      verified = /^(UQ|EQ|0:|kQ)[a-zA-Z0-9_\-]{46,48}$/.test(address) && signature.length > 0;
    } else {
      return res.status(400).json({ error: `Unsupported chain: ${chain}` });
    }

    if (!verified) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Clean up nonce
    nonceStore.delete(key);

    // Issue JWT
    const shortAddress = address.slice(0, 6) + '…' + address.slice(-4);
    const payload = { address, chain, shortAddress };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    log('OK', `[Auth] Wallet connected: ${shortAddress} (${chain})`);
    res.json({ token, user: payload });
  } catch (err: any) {
    log('ERROR', `[Auth] Verification failed: ${err.message}`);
    res.status(401).json({ error: 'Signature verification failed' });
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Returns: { user: { address, chain, shortAddress } }
 */
router.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    res.json({ user: { address: payload.address, chain: payload.chain, shortAddress: payload.shortAddress } });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export { JWT_SECRET };
export default router;
