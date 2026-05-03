const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');

// Endpoint oficial do Textbelt para envio de SMS
const TEXTBELT_URL = 'https://textbelt.com/text';

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

let dbPool = null;

function getDbSslOptions() {
  const env = getRuntimeEnv();
  if (env === 'production') {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

async function initDb() {
  const url = getDatabaseUrl();
  if (!url) return;

  dbPool = new Pool({
    connectionString: url,
    ssl: getDbSslOptions()
  });

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS sms_replies (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL,
      text_id TEXT,
      from_number TEXT,
      message_text TEXT,
      data TEXT,
      payload JSONB
    )
  `);
}

async function saveReplyToDb(reply, payload) {
  if (!dbPool) return;

  await dbPool.query(
    `
      INSERT INTO sms_replies (received_at, text_id, from_number, message_text, data, payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      reply.receivedAt,
      reply.textId ?? null,
      reply.fromNumber ?? null,
      reply.text ?? null,
      reply.data ?? null,
      payload ?? null
    ]
  );
}

async function listRepliesFromDb(limit) {
  if (!dbPool) return null;

  const result = await dbPool.query(
    `
      SELECT received_at, text_id, from_number, message_text, data
      FROM sms_replies
      ORDER BY received_at DESC, id DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((r) => ({
    receivedAt: new Date(r.received_at).toISOString(),
    textId: r.text_id,
    fromNumber: r.from_number,
    text: r.message_text,
    data: r.data
  }));
}

function getRuntimeEnv() {
  return process.env.NODE_ENV || 'development';
}

function getTextbeltApiKey() {
  const env = getRuntimeEnv();
  const apiKey = process.env.TEXTBELT_API_KEY;
  const apiKeyTest = process.env.TEXTBELT_API_KEY_TEST;

  if (env !== 'production' && apiKeyTest) {
    return apiKeyTest;
  }

  return apiKey;
}

function getReplyWebhookUrl() {
  const env = getRuntimeEnv();
  const replyWebhookUrl = process.env.TEXTBELT_REPLY_WEBHOOK_URL;
  const replyWebhookUrlTest = process.env.TEXTBELT_REPLY_WEBHOOK_URL_TEST;

  if (env !== 'production' && replyWebhookUrlTest) {
    return replyWebhookUrlTest;
  }

  return replyWebhookUrl;
}

function normalizeApiKeyForQuota(apiKey) {
  if (!apiKey) return apiKey;
  const key = String(apiKey);
  return key.endsWith('_test') ? key.slice(0, -5) : key;
}

function getAuthSecret() {
  return process.env.SMS_AUTH_SECRET || process.env.AUTH_SECRET;
}

function getLoginPasswordHash() {
  return process.env.SMS_LOGIN_PASSWORD_HASH || process.env.LOGIN_PASSWORD_HASH;
}

function getLoginPasswordSalt() {
  return process.env.SMS_LOGIN_PASSWORD_SALT || process.env.LOGIN_PASSWORD_SALT;
}

function verifyLoginPassword(password) {
  const hashHex = getLoginPasswordHash();
  const salt = getLoginPasswordSalt();

  if (!hashHex || !salt) return null;
  if (typeof password !== 'string' || password.length === 0) return false;

  const expected = Buffer.from(String(hashHex).trim(), 'hex');
  const actual = crypto.scryptSync(password, String(salt), expected.length);

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64UrlDecodeToString(input) {
  const b64 = String(input).replaceAll('-', '+').replaceAll('_', '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signToken(payloadObj, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payloadObj));
  const toSign = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest();
  return `${toSign}.${base64UrlEncode(sig)}`;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string' || token.length === 0) return { ok: false };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false };

  const [headerB64, payloadB64, sigB64] = parts;
  const toSign = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(toSign).digest();

  const expectedSigB64 = base64UrlEncode(expectedSig);
  const a = Buffer.from(String(sigB64));
  const b = Buffer.from(String(expectedSigB64));
  if (a.length !== b.length) return { ok: false };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false };

  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return { ok: false };
  }

  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return { ok: false };
  if (Math.floor(Date.now() / 1000) >= exp) return { ok: false, expired: true };

  return { ok: true, payload };
}

// Validação simples no padrão E.164: + seguido de 8 a 15 dígitos
function isValidInternationalPhone(phone) {
  return typeof phone === 'string' && /^\+\d{8,15}$/.test(phone);
}

// Função solicitada: envia SMS via Textbelt e retorna o resultado da API
async function enviarSMS(phone, message) {
  try {
    const apiKey = getTextbeltApiKey();
    const replyWebhookUrl = getReplyWebhookUrl();

    if (!apiKey) {
      return { success: false, error: 'TEXTBELT_API_KEY não configurada' };
    }

    if (!isValidInternationalPhone(phone)) {
      return { success: false, error: 'Telefone inválido. Use formato internacional (ex: +556799999999)' };
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return { success: false, error: 'Mensagem inválida' };
    }

    const payload = {
      phone,
      message,
      key: apiKey
    };

    if (replyWebhookUrl) {
      payload.replyWebhookUrl = replyWebhookUrl;
    }

    const response = await axios.post(TEXTBELT_URL, payload);

    return response.data;
  } catch (error) {
    // Mantém o retorno em um formato consistente, incluindo detalhes quando disponíveis
    if (error?.response?.data) {
      return { success: false, error: 'Erro ao enviar SMS via Textbelt', details: error.response.data };
    }

    return { success: false, error: 'Erro ao enviar SMS via Textbelt', details: error?.message || String(error) };
  }
}

const app = express();
app.locals.smsReplies = [];
app.use(express.static(path.join(__dirname, 'public')));
function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getSendAllowedOrigins() {
  const raw = process.env.SMS_SEND_ALLOWED_ORIGINS || process.env.SEND_ALLOWED_ORIGINS;
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) return true;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

const corsOrigins = getCorsOrigins();
const sendAllowedOrigins = getSendAllowedOrigins();
app.use((req, res, next) => {
  const origin = req.get('origin');

  if (origin && corsOrigins.length > 0) {
    const allowed = corsOrigins.includes('*') || corsOrigins.includes(origin);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});



// Parse do body em JSON (requisito: body-parser) + captura do JSON bruto (necessário para validar assinatura do webhook)
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
      req.rawBodyBuffer = Buffer.from(buf);
    }
  })
);

function requireAuth(req, res, next) {
  const secret = getAuthSecret();
  if (!secret) {
    return res.status(500).json({ success: false, error: 'SMS_AUTH_SECRET não configurada' });
  }

  const auth = req.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }

  const token = match[1];
  const result = verifyToken(token, secret);
  if (!result.ok) {
    return res.status(401).json({ success: false, error: 'Token inválido' });
  }

  req.user = result.payload;
  return next();
}

app.post('/auth/login', (req, res) => {
  try {
    const password = req.body?.password;
    const passwordValid = verifyLoginPassword(password);

    if (passwordValid === null) {
      return res.status(500).json({ success: false, error: 'Senha de login não configurada no servidor' });
    }

    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Senha inválida' });
    }

    const secret = getAuthSecret();
    if (!secret) {
      return res.status(500).json({ success: false, error: 'SMS_AUTH_SECRET não configurada' });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 12 * 60 * 60;
    const token = signToken({ sub: 'admin', iat: now, exp }, secret);

    return res.status(200).json({ success: true, token, expiresAt: exp });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

app.get('/sms/quota', requireAuth, async (req, res) => {
  try {
    const apiKey = normalizeApiKeyForQuota(getTextbeltApiKey());

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'TEXTBELT_API_KEY não configurada' });
    }

    const url = `https://textbelt.com/quota/${encodeURIComponent(apiKey)}`;
    const response = await axios.get(url);

    return res.status(200).json({
      success: Boolean(response?.data?.success),
      quotaRemaining: response?.data?.quotaRemaining,
      environment: getRuntimeEnv()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

app.get('/sms/replies', requireAuth, async (req, res) => {
  try {
    const limitRaw = req.query?.limit;
    const limit = Math.max(1, Math.min(50, Number(limitRaw) || 50));

    const fromDb = await listRepliesFromDb(limit);
    if (fromDb) {
      return res.status(200).json({ success: true, replies: fromDb });
    }

    const replies = Array.isArray(app.locals.smsReplies) ? app.locals.smsReplies : [];
    return res.status(200).json({ success: true, replies: replies.slice(-limit).reverse() });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

function signatureToBuffer(signature) {
  try {
    const sig = String(signature).trim();
    if (sig.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(sig)) {
      return Buffer.from(sig, 'hex');
    }
  } catch {}

  return Buffer.from(String(signature));
}

function verifyTextbeltWebhook(apiKey, timestamp, requestSignature, requestPayloadBuffer) {
  const hmac = crypto.createHmac('sha256', apiKey);
  hmac.update(String(timestamp));
  hmac.update(requestPayloadBuffer);
  const mySignatureHex = hmac.digest('hex');

  const a = signatureToBuffer(requestSignature);
  const b = signatureToBuffer(mySignatureHex);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Webhook de replies do Textbelt (POST). Precisa ser um endpoint público (HTTP/HTTPS) para o Textbelt conseguir chamar.
app.post('/sms/reply', async (req, res) => {
  try {
    const apiKey = getTextbeltApiKey();
    const signature = req.get('x-textbelt-signature');
    const timestamp = req.get('x-textbelt-timestamp');
    const rawBody = req.rawBody;
    const rawBodyBuffer = req.rawBodyBuffer;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'TEXTBELT_API_KEY não configurada' });
    }

    if (!signature || !timestamp || typeof rawBody !== 'string' || !Buffer.isBuffer(rawBodyBuffer)) {
      return res.status(400).json({ success: false, error: 'Webhook inválido (headers ou body ausentes)' });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);

    if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 15 * 60) {
      return res.status(401).json({ success: false, error: 'Webhook rejeitado (timestamp inválido/expirado)' });
    }

    const valid = verifyTextbeltWebhook(apiKey, timestamp, signature, rawBodyBuffer);

    if (!valid) {
      return res.status(401).json({ success: false, error: 'Webhook rejeitado (assinatura inválida)' });
    }

    const { textId, fromNumber, text, data } = req.body || {};
    const receivedAt = new Date();
    const reply = {
      receivedAt: receivedAt.toISOString(),
      textId,
      fromNumber,
      text,
      data
    };

    app.locals.smsReplies.push(reply);
    if (app.locals.smsReplies.length > 50) {
      app.locals.smsReplies.shift();
    }

    try {
      await saveReplyToDb(
        {
          receivedAt: receivedAt.toISOString(),
          textId,
          fromNumber,
          text,
          data
        },
        req.body || null
      );
    } catch (error) {
      console.error('Falha ao salvar reply no banco:', error?.message || String(error));
    }

    console.log('SMS reply recebido:', reply);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// Endpoint extra: recebe phone/message e envia via Textbelt
app.post('/sms', async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    const dryRunQuery = req.query?.dryRun;
    const dryRun = dryRunQuery === '1' || dryRunQuery === 'true' || req.get('x-dry-run') === '1';

    // Validação de entrada (campos obrigatórios)
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: phone, message' });
    }

    if (!isValidInternationalPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Telefone inválido. Use formato internacional (ex: +556799999999)'
      });
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Mensagem inválida' });
    }

    // Modo de simulação: valida tudo, mas não consome cota nem envia SMS de verdade
    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        phone,
        message,
        environment: getRuntimeEnv(),
        replyWebhookUrlConfigured: Boolean(getReplyWebhookUrl())
      });
    }

    requireAuth(req, res, () => {});
    if (res.headersSent) return;

    const origin = req.get('origin');
    if (!isOriginAllowed(origin, sendAllowedOrigins)) {
      return res.status(403).json({ success: false, error: 'Origem não autorizada' });
    }

    if (!getTextbeltApiKey()) {
      return res.status(500).json({ success: false, error: 'TEXTBELT_API_KEY não configurada' });
    }

    const result = await enviarSMS(phone, message);

    // Status HTTP: 200 quando enviado com sucesso; 500 quando falha no envio
    if (result?.success) {
      return res.status(200).json(result);
    }

    return res.status(500).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;

  initDb()
    .catch((error) => {
      console.error('Falha ao inicializar banco:', error?.message || String(error));
    })
    .finally(() => {
      app.listen(port, () => {
        console.log(`SMS API rodando na porta ${port}`);
      });
    });
}

module.exports = { enviarSMS, app };
