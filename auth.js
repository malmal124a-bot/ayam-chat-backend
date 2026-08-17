const { jwtVerify, createRemoteJWKSet } = require('jose');

/**
 * Supabase JWKS endpoint for ES256 JWT verification.
 * Fetches the public keys from Supabase and caches them.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dhabrfnfirhhcrdbvzdi.supabase.co';
const JWKS_URI = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

/**
 * JWT Authentication Middleware
 * Verifies Supabase JWT tokens using ES256 (ECDSA P-256).
 * The public key is fetched from Supabase's JWKS endpoint.
 */
function authMiddleware() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`,
      });
      req.user = payload; // { sub, email, role, aud, ... }
      next();
    } catch (e) {
      console.error('[AUTH] Token verification failed:', e.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { authMiddleware };
