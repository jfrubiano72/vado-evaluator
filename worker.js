/**
 * VADO Evaluator · Cloudflare Worker Proxy
 * ----------------------------------------
 * Proxies requests from the GitHub Pages app to the Anthropic API,
 * keeping the API key safe on the server side.
 *
 * Deployment:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler secret put ANTHROPIC_API_KEY   (paste your key when prompted)
 *   4. wrangler deploy
 *
 * Author: Javier Rubiano · Behavioral Intelligence Lab
 */

// === CORS ALLOWED ORIGINS ===
// Only these origins can call this worker. Add more if you deploy elsewhere.
const ALLOWED_ORIGINS = [
  'https://jfrubiano72.github.io',
  'http://localhost:8000',   // for local testing
  'http://localhost:3000',
  'http://127.0.0.1:5500'    // VS Code Live Server
];

// === RATE LIMIT ===
// Simple per-IP limit to prevent abuse. Stored in memory (resets per worker instance).
const RATE_LIMIT_MAX = 20;      // requests
const RATE_LIMIT_WINDOW = 3600; // seconds (1 hour)
const ipHits = new Map();

function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 1000);
  const entry = ipHits.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }
  entry.count++;
  ipHits.set(ip, entry);
  return {
    allowed: entry.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetAt: entry.resetAt
  };
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        service: 'VADO Evaluator Proxy',
        status: 'running',
        author: 'Javier Rubiano · Behavioral Intelligence Lab'
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Rate limit per IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Has excedido el límite de evaluaciones por hora. Intenta de nuevo más tarde.',
        resetAt: rl.resetAt
      }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(rl.resetAt - Math.floor(Date.now()/1000)) }
      });
    }

    // API key check
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'ANTHROPIC_API_KEY not configured on worker.'
      }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Forward to Anthropic
    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': (env.ANTHROPIC_API_KEY || '').trim(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      const responseText = await anthropicResponse.text();
      return new Response(responseText, {
        status: anthropicResponse.status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.resetAt)
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Upstream error',
        message: String(err && err.message || err)
      }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
