/**
 * Neuro-VADO · Cloudflare Worker Proxy
 * ----------------------------------------
 * Proxies requests from the GitHub Pages app to the Google Gemini API,
 * keeping the API key safe on the server side.
 *
 * IMPORTANT: The frontend (index.html) was originally built to send
 * Anthropic-format payloads. This worker accepts those payloads and
 * translates them to Gemini format on the way out, then translates
 * Gemini's response back into Anthropic-shaped JSON on the way in.
 * That way the frontend keeps working unchanged.
 *
 * Deployment:
 *   1. wrangler secret put GEMINI_API_KEY   (paste your Google AI Studio key)
 *   2. wrangler deploy
 *
 * Author: Javier Fernando Rubiano Espinosa
 */

// === CORS ALLOWED ORIGINS ===
const ALLOWED_ORIGINS = [
  'https://jfrubiano72.github.io',
  'https://neurovado.javierrubiano.com',
  'https://javierrubiano.com',
  'https://www.javierrubiano.com',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

// === RATE LIMIT (per worker instance) ===
const RATE_LIMIT_MAX = 30;       // requests per hour per IP
const RATE_LIMIT_WINDOW = 3600;  // seconds
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

// === Convert Anthropic-format payload to Gemini-format ===
function anthropicToGemini(body) {
  const system = body.system || '';
  const messages = body.messages || [];
  const maxTokens = body.max_tokens || 3500;

  // Build Gemini contents array
  const contents = [];
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'image' && block.source) {
          // Anthropic image: { source: { type: 'base64', media_type: 'image/jpeg', data: '...' } }
          // Gemini image: { inline_data: { mime_type: 'image/jpeg', data: '...' } }
          const src = block.source;
          if (src.type === 'base64') {
            parts.push({
              inline_data: {
                mime_type: src.media_type || 'image/jpeg',
                data: src.data
              }
            });
          } else if (src.type === 'url') {
            // Gemini also supports URL via fileData, but base64 is what the frontend sends
            parts.push({ text: `[Image URL: ${src.url}]` });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  const geminiPayload = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      topP: 0.95
    }
  };

  if (system) {
    geminiPayload.systemInstruction = { parts: [{ text: system }] };
  }

  return geminiPayload;
}

// === Convert Gemini response back to Anthropic-shape so frontend doesn't change ===
function geminiToAnthropic(geminiResponse) {
  const candidate = (geminiResponse.candidates && geminiResponse.candidates[0]) || {};
  const content = candidate.content || {};
  const parts = content.parts || [];

  // Concatenate all text parts
  const textBlocks = parts
    .filter(p => typeof p.text === 'string')
    .map(p => ({ type: 'text', text: p.text }));

  // Map finish reason
  let stopReason = 'end_turn';
  if (candidate.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
  if (candidate.finishReason === 'SAFETY') stopReason = 'stop_sequence';

  return {
    id: 'msg_' + Math.random().toString(36).slice(2, 14),
    type: 'message',
    role: 'assistant',
    model: 'gemini-2.5-flash',
    content: textBlocks.length > 0 ? textBlocks : [{ type: 'text', text: '' }],
    stop_reason: stopReason,
    usage: {
      input_tokens: (geminiResponse.usageMetadata && geminiResponse.usageMetadata.promptTokenCount) || 0,
      output_tokens: (geminiResponse.usageMetadata && geminiResponse.usageMetadata.candidatesTokenCount) || 0
    }
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
        service: 'Neuro-VADO Proxy',
        engine: 'Google Gemini 2.0 Flash',
        status: 'running',
        author: 'Javier Fernando Rubiano Espinosa'
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

    // API key check
    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'GEMINI_API_KEY not configured on worker.'
      }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Rate limit
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again later.`,
        resetAt: rl.resetAt
      }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Parse body (frontend sends Anthropic-shaped payload)
    let anthropicBody;
    try {
      anthropicBody = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Translate to Gemini format
    const geminiPayload = anthropicToGemini(anthropicBody);

    // Forward to Gemini
    try {
      const apiKey = (env.GEMINI_API_KEY || '').trim();
      const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const geminiResponse = await fetch(geminiURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });

      const responseText = await geminiResponse.text();

      if (!geminiResponse.ok) {
        console.log('=== GEMINI ERROR ===');
        console.log('Status:', geminiResponse.status);
        console.log('Response:', responseText);
        console.log('====================');
        return new Response(JSON.stringify({
          error: 'Upstream error',
          status: geminiResponse.status,
          message: responseText.slice(0, 500)
        }), {
          status: geminiResponse.status,
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      let geminiJSON;
      try {
        geminiJSON = JSON.parse(responseText);
      } catch (e) {
        return new Response(JSON.stringify({
          error: 'Invalid response from Gemini',
          message: responseText.slice(0, 300)
        }), {
          status: 502,
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      // Translate back to Anthropic shape so the frontend works unchanged
      const anthropicShape = geminiToAnthropic(geminiJSON);

      return new Response(JSON.stringify(anthropicShape), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Worker error',
        message: err.message || String(err)
      }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
