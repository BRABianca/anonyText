# anonyText - Guia de Desenvolvimento Seguro

## 🔒 Configuração Inicial de Segurança

Depois de clonar o repositório, execute:

```bash
# 1. Instalar dependências
npm install

# 2. Revisar vulnerabilidades
npm audit

# 3. Criar arquivo .env local (NUNCA fazer commit)
cp .env.example .env

# 4. Preencher valores do .env
nano .env  # ou seu editor preferido
```

## 📝 Commits Seguros

### Antes de fazer commit:

```bash
# 1. Verificar o que você está commitando
git diff

# 2. Verificar arquivos staged
git status

# 3. ❌ NUNCA commit .env ou arquivos sensíveis
git add .  # Use com cuidado!
git add src/ docs/  # Melhor: especificar diretórios

# 4. Revisar before push
git log -1 -p
```

### Prevenindo commit acidental de .env:

```bash
# Git hook automático (Linux/macOS)
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Verificar se .env está sendo adicionado
if git diff --cached --name-only | grep -q "\.env"; then
  echo "❌ ERRO: Tentativa de commit .env detectada!"
  echo "Use: git reset .env"
  exit 1
fi

# Verificar palavras-chave sensíveis
if git diff --cached | grep -i "TEXTBELT_API_KEY\|DATABASE_URL\|AUTH_SECRET"; then
  echo "⚠️  Aviso: Possível credencial detectada em staged changes"
  read -p "Continuar? (s/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
  fi
fi

exit 0
EOF

chmod +x .git/hooks/pre-commit
```

## 🔍 Auditoria Local

```bash
# Revisar dependências vulneráveis
npm audit

# Atualizar dependências de segurança
npm audit fix

# Verificar histórico de commits recentes
git log --oneline -10

# Procurar por padrões sensíveis no código
grep -r "TEXTBELT_API_KEY" . --exclude-dir=node_modules
grep -r "DATABASE_URL" . --exclude-dir=node_modules
grep -r "password:" . --exclude-dir=node_modules
```

## 🚀 Deployment Seguro

### Variáveis de Ambiente Obrigatórias:

```bash
# Banco de Dados
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# Textbelt SMS
export TEXTBELT_API_KEY="sua_chave_producao"
export TEXTBELT_REPLY_WEBHOOK_URL="https://seu-dominio.com/sms/reply"

# Autenticação
export SMS_AUTH_SECRET="jwt_secret_seguro_aleatorio_aqui"
export SMS_LOGIN_PASSWORD_HASH="hash_scrypt"
export SMS_LOGIN_PASSWORD_SALT="salt_aleatorio"

# CORS
export CORS_ORIGINS="https://seu-dominio.com"
export SMS_SEND_ALLOWED_ORIGINS="https://seu-dominio.com"

# Ambiente
export NODE_ENV="production"
export PORT="3000"
```

### Checklist de Deployment:

- [ ] Todas as variáveis .env configuradas
- [ ] Banco de dados com senha forte
- [ ] HTTPS/SSL ativo
- [ ] Firewall configurado
- [ ] Backups configurados
- [ ] Logs monitorados
- [ ] CORS restritivo (não usar `*`)
- [ ] npm audit passou
- [ ] Código revisado
- [ ] Secret Scanning ativo no GitHub

## 📊 Monitoramento de Segurança

### GitHub Settings:
- [x] Secret Scanning ativo
- [ ] Branch Protection Rules em `main`
- [ ] Require pull request reviews
- [ ] Require status checks before merge
- [ ] Dependabot alerts habilitado

### Local Checks:
```bash
# Executar a cada semana
npm audit
git log --oneline | head -20
git remote -v  # Verificar URLs remotas
```

## 🚨 Se Você Acidentalmente Commitou uma Credencial:

1. **IMEDIATAMENTE:**
   ```bash
   git log -S "TEXTBELT_API_KEY" --oneline  # Encontrar commits
   ```

2. **Resete a credencial:**
   - Mude a senha PostgreSQL
   - Regenere TEXTBELT_API_KEY
   - Mude AUTH_SECRET

3. **Remova do histórico:**
   - Veja `GIT_CLEANUP_GUIDE.md`

4. **Force push (cuidado!):**
   ```bash
   git push --force-with-lease origin main
   ```

## 📚 Recursos

- [SECURITY.md](./SECURITY.md) - Política de segurança
- [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md) - Resposta a incidentes
- [GIT_CLEANUP_GUIDE.md](./GIT_CLEANUP_GUIDE.md) - Limpeza de histórico
- [.env.example](./.env.example) - Template de variáveis
