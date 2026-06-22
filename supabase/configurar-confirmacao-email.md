# AgroFlow - confirmação de e-mail no Supabase

Quando um usuário novo é aprovado pelo link do AgroFlow, o aplicativo cria a conta dele no Supabase no primeiro login.

Se o Supabase estiver com confirmação de e-mail obrigatória, o usuário verá:

`E-mail ainda nao confirmado pelo Supabase.`

## Opção recomendada para o AgroFlow

No painel do Supabase:

1. Abra o projeto do AgroFlow.
2. Vá em `Authentication`.
3. Abra `Providers`.
4. Entre em `Email`.
5. Desative a opção `Confirm email`.
6. Salve.

Depois disso, usuários aprovados pelo link do AgroFlow entram sem precisar confirmar outro e-mail do Supabase.

## Se preferir manter a confirmação do Supabase

O usuário precisa abrir o e-mail automático enviado pelo Supabase e confirmar o cadastro.

O link agora volta para:

`https://sistema.agroflow.com.br/login`
