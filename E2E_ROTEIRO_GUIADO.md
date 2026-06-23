# Roteiro E2E Guiado - AgroFlow

Ambiente do app: https://agroflow-sistema.vercel.app
Projeto Supabase: `imbdshylpobrtaxvkfxb`

Importante: nao envie `SUPABASE_SERVICE_ROLE_KEY` pelo chat.

## Dados de teste sugeridos

Usuario teste 1:

- Nome: `Usuario E2E AgroFlow`
- E-mail: `agroflow.e2e.teste+001@gmail.com`
- Telefone: `(11) 90000-0001`
- Senha inicial: `TesteE2E@123`
- Nova senha: `TesteE2E@456`

Dados operacionais:

- Fornecedor: `FORNECEDOR E2E TESTE`
- Fabrica: `FABRICA E2E TESTE`
- Produto: `SOJA E2E`
- Contrato: `CT-E2E-001`
- Nota fiscal: `NF-E2E-001`
- Frete/CT-e: `CTE-E2E-001`

## Checklist guiado

### 1. Validar configuracao de e-mail no Supabase

Onde clicar:

1. Abra o Supabase Dashboard.
2. Entre no projeto `imbdshylpobrtaxvkfxb`.
3. Clique em `Authentication`.
4. Clique em `Providers`.
5. Clique em `Email`.

Verifique:

- Se `Confirm email` esta ativado ou desativado.

Resultado esperado:

- Se estiver desativado: usuario novo consegue entrar apos aprovacao do AgroFlow sem confirmar e-mail extra do Supabase.
- Se estiver ativado: usuario novo precisa confirmar o e-mail automatico enviado pelo Supabase antes de entrar.

Se falhar:

- Mensagem no app: `E-mail ainda nao confirmado pelo Supabase`.
- Provavel causa: `Confirm email` ativado.
- Correcao: confirmar o e-mail recebido ou desativar `Confirm email`.

### 2. Criar novo usuario pelo fluxo normal do app

Onde clicar:

1. Abra https://agroflow-sistema.vercel.app/login
2. Clique em `Solicitar`.
3. Preencha:
   - Nome: `Usuario E2E AgroFlow`
   - E-mail: `agroflow.e2e.teste+001@gmail.com`
   - Telefone: `(11) 90000-0001`
   - Senha desejada: `TesteE2E@123`
   - Confirmar senha: `TesteE2E@123`
   - Observacao: `Teste E2E guiado`
4. Clique em `Enviar pedido de acesso`.

Resultado esperado:

- O pedido e enviado.
- O admin recebe e-mail da Netlify com:
  - nome
  - e-mail
  - senha
  - confirmar senha
  - link de liberacao

Se falhar:

- Se senha nao aparecer no e-mail: verificar campos `senha` e `confirmar_senha` no e-mail da Netlify.
- Se o pedido nao chegar: verificar spam/lixo eletronico e configuracao do Netlify Forms.

### 3. Aprovar usuario pelo link recebido

Onde clicar:

1. Abra o e-mail recebido pelo admin.
2. Clique no `Link Liberacao`.
3. Se nao estiver logado como admin no Supabase/app, primeiro entre com admin no app.

Resultado esperado:

- Tela mostra: `Acesso liberado para agroflow.e2e.teste+001@gmail.com`.
- Se admin estiver com sessao Supabase ativa, tambem deve liberar no banco.

Se falhar:

- Mensagem dizendo que precisa entrar como administrador.
- Provavel causa: link aberto sem sessao admin Supabase.
- Correcao: entrar no app com `leandroalmeida861@gmail.com` e abrir o link novamente.

### 4. Confirmar usuario em Authentication > Users

Onde clicar:

1. Supabase Dashboard.
2. `Authentication`.
3. `Users`.
4. Pesquise por `agroflow.e2e.teste+001@gmail.com`.

Resultado esperado:

- Usuario aparece na lista.
- Se `Confirm email` estiver ligado, conferir se esta como confirmado ou aguardando confirmacao.

Se falhar:

- Usuario nao aparece.
- Provavel causa: usuario ainda nao tentou login apos aprovacao, pois o app cria a conta Supabase no primeiro login aprovado.
- Correcao: tentar login com o usuario aprovado e conferir novamente.

### 5. Confirmar autorizacao no banco

Onde clicar:

1. Supabase Dashboard.
2. `SQL Editor`.
3. Abra `New query`.
4. Rode:

```sql
select email, nome, ativo, liberado_em
from public.usuarios_autorizados
where lower(email) = lower('agroflow.e2e.teste+001@gmail.com');
```

Resultado esperado:

- Deve retornar 1 linha.
- `ativo = true`.

Se falhar:

- Nao retornou linha.
- Provavel causa: SQL `agroflow_liberar_email_direto` nao aplicado ou aprovacao aberta sem admin logado.
- Correcao: aplicar `supabase/liberar-email-direto.sql` e aprovar novamente.

