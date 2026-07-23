const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const STATE_TTL_SECONDS = 10 * 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'robai-cms-auth' }, 200, request, env);
    }

    if (url.pathname === '/auth' && request.method === 'GET') {
      return beginAuthorization(url, env);
    }

    if (url.pathname === '/callback' && request.method === 'GET') {
      return finishAuthorization(url, env);
    }

    return json({ error: 'Not found' }, 404, request, env);
  },
};

async function beginAuthorization(url, env) {
  requireConfiguration(env);

  if (url.searchParams.get('provider') !== 'github') {
    return new Response('Unsupported provider', { status: 400 });
  }

  const siteId = normalizeSiteId(url.searchParams.get('site_id'));
  const siteOrigin = siteOriginFor(siteId, env);
  if (!siteOrigin) {
    return new Response('This site is not allowed to use the login service.', { status: 403 });
  }

  const state = await signState({
    siteOrigin,
    expiresAt: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  }, env.STATE_SECRET);

  const callbackUrl = `${url.origin}/callback`;
  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callbackUrl);
  authorize.searchParams.set('scope', 'public_repo');
  authorize.searchParams.set('state', state);

  return Response.redirect(authorize.toString(), 302);
}

async function finishAuthorization(url, env) {
  requireConfiguration(env);

  const state = await verifyState(url.searchParams.get('state'), env.STATE_SECRET);
  if (!state || state.expiresAt < Math.floor(Date.now() / 1000)) {
    return popupResponse('error', '登录状态已失效，请关闭窗口后重试。', null, 400);
  }

  if (url.searchParams.get('error')) {
    const message = url.searchParams.get('error_description') || 'GitHub authorization was cancelled.';
    return popupResponse('error', message, state.siteOrigin, 401);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return popupResponse('error', 'GitHub did not return an authorization code.', state.siteOrigin, 400);
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'RobAI-Club-CMS',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    const message = tokenData.error_description || tokenData.error || 'Unable to exchange the GitHub authorization code.';
    return popupResponse('error', message, state.siteOrigin, 502);
  }

  return popupResponse('success', tokenData.access_token, state.siteOrigin, 200);
}

function popupResponse(result, value, siteOrigin, status) {
  const safeResult = result === 'success' ? 'success' : 'error';
  const payload = safeResult === 'success'
    ? { token: value, provider: 'github' }
    : { message: value };
  const targetOrigin = siteOrigin || 'https://invalid.example';
  const protocolMessage = `authorization:github:${safeResult}:${JSON.stringify(payload)}`;
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>RobAI-Club GitHub 登录</title></head>
<body><p id="status">正在完成 GitHub 登录……</p>
<script>
(function () {
  const targetOrigin = ${JSON.stringify(targetOrigin)};
  const finalMessage = ${JSON.stringify(protocolMessage)};
  if (!window.opener) {
    document.getElementById('status').textContent = '登录窗口已失去与管理平台的连接，请关闭后重试。';
    return;
  }
  function receive(event) {
    if (event.origin !== targetOrigin || event.data !== 'authorizing:github') return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(finalMessage, targetOrigin);
  }
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:github', targetOrigin);
}());
</script></body></html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'none'; connect-src 'none'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function normalizeSiteId(value) {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function siteOriginFor(siteId, env) {
  const allowed = (env.ALLOWED_SITE_IDS || 'logancome.github.io')
    .split(',')
    .map(normalizeSiteId)
    .filter(Boolean);
  if (!allowed.includes(siteId)) return null;
  return `https://${siteId}`;
}

function requireConfiguration(env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.STATE_SECRET) {
    throw new Error('OAuth worker secrets are not configured.');
  }
}

async function signState(payload, secret) {
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(encoded, secret);
  return `${encoded}.${signature}`;
}

async function verifyState(value, secret) {
  if (!value || !value.includes('.')) return null;
  const [encoded, signature] = value.split('.', 2);
  const expected = await hmac(encoded, secret);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
  } catch {
    return null;
  }
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const result = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(result));
}

function timingSafeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = origin && siteOriginFor(normalizeSiteId(origin), env) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env),
    },
  });
}
