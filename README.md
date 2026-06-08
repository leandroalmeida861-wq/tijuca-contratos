# Tijuca Alimentos - Gestão de Contratos

Sistema web em React + Vite + Tailwind CSS + Supabase para gestão de contratos, fornecedores, fábricas, produtos, notas fiscais, fretes, documentos e indicadores financeiros.

## Recursos

- Login e criação de senha via Supabase Auth.
- Cadastro permitido somente para `leandroalmeida861@gmail.com`.
- Rotas protegidas: usuários não autenticados voltam para `/login`.
- Dashboard responsivo com cards, gráficos, alertas de vencimento e tabela de contratos.
- CRUD de fornecedores, fábricas, produtos, contratos, notas fiscais, documentos e fretes.
- Notas fiscais vinculadas a contratos.
- Saldo e percentual de execução calculados automaticamente.
- Exportação de contratos em CSV e Excel.
- RLS no Supabase restringindo acesso ao usuário autenticado autorizado.

## 1. Criar o projeto no Supabase

1. Acesse [Supabase](https://supabase.com/) e crie um projeto gratuito.
2. No painel do projeto, abra `SQL Editor`.
3. Copie o conteúdo de `supabase/schema.sql`.
4. Execute o SQL.
5. Vá em `Authentication > Providers > Email`.
6. Deixe o provedor de e-mail ativado.
7. Para entrar sem confirmação por e-mail durante testes, desative `Confirm email`. Em produção, você pode deixar ativado.

## 2. Configurar variáveis de ambiente

1. No Supabase, abra `Project Settings > API`.
2. Copie:
   - `Project URL`
   - `anon public key`
3. Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

O arquivo `.env.example` mostra o mesmo formato.

## 3. Rodar localmente

Instale as dependências:

```bash
npm install
```

Rode o projeto:

```bash
npm run dev
```

Acesse o endereço exibido pelo Vite, normalmente `http://localhost:5173`.

## 4. Publicar na Vercel

1. Envie este projeto para um repositório GitHub.
2. Acesse [Vercel](https://vercel.com/).
3. Clique em `Add New > Project`.
4. Importe o repositório.
5. Em `Environment Variables`, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Build command: `npm run build`.
7. Output directory: `dist`.
8. Clique em `Deploy`.

## 5. Acessar o sistema online

1. Abra a URL gerada pela Vercel.
2. Clique em `Criar senha`.
3. Use exatamente o e-mail:

```text
leandroalmeida861@gmail.com
```

4. Defina uma senha.
5. Se a confirmação de e-mail estiver ativa no Supabase, confirme o e-mail antes de entrar.
6. Faça login e acesse o dashboard.

Qualquer outro e-mail é bloqueado no frontend com a mensagem `E-mail não autorizado para cadastro.` e também não passa pelas políticas RLS do banco.

## Estrutura

```text
src/
  components/
  contexts/
  lib/
  pages/
  styles/
supabase/
  schema.sql
  seed.sql
```

## Observações de produção

- O app usa apenas frontend estático, então funciona no plano gratuito da Vercel.
- O banco e autenticação usam o plano gratuito do Supabase.
- As políticas RLS conferem `auth.email()` e `auth.uid()`.
- O gatilho `notas_recalcular_contrato` recalcula `quantidade_recebida` sempre que uma nota fiscal é criada, alterada ou excluída.
