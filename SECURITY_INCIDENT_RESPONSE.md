# Plano de Resposta a Incidentes de Segurança

## Se você acidentalmente commitou credenciais:

### 1. **Ação Imediata (em minutos)**
```bash
# Revogue/resete a credencial imediatamente
# - Mude a senha do banco de dados PostgreSQL
# - Regenere TEXTBELT_API_KEY
# - Mude JWT_SECRET
```

### 2. **Identificar exposição (minutos)**
```bash
# Procure pela credencial no histórico
git log -p | grep -i "TEXTBELT_API_KEY"
git log -p | grep -i "DATABASE_URL"
git log --all --full-history -S "sua_chave_comprometida" -- .env
```

### 3. **Limpar o histórico Git**

**Opção A: Usando BFG Repo-Cleaner (recomendado)**
```bash
# Instalar BFG
brew install bfg  # macOS
# ou download em https://rtyley.github.io/bfg-repo-cleaner/

# Criar arquivo com padrões para remover
echo "TEXTBELT_API_KEY=*" > patterns.txt

# Remover credenciais
bfg --delete-files .env
bfg --replace-text patterns.txt

# Limpar
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**Opção B: Usando git-filter-branch**
```bash
# ⚠️ Mais lento, mas integrado no Git

# Remover arquivo .env de todo o histórico
git filter-branch --tree-filter 'rm -f .env' --prune-empty -f -- --all

# Remover padrão específico
git filter-branch -f --tree-filter '
  if [ -f .env ]; then
    sed -i "s/TEXTBELT_API_KEY=.*/TEXTBELT_API_KEY=REDACTED/g" .env
  fi
' -- --all

# Limpar
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 4. **Force Push (CUIDADO)**
```bash
# Isso reescreverá o histórico - todos os colaboradores precisarão fazer rebase
git push origin --force-with-lease --all
git push origin --force-with-lease --tags
```

### 5. **Notificar colaboradores**
- Comunique que o histórico foi reescrito
- Peça que façam pull/rebase em branchs locais
- Qualquer branch local desatualizada precisa ser recriada

### 6. **Verificar sucesso**
```bash
# Confirmar que credenciais foram removidas
git log -p --all | grep -i "TEXTBELT_API_KEY"  # Não deve retornar nada
git log -p --all | grep -i "DATABASE_URL"      # Não deve retornar nada
```

## Credenciais Comprometidas - Checklist

Se credentials foram expostas, faça isto **IMEDIATAMENTE**:

### 📋 Banco de Dados PostgreSQL
- [ ] Altere a senha do usuário PostgreSQL
- [ ] Se possível, revise logs de acesso
- [ ] Monitore por atividades anormais
- [ ] Considere rotação de backup se houver suspeita de acesso

### 📋 Textbelt API
- [ ] Regenere `TEXTBELT_API_KEY`
- [ ] Regenere `TEXTBELT_API_KEY_TEST`
- [ ] Revogue chaves antigas se disponível
- [ ] Verifique logs de uso da API

### 📋 Secrets de Autenticação
- [ ] Mude `SMS_AUTH_SECRET`
- [ ] Resete `SMS_LOGIN_PASSWORD_HASH`
- [ ] Resete `SMS_LOGIN_PASSWORD_SALT`
- [ ] Qualquer token JWT emitido pode ser considerado comprometido

### 📋 Repositório Git
- [ ] Limpe o histórico (BFG ou git-filter-branch)
- [ ] Force push das mudanças
- [ ] Atualize todos os clientes/clones locais

### 📋 Comunicação
- [ ] Notifique usuários se dados de SMS foram expostos
- [ ] Documente o incidente
- [ ] Atualize logs internos

## Monitores Contínuos

### GitHub Secret Scanning
- ✅ Habilitado por padrão em repositórios públicos
- Você receberá alertas do GitHub se credenciais forem detectadas
- Acesse: https://github.com/BRABianca/anonyText/security/secret-scanning

### Dependências Vulneráveis
- Configure Dependabot (`.github/dependabot.yml`)
- Revise regularmente: https://github.com/BRABianca/anonyText/security/dependabot

### Logs & Auditoria
```bash
# Revisar commits recentes
git log --oneline -20

# Verificar quem fez push
git log --format="%h %an %ae %aI %s" -10

# Revisar mudanças em arquivos sensíveis
git log -p -- .env .env.* server.js
```

## Recursos Adicionais

- [GitHub Security Advisories](https://github.com/BRABianca/anonyText/security/advisories)
- [BFG Repo-Cleaner Guide](https://rtyley.github.io/bfg-repo-cleaner/)
- [Git Filter-Branch Documentation](https://git-scm.com/docs/git-filter-branch)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
