# AgroFlow - Gestao de Contratos

Sistema web em React + Vite + Tailwind CSS + Supabase para gestao de contratos, fornecedores, fabricas, produtos, notas fiscais, fretes, documentos e indicadores financeiros.

## Recursos

- Login via Supabase Auth.
- Solicitacao de acesso com aprovacao do administrador.
- Criacao/confirmacao de usuarios por funcao segura da Vercel usando `SUPABASE_SERVICE_ROLE_KEY`.
- Rotas protegidas: usuarios nao autenticados voltam para `/login`.
- Dashboard responsivo com cards, graficos, alertas de vencimento e tabela de contratos.
- CRUD de fornecedores, fabricas, produtos, contratos, notas fiscais, documentos e fretes.
- Notas fiscais vinculadas a contratos.
- Saldo e percentual de execucao calculados automaticamente.
- Exportacao de contratos em CSV e Excel.
- RLS no Supabase restringindo acesso ao usuario autenticado autorizado.

## 1. Criar o projeto no Supabase

1. Acesse [Supabase](https://supabase.com/) e crie um projeto gratuito.
2. No painel do projeto, abra `SQL Editor`.
3. Execute o SQL principal do projeto e os arquivos de correcao em `supabase/`, quando aplicavel.
4. Va em `Authentication > Providers > Email`.
5. Deixe o provedor de e-mail ativado.
6. O `Confirm email` pode ficar ativado. Usuarios aprovados pelo fluxo do AgroFlow sao criados/regularizados pela funcao segura da Vercel com e-mail confirmado.

## 2. Configurar variaveis de ambiente

No Supabase, abra `Project Settings > API` e copie:

- `Project URL`
- `anon public key`
- `service_role key`

Crie um arquivo `.env` local e configure as mesmas variaveis na Vercel:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-publica
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-apenas-no-backend
ADMIN_EMAIL=leandroalmeida861@gmail.com
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend, em e-mails, prints ou mensagens. Ela deve ficar apenas no backend/serverless.

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse o endereco exibido pelo Vite, normalmente `http://localhost:5173`.

## 4. Publicar na Vercel

1. Envie este projeto para um repositorio GitHub.
2. Acesse [Vercel](https://vercel.com/).
3. Clique em `Add New > Project`.
4. Importe o repositorio.
5. Em `Environment Variables`, adicione todas as variaveis da secao 2.
6. Build command: `npm run build`.
7. Output directory: `dist`.
8. Clique em `Deploy`.

## 5. Fluxo de acesso online

1. O novo usuario abre `/login`.
2. Clica em `Solicitar`.
3. Informa nome, e-mail, telefone e cria uma senha.
4. O sistema envia ao administrador um link de aprovacao com token seguro.
5. A senha nao vai no e-mail, nao vai no link e nao aparece na query string.
6. O administrador entra com `leandroalmeida861@gmail.com` e abre o link de aprovacao.
7. A funcao `/api/approve-access` valida a sessao do administrador, ativa o usuario em `usuarios_autorizados` e garante e-mail confirmado no Supabase Auth.
8. O usuario aprovado entra com a senha criada no pedido, sem confirmar outro e-mail do Supabase.

## Estrutura

```text
api/
  approve-access.js
  request-access.js
src/
  components/
  contexts/
  lib/
  pages/
supabase/
```
