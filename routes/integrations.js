// ── /api/integrations ────────────────────────────────────────────────────
// OAuth y gestión de integraciones por clínica.
// Hoy soporta:
//   - meta     (Facebook/Instagram/WhatsApp Ads vía Meta Business)
//   - google   (Google Ads)
//   - tiktok   (TikTok Ads — placeholder)
//   - whatsapp (WhatsApp Business via Meta Cloud API — placeholder)
//
// Para activar realmente cada proveedor, hay que setear sus credenciales en .env.
// Si las credenciales no están, los endpoints devuelven 503 con un mensaje
// claro indicando qué falta — el SaaS sigue funcionando sin romperse.
//
// Tokens cifrados con lib/secret-vault (AES-256-GCM) antes de guardarse.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const { URL, URLSearchParams } = require('url');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const vault = require('../lib/secret-vault');

// ── Configuración por proveedor (lee de .env, todo opcional) ────────────
const PROVIDERS = {
  meta: {
    label: 'Meta Business',
    color: '#0866ff',
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    scopes: [
      'ads_read',
      'ads_management',
      'business_management',
      'pages_show_list',
      'pages_read_engagement',
      'leads_retrieval',
    ],
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
  },
  google: {
    label: 'Google Ads',
    color: '#4285f4',
    requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN'],
    scopes: ['https://www.googleapis.com/auth/adwords'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  tiktok: {
    label: 'TikTok Ads',
    color: '#000000',
    requiredEnv: ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET'],
    scopes: [],
    authUrl: 'https://business-api.tiktok.com/portal/auth',
    tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
  },
  whatsapp: {
    label: 'WhatsApp Business',
    color: '#25d366',
    // WhatsApp se conecta a través de la misma app de Meta, así que comparte credenciales.
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET'],
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging', 'business_management'],
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
  },
};

function providerOk(provider) {
  const p = PROVIDERS[provider];
  if (!p) return { ok: false, reason: 'unknown_provider' };
  const missing = p.requiredEnv.filter(k => !process.env[k]);
  if (missing.length) return { ok: false, reason: 'missing_env', missing };
  if (!vault.isAvailable()) return { ok: false, reason: 'missing_vault' };
  return { ok: true };
}

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}
function callbackUrl(req, provider) {
  return `${baseUrl(req)}/api/integrations/${provider}/callback`;
}

function ensureAdmin(req, res, next) {
  if (!['clinic_admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo el administrador de la clínica puede gestionar integraciones.' });
  }
  next();
}

// State firmado (anti-CSRF). Lleva clinic_id + nonce + ts, firmado con HMAC del JWT_SECRET.
function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyState(state) {
  if (!state || !state.includes('.')) return null;
  const [data, sig] = state.split('.');
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    // Expira a los 10 minutos
    if (Date.now() - payload.ts > 10 * 60 * 1000) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// HTTPS helper sin nuevas dependencias (Node nativo)
function httpsRequest(method, urlStr, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: { Accept: 'application/json', ...headers },
    };
    if (body && !opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, res => {
      let chunks = '';
      res.on('data', d => { chunks += d; });
      res.on('end', () => {
        const ct = (res.headers['content-type'] || '').toLowerCase();
        let parsed = chunks;
        if (ct.includes('json')) {
          try { parsed = JSON.parse(chunks); } catch (_) {}
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(Object.assign(new Error('http_' + res.statusCode), { status: res.statusCode, body: parsed }));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── GET /api/integrations — lista integraciones de la clínica ─────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.json({ providers: providerStatus(), integrations: [] });

    const r = await query(
      `SELECT id, provider, external_account_id, external_account_name, status,
              scopes, meta, connected_at, last_sync_at, last_error
         FROM clinic_integrations
        WHERE clinic_id = $1
        ORDER BY connected_at DESC`,
      [clinicId]
    );
    const integrations = r.rows.map(row => ({
      ...row,
      meta: safeJson(row.meta),
    }));
    res.json({ providers: providerStatus(), integrations });
  } catch (err) {
    console.error('[integrations/list]', err);
    res.json({ providers: providerStatus(), integrations: [] });
  }
});

function providerStatus() {
  return Object.fromEntries(
    Object.entries(PROVIDERS).map(([k, v]) => {
      const ok = providerOk(k);
      return [k, {
        label: v.label,
        color: v.color,
        available: ok.ok,
        reason: ok.ok ? null : ok.reason,
        missing_env: ok.missing || null,
      }];
    })
  );
}

function safeJson(s) {
  if (!s) return {};
  try { return JSON.parse(s); } catch (_) { return {}; }
}

// ─── GET /api/integrations/:provider/auth-url ──────────────────────────────
router.get('/:provider/auth-url', authenticate, ensureAdmin, (req, res) => {
  const { provider } = req.params;
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.status(404).json({ error: 'Proveedor desconocido' });
  const ok = providerOk(provider);
  if (!ok.ok) {
    return res.status(503).json({
      error: 'Integración no disponible',
      reason: ok.reason,
      missing: ok.missing || [],
      message: missingEnvMessage(provider, ok),
    });
  }

  const state = signState({
    clinic_id: req.user.clinic_id,
    user_id: req.user.id,
    provider,
    nonce: crypto.randomBytes(8).toString('hex'),
    ts: Date.now(),
  });

  let url;
  if (provider === 'meta' || provider === 'whatsapp') {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: callbackUrl(req, provider),
      scope: cfg.scopes.join(','),
      response_type: 'code',
      state,
    });
    url = `${cfg.authUrl}?${params.toString()}`;
  } else if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl(req, provider),
      scope: cfg.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    url = `${cfg.authUrl}?${params.toString()}`;
  } else if (provider === 'tiktok') {
    const params = new URLSearchParams({
      app_id: process.env.TIKTOK_APP_ID,
      redirect_uri: callbackUrl(req, provider),
      state,
    });
    url = `${cfg.authUrl}?${params.toString()}`;
  }
  res.json({ url });
});

