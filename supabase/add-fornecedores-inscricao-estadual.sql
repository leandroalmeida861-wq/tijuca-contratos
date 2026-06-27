-- AgroFlow - adiciona inscricao estadual ao cadastro de fornecedores.
-- Seguro para producao: nao apaga dados e nao altera policies.

alter table public.fornecedores
  add column if not exists inscricao_estadual text;
