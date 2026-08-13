# Segurança - anonyText

## Variáveis de Ambiente

**Nunca** commite arquivos `.env` nem valores reais de credenciais. Use o arquivo [.env.example](file:///c:/Users/bianca/Documents/Projects/textBelt/.env.example) como template.

Principais variáveis sensíveis usadas em [server.js](file:///c:/Users/bianca/Documents/Projects/textBelt/server.js):

| Variável | Descrição |
|---|---|
| `TEXTBELT_API_KEY` | Chave de envio SMS da Textbelt (produção) |
| `DATABASE_URL` | Conexão PostgreSQL no formato `postgresql://user:pass@host/db` |
| `SMS_AUTH_SECRET` | Segredo usado para assinar tokens de login |
| `SMS_LOGIN_PASSWORD_HASH` | Hash da senha de admin (scrypt/bcrypt) |
| `SMS_LOGIN_PASSWORD_SALT` | Salt do hash da senha |
| `CORS_ORIGINS` | Origens permitidas (separadas por vírgula) |
| `SMS_SEND_ALLOWED_ORIGINS` | Origens que podem enviar SMS real |
| `REPLY_LINK_BASE_URL` | Domínio público usado nos links de resposta |

## Práticas recomendadas

1. **Não hardcode credenciais** — sempre via variáveis de ambiente.
2. **`.env` no `.gitignore`** — já está configurado.
3. **CORS restritivo** — evite `*` em `CORS_ORIGINS` / `SMS_SEND_ALLOWED_ORIGINS`; liste apenas os domínios que você usa.
4. **Secrets fortes** — use valores longos e aleatórios para `SMS_AUTH_SECRET` e `SMS_LOGIN_PASSWORD_SALT`.
5. **HTTPS em produção** — Render / GitHub Pages já fornecem HTTPS por padrão.

## Se você acidentalmente expuser uma credencial

1. Revogue / regenere a chave imediatamente (Textbelt, senha do Postgres, etc.).
2. Verifique o histórico:
   ```bash
   git log -p | grep -i "TEXTBELT_API_KEY"
   git log -p | grep -i "DATABASE_URL"
   ```
3. Se houver exposição no histórico, consulte o guia oficial do GitHub sobre [remover dados sensíveis](https://docs.github.com/pt/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Como relatar problemas

Se encontrar uma vulnerabilidade, abra uma issue ou contate o dono do repositório diretamente.