function missingEnvMessage(provider, ok) {
  if (ok.reason === 'missing_vault') {
    return 'Falta configurar SECRET_ENCRYPTION_KEY en variables de entorno.';
  }
  if (ok.reason === 'missing_env') {
    return `Falta configurar en variables de entorno: ${ok.missing.join(', ')}. Una vez seteado, esta integración se activa automáticamente.`;
  }
  return 'Integración no disponible.';
}

// ─── GET /api/integrations/:provider/callback ──────────────────────────────
// El usuario regresa de Facebook/Google con ?code=… y ?state=…
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.status(404).send(htmlClose('Proveedor desconocido', 'error'));

  const ok = providerOk(provider);
  if (!ok.ok) return res.status(503).send(htmlClose('Integración no configurada', 'error'));

  const { code, state, error: oauthError, error_description } = req.query;
  if (oauthError) {
    return res.status(400).send(htmlClose(`Meta rechazó la conexión: ${error_description || oauthError}`, 'error'));
  }
  const st = verifyState(state);
  if (!st || st.provider !== provider) {
    return res.status(400).send(htmlClose('Sesión inválida o expirada. Reintenta la conexión desde Configuración.', 'error'));
  }
  if (!code) return res.status(400).send(htmlClose('No se recibió código de autorización.', 'error'));

  try {
    let tokenData;
    if (provider === 'meta' || provider === 'whatsapp') {
      tokenData = await exchangeMetaCode(code, callbackUrl(req, provider));
    } else if (provider === 'google') {
      tokenData = await exchangeGoogleCode(code, callbackUrl(req, provider));
    } else if (provider === 'tiktok') {
      tokenData = await exchangeTikTokCode(code, callbackUrl(req, provider));
    }

    // Descubrir cuenta publicitaria (best-effort)
    let externalAccountId = '';
    let externalAccountName = '';
    let metaInfo = {};
    if (provider === 'meta') {
      try {
        const accounts = await metaListAdAccounts(tokenData.access_token);
        if (accounts.length > 0) {
          externalAccountId = accounts[0].account_id || accounts[0].id;
          externalAccountName = accounts[0].name || '';
          metaInfo.ad_accounts = accounts.slice(0, 10);
        }
      } catch (e) { metaInfo.discovery_error = String(e.message || e); }
    } else if (provider === 'whatsapp') {
      try {
        const businesses = await metaListBusinesses(tokenData.access_token);
        if (businesses.length > 0) {
          externalAccountId = businesses[0].id;
          externalAccountName = businesses[0].name || '';
          metaInfo.businesses = businesses.slice(0, 10);
        }
      } catch (e) { metaInfo.discovery_error = String(e.message || e); }
    }

    await query(
      `INSERT INTO clinic_integrations
         (clinic_id, provider, external_account_id, external_account_name,
          access_token_encrypted, refresh_token_encrypted, token_expires_at,
          scopes, meta, status, connected_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10)
       ON CONFLICT (clinic_id, provider, external_account_id) DO UPDATE
         SET access_token_encrypted = EXCLUDED.access_token_encrypted,
             refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
             token_expires_at = EXCLUDED.token_expires_at,
             scopes = EXCLUDED.scopes,
             meta = EXCLUDED.meta,
             status = 'active',
             last_error = '',
             connected_at = CURRENT_TIMESTAMP,
             connected_by = EXCLUDED.connected_by`,
      [
        st.clinic_id,
        provider,
        externalAccountId,
        externalAccountName,
        vault.encrypt(tokenData.access_token),
        tokenData.refresh_token ? vault.encrypt(tokenData.refresh_token) : '',
        tokenData.expires_at || null,
        (cfg.scopes || []).join(','),
        JSON.stringify(metaInfo),
        st.user_id,
      ]
    );

    res.send(htmlClose(`${cfg.label} conectado correctamente.`, 'success'));
  } catch (err) {
    console.error('[integrations/callback]', provider, err);
    res.status(500).send(htmlClose('No se pudo completar la conexión. Reintenta más tarde.', 'error'));
  }
});

