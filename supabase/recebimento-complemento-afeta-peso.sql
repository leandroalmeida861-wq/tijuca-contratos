-- AgroFlow - distingue complemento de peso de complemento apenas financeiro.
-- Migration incremental: o padrao true preserva integralmente os registros existentes.

alter table public.recebimento_notas_complementares
add column if not exists afeta_peso boolean not null default true;

comment on column public.recebimento_notas_complementares.afeta_peso is
'Quando false, a nota complementar permanece no financeiro, mas nao altera peso ou diferenca do recebimento.';
