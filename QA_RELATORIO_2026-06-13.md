# Relatorio de QA - AgroFlow

Data: 2026-06-13
Ambiente: https://agroflow-sistema.vercel.app

## Cenarios testados

1. Cadastro/solicitacao de novo usuario
   - Tela `Solicitar` carregada no navegador publicado.
   - Campos verificados: nome, e-mail, telefone, senha, confirmar senha, observacao.
   - Teste automatizado validou montagem do pedido com senha, confirmar senha e link de liberacao.

2. Login com credenciais validas
   - Teste automatizado validou login com usuario aprovado e senha correta no fluxo local.
   - Observacao: login real com banco depende de conta confirmada/autorizada no Supabase.

3. Login com credenciais invalidas
   - Teste automatizado validou bloqueio com senha errada.
   - Mensagem validada: erro em portugues com orientacao de correcao.

4. Recuperacao/troca de senha
   - Teste automatizado validou troca de senha de usuario liberado.
   - Teste validou que a senha antiga para de funcionar e a nova senha entra.

5. Validacao de e-mail
   - Bundle publicado contem mensagem especifica para confirmacao do Supabase.
   - Fluxo agora informa que a confirmacao extra vem do Supabase.

6. Recebimento e confirmacao de e-mail
   - Nao foi possivel abrir caixa de e-mail real nesta sessao.
   - O app foi ajustado para redirecionar confirmacao do Supabase para `/login`.
   - Configuracao recomendada documentada em `supabase/configurar-confirmacao-email.md`.

7. Logout
   - Fluxo de logout ja validado anteriormente no navegador.
   - Protecao de rota atual foi revalidada: `/contratos` sem login redireciona para `/login`.

8. Permissoes/autorizacao
   - Corrigido para admin sempre autenticar via Supabase.
   - Corrigido para reconhecer autorizacao do banco via `agroflow_email_liberado`.
   - SQL `supabase/liberar-email-direto.sql` aplicado pelo administrador.

9. Formulario, botoes, links e fluxos principais
   - Rotas publicadas testadas: `/`, `/login`, `/fornecedores`, `/fabricas`, `/produtos`, `/contratos`, `/notas-fiscais`, `/frete`, `/documentos`, `/rel-financeiro`, `/backup`.
   - Todas responderam `200` e entregaram o app React.
   - Bundle contem recursos criticos: Backup completo, Importar PDF, bloqueio de nao PDF, confirmacao de e-mail.

10. Desktop e mobile
   - Desktop: login carregou sem erro de console.
   - Mobile 390x844: login, Solicitar e marca AgroFlow visiveis sem erro de console.

## Evidencias

- `scripts/test-access-flow.mjs`: todos os testes passaram.
- `scripts/test-backup-import.mjs`: todos os testes passaram.
- `scripts/test-ui-contracts.mjs`: todos os testes passaram.
- Navegador publicado:
  - `/login`: carregou sem erro de console.
  - `/contratos`: redirecionou para `/login` sem usuario logado.
  - Mobile 390x844: carregou sem erro de console.

## Erros encontrados

- A automacao do navegador nao conseguiu preencher alguns campos via clipboard por limitacao da ferramenta Browser Use.
- Nao houve erro funcional observado no site publicado durante esta rodada.

## Correcoes realizadas nesta rodada

- Adicionada bateria `test:ui` para validar rotas publicadas e textos/recursos criticos do bundle.
- Registrado este relatorio de QA no projeto.

## Problemas pendentes

- Confirmacao de e-mail real depende da caixa de entrada do usuario e da configuracao do Supabase.
- Para usuarios entrarem sem e-mail extra do Supabase, desative `Confirm email` em Authentication > Providers > Email.
- Teste de CRUD real com dados do Supabase precisa de senha do admin ou sessao admin ativa; nao foi executado para nao usar credenciais sem confirmacao do usuario.

## Avaliacao geral

O sistema esta estavel nos fluxos publicos, protecao de rota, backup/importacao, mensagens de acesso e responsividade basica. O principal ponto operacional e configurar corretamente a confirmacao de e-mail no Supabase para evitar bloqueio de novos usuarios.
