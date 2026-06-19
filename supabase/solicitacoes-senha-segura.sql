-- AgroFlow - senha temporaria protegida no fluxo de solicitacao de acesso.
-- Altera somente public.solicitacoes_acesso e preserva todos os dados existentes.

alter table public.solicitacoes_acesso
  add column if not exists senha_criptografada text;

alter table public.solicitacoes_acesso
  drop constraint if exists solicitacoes_acesso_status_check;

alter table public.solicitacoes_acesso
  add constraint solicitacoes_acesso_status_check
  check (status in ('pendente', 'aprovado', 'rejeitado', 'expirado', 'cancelado'));

comment on column public.solicitacoes_acesso.senha_criptografada is
  'Senha temporaria cifrada no backend com AES-256-GCM. Deve ser apagada ao aprovar, rejeitar ou expirar.';
