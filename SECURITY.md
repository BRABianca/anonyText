# Política de Segurança - anonyText

## Relatando Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, **não abra uma issue pública**. Em vez disso:

1. **Use o GitHub Security Advisory**: https://github.com/BRABianca/anonyText/security/advisories
2. **Ou envie um email** para relatar a vulnerabilidade (você pode usar GitHub Security Advisory para comunicação segura)

Solicitamos que:
- Não divulgue a vulnerabilidade publicamente até que tenhamos tempo de corrigi-la
- Nos dê tempo razoável para investigar e lançar um patch
- Siga as melhores práticas de divulgação responsável

## Boas Práticas de Segurança para Este Projeto

### 1. Variáveis de Ambiente
- **Nunca** commit `.env` ou arquivos com credenciais
- Use `.env.example` como template (sem valores reais)
- Configure as variáveis no servidor/plataforma de deployment

**Variáveis sensíveis obrigatórias:**
```
DATABASE_URL=postgresql://user:pass@host/db
TEXTBELT_API_KEY=sua_chave_aqui
TEXTBELT_API_KEY_TEST=sua_chave_teste_aqui
SMS_AUTH_SECRET=seu_jwt_secret_aqui
SMS_LOGIN_PASSWORD_HASH=hash_scrypt_aqui
SMS_LOGIN_PASSWORD_SALT=salt_aqui
CORS_ORIGINS=http://localhost:3000,https://seudominio.com
```

### 2. Proteção de Ramos
- Habilite "Branch Protection Rules" para `main`
- Exija pull requests com pelo menos 1 aprovação
- Exija verificação de status antes de merge

### 3. Escaneamento de Segurança
- ✅ GitHub Secret Scanning está ativo
- Alertas serão enviados se credenciais forem detectadas
- Configure Code Scanning para análise estática

### 4. Dependências
- Mantenha dependências atualizadas
- Revise regularmente `npm audit`
- Configure Dependabot para alertas automáticos

```bash
npm audit
npm audit fix
```

### 5. Histórico de Git
Se você acidentalmente commitou uma credencial:

```bash
# 1. Revogue/resete a credencial imediatamente
# 2. Identifique commits com a credencial
git log -S "TEXTBELT_API_KEY" --oneline

# 3. Use BFG Repo-Cleaner para remover do histórico
bfg --delete-files .env
bfg --replace-text passwords.txt

# 4. Force push (CUIDADO - afeta todos os colaboradores)
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease
```

### 6. Dados Sensíveis em Banco de Dados
- Números de telefone são armazenados (necessário para funcionalidade)
- Limite acesso ao banco de dados por IP/VPN
- Use SSL/TLS para conexões
- Considere criptografia de dados em repouso

### 7. Autenticação & Autorização
- JWT tokens expiram em 12 horas
- Use Bearer tokens via header `Authorization`
- Revise logs de acesso regularmente

### 8. CORS
- Configure `CORS_ORIGINS` restritivamente
- Não use `*` em produção
- Whitelist domínios conhecidos apenas

## Checklist de Segurança para Deployment

- [ ] Variáveis de ambiente configuradas (não hardcoded)
- [ ] `.env` está no `.gitignore`
- [ ] SSL/TLS habilitado (HTTPS)
- [ ] Banco de dados com senha forte
- [ ] Branch protection ativo em `main`
- [ ] Secret Scanning habilitado no GitHub
- [ ] Dependências auditadas (`npm audit`)
- [ ] Firewall configurado (se aplicável)
- [ ] Logs monitorados
- [ ] Backups configurados

## Contato de Segurança

Para questões de segurança críticas, abra um [GitHub Security Advisory](https://github.com/BRABianca/anonyText/security/advisories/new).