### 6. Login com credenciais validas

Onde clicar:

1. Abra https://agroflow-sistema.vercel.app/login
2. Clique em `Entrar`.
3. E-mail: `agroflow.e2e.teste+001@gmail.com`
4. Senha: `TesteE2E@123`
5. Clique em `Entrar no sistema`.

Resultado esperado:

- App abre o Dashboard.
- Menu lateral aparece.
- Nao aparece `Acesso negado pelo banco de dados`.

Se falhar:

- `E-mail ainda nao confirmado pelo Supabase`: confirmar e-mail ou desativar `Confirm email`.
- `Acesso negado pelo banco de dados`: usuario nao esta em `usuarios_autorizados` ou RLS nao reconheceu auth.email().
- `Invalid login credentials`: senha errada ou usuario ainda nao existe em Auth Users.

### 7. Login com credenciais invalidas

Onde clicar:

1. Saia do sistema.
2. Entre com e-mail `agroflow.e2e.teste+001@gmail.com`.
3. Use senha errada: `SenhaErrada123`.

Resultado esperado:

- Login bloqueado.
- Mensagem em portugues orientando como corrigir.

Se falhar:

- Se entrar com senha errada: problema grave de autenticacao.
- Correcao: revisar `AuthContext.jsx` e Supabase Auth.

### 8. Criar registros reais

Entre no app com usuario teste ou admin autorizado.

Fornecedor:

1. Menu `Fornecedores`.
2. Nome: `FORNECEDOR E2E TESTE`.
3. CNPJ: `00.000.000/0001-91`.
4. Cidade: `Fortaleza`.
5. UF: `CE`.
6. Clique em `Cadastrar`.

Fabrica:

1. Menu `Fabricas`.
2. Nome: `FABRICA E2E TESTE`.
3. CNPJ: `11.111.111/0001-91`.
4. Cidade: `Beberibe`.
5. UF: `CE`.
6. Clique em `Cadastrar`.

Produto:

1. Menu `Produtos`.
2. Nome: `SOJA E2E`.
3. Unidade: `KG`.
4. Clique em `Cadastrar`.

Contrato:

1. Menu `Contratos`.
2. Numero: `CT-E2E-001`.
3. Selecione o fornecedor, produto e fabrica criados.
4. Quantidade contratada: `1000`.
5. Custo KG: `0.42`.
6. Vencimento: uma data futura.
7. Clique em `Cadastrar`.

Resultado esperado:

- Registros aparecem nas tabelas do app.
- Nao aparece erro de RLS/permissao.

### 9. Confirmar persistencia no banco

Rode no SQL Editor:

```sql
select id, nome, cnpj, cidade, uf, created_at
from public.fornecedores
where nome = 'FORNECEDOR E2E TESTE';

select id, nome, cnpj, cidade, uf, created_at
from public.fabricas
where nome = 'FABRICA E2E TESTE';

select id, nome, unidade, created_at
from public.produtos
where nome = 'SOJA E2E';

select c.id, c.numero_contrato, f.nome as fornecedor, p.nome as produto, c.quantidade_contratada, c.custo_kg
from public.contratos c
join public.fornecedores f on f.id = c.fornecedor_id
join public.produtos p on p.id = c.produto_id
where c.numero_contrato = 'CT-E2E-001';
```

Resultado esperado:

- Cada consulta retorna o registro criado.

### 10. Editar registros reais

Onde clicar:

1. Menu `Fornecedores`.
2. No fornecedor `FORNECEDOR E2E TESTE`, clique no icone de editar.
3. Altere cidade para `Fortaleza E2E`.
4. Salve.

SQL para validar:

```sql
select nome, cidade
from public.fornecedores
where nome = 'FORNECEDOR E2E TESTE';
```

Resultado esperado:

- Cidade deve ser `Fortaleza E2E`.

### 11. Excluir registros reais

Ordem recomendada:

1. Excluir notas fiscais E2E, se houver.
2. Excluir fretes E2E, se houver.
3. Excluir contrato `CT-E2E-001`.
4. Excluir produto `SOJA E2E`.
5. Excluir fabrica `FABRICA E2E TESTE`.
6. Excluir fornecedor `FORNECEDOR E2E TESTE`.

SQL para validar limpeza:

```sql
select count(*) as fornecedores
from public.fornecedores
where nome = 'FORNECEDOR E2E TESTE';

select count(*) as fabricas
from public.fabricas
where nome = 'FABRICA E2E TESTE';

select count(*) as produtos
from public.produtos
where nome = 'SOJA E2E';

select count(*) as contratos
from public.contratos
where numero_contrato = 'CT-E2E-001';
```

Resultado esperado:

- Todos os contadores devem ser `0`.

### 12. Recuperacao de senha ponta a ponta

Onde clicar:

