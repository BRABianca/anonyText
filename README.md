# Textbelt SMS (backend + front)

## Backend (Render)

- Envia SMS: `POST /sms`
- Webhook de reply: `POST /sms/reply`
- Listar replies recebidas: `GET /sms/replies`

### Variáveis de ambiente (produção)

- `NODE_ENV=production`
- `TEXTBELT_API_KEY=...`
- `TEXTBELT_REPLY_WEBHOOK_URL=https://SEU-SERVICO.onrender.com/sms/reply`
- `CORS_ORIGINS=https://SEU_USUARIO.github.io`

## Front-end (GitHub Pages)

O front estático fica na pasta `docs/` para publicar via GitHub Pages.

1. Em `docs/index.html`, ajuste:
   - `window.API_BASE_URL` para a URL do seu backend no Render (ex.: `https://SEU-SERVICO.onrender.com`)
2. No GitHub:
   - Settings → Pages → Build and deployment → Source: Deploy from a branch
   - Branch: `main` e Folder: `/docs`

