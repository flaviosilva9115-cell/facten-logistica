# FACTEN Logística — Deploy Guide

## Stack
- **Frontend**: React + Vite → Vercel (free)
- **Banco de dados**: Supabase PostgreSQL (free)
- **IA**: Anthropic Claude API

---

## PASSO 1 — Supabase

1. Acesse **supabase.com** → crie conta com GitHub
2. "New Project" → nome: `facten-logistica` → região: South America (São Paulo)
3. Vá em **SQL Editor** → cole o conteúdo de `supabase_schema.sql` → Run
4. Vá em **Settings → API** e copie:
   - `Project URL` → será o `VITE_SUPABASE_URL`
   - `anon public` key → será o `VITE_SUPABASE_ANON_KEY`
5. Em **Settings → API → Realtime**, certifique que está habilitado

---

## PASSO 2 — GitHub

1. Crie uma conta em **github.com** (se não tiver)
2. Clique em **New Repository** → nome: `facten-logistica` → Public → Create
3. Faça upload de todos os arquivos desta pasta ou use Git:

```bash
git init
git add .
git commit -m "FACTEN Logistica v1"
git remote add origin https://github.com/SEU_USER/facten-logistica.git
git push -u origin main
```

---

## PASSO 3 — Vercel

1. Acesse **vercel.com** → entre com GitHub
2. "Add New Project" → importe o repositório `facten-logistica`
3. Framework: **Vite** (detecta automático)
4. Em **Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` |
| `VITE_ANTHROPIC_KEY` | `sk-ant-...` |

5. Clique **Deploy** → aguarde ~2 minutos
6. Acesse a URL gerada: `https://facten-logistica.vercel.app`

---

## PASSO 4 — Senha inicial

Todos os usuários acessam com a senha padrão: **`facten2025`**

A autenticação é controlada dentro do próprio app (sem Supabase Auth).

---

## Atualizações futuras

Qualquer alteração no código: faça commit no GitHub → Vercel redeploya automaticamente em ~1 minuto.

---

## Senhas e segurança

- A `ANON KEY` do Supabase é pública por design (Row Level Security protege os dados)
- A `ANTHROPIC_KEY` fica apenas nas variáveis de ambiente do Vercel (nunca exposta no front)
- Para maior segurança futura: migrar chamadas à API Anthropic para um endpoint serverless no Vercel