1. Supabase Dashboard.
2. `Authentication`.
3. `Users`.
4. Abra o usuario `agroflow.e2e.teste+001@gmail.com`.
5. Use a opcao de enviar recovery/reset password, se disponivel no painel.
6. Abra o e-mail do usuario teste.
7. Clique no link.
8. Defina a nova senha: `TesteE2E@456`.
9. Tente entrar no app com a nova senha.

Resultado esperado:

- Senha antiga para de funcionar.
- Nova senha entra.

Se falhar:

- Link redireciona errado: configurar URL do site em Authentication > URL Configuration.
- E-mail nao chega: verificar SMTP/Supabase Auth e spam.

### 13. Troca de senha apos login

Fluxo atual do AgroFlow:

1. Na tela de login, clique `Alterar senha de usuario liberado`.
2. Informe e-mail do usuario liberado.
3. Nova senha: `TesteE2E@456`.
4. Confirmar nova senha: `TesteE2E@456`.

Resultado esperado:

- Para usuario comum liberado, senha local e atualizada.
- Para admin, app bloqueia e orienta usar senha do Supabase.

Observacao:

- Para trocar senha real do Supabase apos login, usar o fluxo de recovery do Supabase ou uma funcao dedicada futura.

### 14. Testar permissoes entre perfis

Perfil autorizado:

1. Entre com `agroflow.e2e.teste+001@gmail.com`.
2. Tente abrir Dashboard, Fornecedores e Contratos.

Resultado esperado:

- Deve abrir se o e-mail estiver em `usuarios_autorizados` e confirmado no Supabase.

Perfil nao autorizado:

1. Crie outro usuario no app: `agroflow.e2e.negado+001@gmail.com`.
2. Nao aprove o link.
3. Tente login.

Resultado esperado:

- Login bloqueado ou sem acesso aos dados.

SQL para validar autorizados:

```sql
select email, ativo
from public.usuarios_autorizados
where email in (
  'agroflow.e2e.teste+001@gmail.com',
  'agroflow.e2e.negado+001@gmail.com'
);
```

Resultado esperado:

- Usuario aprovado: aparece com `ativo = true`.
- Usuario nao aprovado: nao aparece, ou aparece com `ativo = false`.

### 15. Verificar logs do Supabase

Onde clicar:

1. Supabase Dashboard.
2. `Logs`.
3. Verifique:
   - `Auth`
   - `Postgres`
   - `API`

Filtros sugeridos:

- E-mail: `agroflow.e2e.teste+001@gmail.com`
- Tabela: `usuarios_autorizados`
- Termos: `permission denied`, `row-level security`, `invalid login`, `email not confirmed`

Resultado esperado:

- Login valido sem erro.
- Tentativa invalida registrada como falha de Auth.
- Nenhum erro inesperado de RLS para usuario autorizado.

### 16. Verificar politicas RLS

SQL seguro para inspecionar politicas:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'fornecedores',
    'fabricas',
    'produtos',
    'contratos',
    'notas_fiscais',
    'documentos',
    'fretes',
    'usuarios_autorizados',
    'solicitacoes_acesso'
  )
order by tablename, policyname;
```

Resultado esperado:

- Tabelas operacionais devem exigir `public.is_tijuca_authorized()` e `user_id = auth.uid()`.
- Tabelas de autorizacao devem ser restritas ao admin.

SQL para validar funcao de autorizacao:

```sql
select public.agroflow_email_liberado('agroflow.e2e.teste+001@gmail.com') as usuario_teste_liberado;
select public.agroflow_email_liberado('agroflow.e2e.negado+001@gmail.com') as usuario_negado_liberado;
```

Resultado esperado:

- Usuario aprovado: `true`.
- Usuario nao aprovado: `false`.

## Relatorio E2E

Preencha durante a execucao:

| Etapa | Status | Evidencia | Observacao |
|---|---|---|---|
| Configuracao Email Supabase | Pendente | | |
| Solicitar usuario teste | Pendente | | |
| Receber e-mail admin | Pendente | | |
| Aprovar usuario pelo link | Pendente | | |
| Usuario aparece em Auth Users | Pendente | | |
| Usuario aparece em usuarios_autorizados | Pendente | | |
| Confirmacao de e-mail Supabase | Pendente | | |
| Login valido | Pendente | | |
| Login invalido | Pendente | | |
| Criar fornecedor/fabrica/produto/contrato | Pendente | | |
| Confirmar persistencia SQL | Pendente | | |
| Editar registro | Pendente | | |
| Excluir registros | Pendente | | |
| Recuperacao de senha | Pendente | | |
| Novo login com senha alterada | Pendente | | |
| Perfil nao autorizado bloqueado | Pendente | | |
| Logs Supabase sem erro inesperado | Pendente | | |
| Politicas RLS revisadas | Pendente | | |

Status final:

- Aprovado: somente se todas as etapas criticas passarem.
- Nao aprovado: se usuario real nao conseguir autenticar, se houver falha de RLS, se dados nao persistirem ou se recuperacao de senha falhar.
