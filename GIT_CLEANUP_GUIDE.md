# Plano de Limpeza de Histórico Git - Credenciais Expostas

## IMPORTANTE: Leia Completamente Antes de Executar

Este script remove credenciais do histórico Git usando BFG Repo-Cleaner.
**Isso reescreverá TODO o histórico** e afetará todos os colaboradores.

### ⚠️ ANTES DE COMEÇAR:

1. **Resete TODAS as credenciais comprometidas:**
   - [ ] Mude senha PostgreSQL
   - [ ] Regenere TEXTBELT_API_KEY e TEXTBELT_API_KEY_TEST
   - [ ] Mude SMS_AUTH_SECRET
   - [ ] Mude SMS_LOGIN_PASSWORD_HASH e SMS_LOGIN_PASSWORD_SALT

2. **Faça backup do repositório:**
   ```bash
   git clone --mirror https://github.com/BRABianca/anonyText.git anonyText-backup.git
   ```

3. **Avise colaboradores:**
   - Ninguém deve fazer push/pull enquanto a limpeza acontece
   - Todos precisarão rebaseá-lo após

### 📋 Passo 1: Instalar BFG Repo-Cleaner

```bash
# macOS
brew install bfg

# Linux (Debian/Ubuntu)
sudo apt-get install bfg

# Ou download direto
cd /tmp
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
alias bfg='java -jar /tmp/bfg-1.14.0.jar'
```

### 📋 Passo 2: Clonar Repositório Espelho

```bash
git clone --mirror https://github.com/BRABianca/anonyText.git anonyText.git
cd anonyText.git
```

### 📋 Passo 3: Remover .env e arquivos sensíveis

```bash
# Remover arquivo .env completamente do histórico
bfg --delete-files .env

# Remover .env.local, .env.test, etc
bfg --delete-files .env.local
bfg --delete-files .env.test
bfg --delete-files .env.production
```

### 📋 Passo 4: Remover Secrets Específicas (Se Necessário)

Se credenciais foram commited em outros arquivos, crie um arquivo `secrets.txt`:

```bash
cat > secrets.txt << 'EOF'
TEXTBELT_API_KEY=sk_test_abcd1234567890
DATABASE_URL=postgresql://user:senha123@host:5432/db
SMS_AUTH_SECRET=meu_secret_antigo_aqui
EOF

bfg --replace-text secrets.txt
```

### 📋 Passo 5: Limpar e Verificar

```bash
# Limpar garbage collection
bfg --strip-blobs-bigger-than 100M
cd anonyText.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verificar que credenciais foram removidas
git log -p --all | grep -i "TEXTBELT_API_KEY" | wc -l  # Deve ser 0
git log -p --all | grep -i "DATABASE_URL" | wc -l      # Deve ser 0
```

### 📋 Passo 6: Force Push para GitHub

```bash
cd /caminho/para/anonyText.git

# CUIDADO: Isto reescreverá todo o histórico remoto
git push --mirror --force https://github.com/BRABianca/anonyText.git
```

### 📋 Passo 7: Notificar Colaboradores

Todos os colaboradores precisam fazer isto:

```bash
# Remover clone antigo completamente
rm -rf ~/projects/anonyText

# Clonar novamente com histórico limpo
git clone https://github.com/BRABianca/anonyText.git
cd anonyText

# Se tinha branches locais desatualizar
git branch -a
git checkout -b nome-da-branch origin/nome-da-branch
```

### ✅ Verificação Final

```bash
# Confirmar que repositório remoto está limpo
git log --oneline | head -20
git log -p | grep -i "TEXTBELT_API_KEY" || echo "✅ Nenhuma API key encontrada"
git log -p | grep -i "DATABASE_URL" || echo "✅ Nenhuma DATABASE_URL encontrada"

# Verificar que .env foi removido
git log --diff-filter=D --summary | grep ".env"
```

---

## Alternativa: Usando git-filter-branch (Sem BFG)

Se preferir usar apenas Git (sem BFG):

```bash
# Remover .env de todo o histórico
git filter-branch -f --tree-filter 'rm -f .env .env.local .env.test' -- --all

# Ou remover padrão específico
git filter-branch -f --tree-filter '
  for file in $(find . -name ".env*" -type f); do
    rm -f "$file"
  done
' -- --all

# Limpar
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --mirror --force https://github.com/BRABianca/anonyText.git
```

---

## 🆘 Se Algo Der Errado

```bash
# Restaurar do backup
rm -rf anonyText.git
git clone --mirror /caminho/backup/anonyText-backup.git anonyText.git

# Ou restaurar do GitHub (se você tiver backup)
git clone https://github.com/BRABianca/anonyText.git
```

---

## 📚 Recursos Adicionais

- [BFG Repo-Cleaner Official Guide](https://rtyley.github.io/bfg-repo-cleaner/)
- [Git Filter-Branch Documentation](https://git-scm.com/docs/git-filter-branch)
- [GitHub Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