// ─── DELETE /api/integrations/:id — revocar ────────────────────────────────
router.delete('/:id', authenticate, ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const r = await query(
      `DELETE FROM clinic_integrations
        WHERE id = $1 AND clinic_id = $2
        RETURNING id, provider`,
      [id, req.user.clinic_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    console.error('[integrations/delete]', err);
    res.status(500).json({ error: 'No se pudo desconectar' });
  }
});

// ─── POST /api/integrations/:id/test — probar token ────────────────────────
router.post('/:id/test', authenticate, ensureAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await query(
      `SELECT id, provider, access_token_encrypted, external_account_id
         FROM clinic_integrations
        WHERE id = $1 AND clinic_id = $2`,
      [id, req.user.clinic_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    const row = r.rows[0];
    const token = vault.decrypt(row.access_token_encrypted);
    if (!token) return res.status(400).json({ error: 'Token vacío' });

    let info = {};
    if (row.provider === 'meta' || row.provider === 'whatsapp') {
      info = await httpsRequest('GET', `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    } else if (row.provider === 'google') {
      info = { ok: 'pendiente: requiere Customer ID' };
    } else {
      info = { ok: 'no implementado' };
    }
    await query(`UPDATE clinic_integrations SET last_sync_at = CURRENT_TIMESTAMP, last_error = '' WHERE id = $1`, [id]);
    res.json({ ok: true, info });
  } catch (err) {
    await query(`UPDATE clinic_integrations SET last_error = $2 WHERE id = $1`, [req.params.id, String(err.message || err).slice(0, 200)]).catch(() => {});
    res.status(400).json({ error: 'Falló la verificación', detail: String(err.message || err) });
  }
});

// ─── helpers OAuth por proveedor ───────────────────────────────────────────
async function exchangeMetaCode(code, redirectUri) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });
  const short = await httpsRequest('GET',
    `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`);
  // Intercambio a long-lived (60 días)
  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    fb_exchange_token: short.access_token,
  });
  const long = await httpsRequest('GET',
    `https://graph.facebook.com/v19.0/oauth/access_token?${longParams.toString()}`);
  return {
    access_token: long.access_token || short.access_token,
    expires_at: long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000).toISOString()
      : null,
  };
}

async function metaListAdAccounts(token) {
  const r = await httpsRequest('GET',
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,account_id,name,currency,timezone_name&access_token=${encodeURIComponent(token)}`);
  return Array.isArray(r.data) ? r.data : [];
}
async function metaListBusinesses(token) {
  const r = await httpsRequest('GET',
    `https://graph.facebook.com/v19.0/me/businesses?fields=id,name&access_token=${encodeURIComponent(token)}`);
  return Array.isArray(r.data) ? r.data : [];
}

async function exchangeGoogleCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }).toString();
  const r = await httpsRequest('POST', 'https://oauth2.googleapis.com/token', { body });
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null,
  };
}

async function exchangeTikTokCode(code, redirectUri) {
  const body = JSON.stringify({
    app_id: process.env.TIKTOK_APP_ID,
    secret: process.env.TIKTOK_APP_SECRET,
    auth_code: code,
  });
  const r = await httpsRequest('POST',
    'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
    { body, headers: { 'Content-Type': 'application/json' } });
  const data = r.data || {};
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
  };
}

// HTML autocontenido que se cierra (post-OAuth)
function htmlClose(message, tone) {
  const ok = tone === 'success';
  const color = ok ? '#10b981' : '#ef4444';
  const bg = ok ? '#ecfdf5' : '#fef2f2';
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><title>Integración — Salud Digital</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0f172a;
  display:flex; align-items:center; justify-content:center; min-height:100vh; padding:1.5rem; }
.box { background:white; border-radius:18px; padding:2rem; max-width:420px; text-align:center;
  box-shadow:0 30px 80px rgba(0,0,0,.30); }
.ico { width:56px; height:56px; border-radius:50%; background:${bg}; color:${color};
  display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;
  font-size:28px; font-weight:700; }
h1 { font-size:18px; margin:0 0 .4rem; color:#0f172a; }
p  { color:#475569; font-size:14px; line-height:1.5; margin:0 0 1.25rem; }
.btn { background:#0891b2; color:white; text-decoration:none; padding:.65rem 1.25rem;
  border-radius:10px; font-size:14px; font-weight:600; display:inline-block; }
</style></head>
<body>
<div class="box">
  <div class="ico">${ok ? '✓' : '✕'}</div>
  <h1>${ok ? '¡Listo!' : 'No se pudo conectar'}</h1>
  <p>${escapeHtml(message)}</p>
  <a class="btn" href="/configuracion.html#integraciones">Volver a configuración</a>
</div>
<script>
  // Si esta ventana fue abierta como popup, notificar al opener y cerrar.
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'sd_integration_done', success: ${ok ? 'true' : 'false'} }, window.location.origin);
      setTimeout(() => window.close(), 1500);
    }
  } catch(_) {}
</script>
</body></html>`;
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

module.exports = router;
