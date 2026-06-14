# AgroFlow - Gestao de Contratos

Sistema web em React + Vite + Tailwind CSS + Supabase para gestao de contratos, fornecedores, fabricas, produtos, notas fiscais, fretes, documentos e indicadores financeiros.

## Recursos

- Login via Supabase Auth.
- Solicitacao de acesso com aprovacao do administrador.
- Convite oficial do Supabase enviado pela funcao segura da Vercel usando `SUPABASE_SERVICE_ROLE_KEY`.
- Rotas protegidas: usuarios nao autenticados voltam para `/login`.
- Perfis `admin`, `operador` e `consulta`.
- Dashboard responsivo com cards, graficos, alertas de vencimento e tabela de contratos.
- CRUD de fornecedores, fabricas, produtos, contratos, notas fiscais, documentos e fretes.
- Notas fiscais vinculadas a contratos.
- Saldo e percentual de execucao calculados automaticamente.
- Exportacao de contratos em CSV e Excel.
- RLS no Supabase restringindo acesso ao usuario autenticado autorizado.

## 1. Criar o projeto no Supabase

1. Acesse [Supabase](https://supabase.com/) e crie um projeto gratuito.
2. No painel do projeto, abra `SQL Editor`.
3. Execute o SQL principal do projeto e depois `supabase/agroflow-acesso-perfis.sql`.
4. Va em `Authentication > Providers > Email`.
5. Deixe o provedor de e-mail ativado.
6. O `Confirm email` pode ficar ativado. Usuarios aprovados recebem convite oficial do Supabase para criar senha.

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
3. Informa nome, e-mail, telefone e observacao.
4. O sistema grava o pedido em `solicitacoes_acesso`.
5. O administrador recebe um link neste formato:

```text
https://agroflow-contratos.vercel.app/api/aprovar-acesso?token=TOKEN
```

6. O link tem somente token. Nunca envie senha, e-mail, nome ou `service_role` por query string.
7. A funcao `/api/aprovar-acesso` usa `SUPABASE_SERVICE_ROLE_KEY` apenas no backend, aprova o pedido, cria/atualiza `usuarios_autorizados` com perfil `operador` e envia convite do Supabase.
8. O usuario recebe o convite, cria a senha e entra em `https://agroflow-contratos.vercel.app/login`.
9. O login consulta `usuarios_autorizados`; usuarios sem `status = ativo` sao bloqueados.

## Estrutura

```text
api/
  aprovar-acesso.js
  solicitar-acesso.js
  approve-access.js      # compatibilidade
  request-access.js      # compatibilidade
src/
  components/
  contexts/
  lib/
  pages/
supabase/
  agroflow-acesso-perfis.sql
```

## Checklist rapido de teste

1. Solicite acesso com um e-mail novo pela tela `/login`.
2. Confirme no Supabase que a linha entrou em `solicitacoes_acesso` com `status = pendente`.
3. Abra o link recebido pelo administrador.
4. Confirme que o navegador redirecionou para `/admin/solicitacoes?sucesso=usuario_aprovado`.
5. Confirme em `usuarios_autorizados` que o e-mail ficou com `perfil = operador` e `status = ativo`.
6. Confirme em `Authentication > Users` que o usuario foi convidado.
7. Abra o convite no e-mail do usuario, crie a senha e entre no sistema.
8. Confirme que nao aparece erro de e-mail nao confirmado.
9. Confirme que usuario `operador` consegue cadastrar/editar dados operacionais e nao acessa funcoes restritas de admin.
