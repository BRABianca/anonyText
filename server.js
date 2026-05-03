const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');

// Endpoint oficial do Textbelt para envio de SMS
const TEXTBELT_URL = 'https://textbelt.com/text';

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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

app.get('/sms/quota', async (req, res) => {
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

app.get('/sms/replies', (req, res) => {
  const replies = Array.isArray(app.locals.smsReplies) ? app.locals.smsReplies : [];
  const limitRaw = req.query?.limit;
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 50));

  return res.status(200).json({ success: true, replies: replies.slice(-limit).reverse() });
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
app.post('/sms/reply', (req, res) => {
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
    const reply = {
      receivedAt: new Date().toISOString(),
      textId,
      fromNumber,
      text,
      data
    };

    app.locals.smsReplies.push(reply);
    if (app.locals.smsReplies.length > 50) {
      app.locals.smsReplies.shift();
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

  // Inicia o servidor apenas quando executado diretamente (node server.js)
  app.listen(port, () => {
    console.log(`SMS API rodando na porta ${port}`);
  });
}

module.exports = { enviarSMS, app };
