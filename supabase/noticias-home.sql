-- Notícias da página inicial do AgroFlow.
-- Migration incremental: cria somente a estrutura de notícias e não altera módulos existentes.

create table if not exists public.noticias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.agroflow_empresa_atual_id() references public.empresas(id),
  categoria text not null,
  titulo text not null,
  resumo text not null,
  conteudo text not null,
  data_publicacao date not null default current_date,
  fonte text not null,
  fonte_url text,
  publicado boolean not null default false,
  destaque boolean not null default false,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint noticias_categoria_check check (
    categoria in ('reforma_tributaria', 'financeiro_economia', 'mercado_graos', 'agronegocio')
  ),
  constraint noticias_titulo_check check (char_length(trim(titulo)) between 4 and 180),
  constraint noticias_resumo_check check (char_length(trim(resumo)) between 10 and 420),
  constraint noticias_conteudo_check check (char_length(trim(conteudo)) >= 30),
  constraint noticias_fonte_check check (char_length(trim(fonte)) between 2 and 120),
  constraint noticias_fonte_url_check check (
    fonte_url is null or fonte_url ~* '^https://[^[:space:]]+$'
  )
);

create index if not exists noticias_publicadas_idx
  on public.noticias (empresa_id, publicado, destaque desc, data_publicacao desc);

create index if not exists noticias_categoria_idx
  on public.noticias (empresa_id, categoria, publicado, data_publicacao desc);

create index if not exists noticias_created_by_idx
  on public.noticias (created_by);

create index if not exists noticias_updated_by_idx
  on public.noticias (updated_by);

create or replace function public.agroflow_atualizar_noticia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists noticias_atualizar_metadados on public.noticias;
create trigger noticias_atualizar_metadados
before insert or update on public.noticias
for each row execute function public.agroflow_atualizar_noticia();

create or replace function public.agroflow_auditar_noticia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_empresa_id uuid := case when tg_op = 'DELETE' then old.empresa_id else new.empresa_id end;
  v_perfil text;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select p.perfil
  into v_perfil
  from public.profiles p
  where p.user_id = auth.uid()
    and p.empresa_id = v_empresa_id
  limit 1;

  insert into public.audit_logs (
    user_id,
    perfil,
    acao,
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos
  )
  values (
    auth.uid(),
    v_perfil,
    lower(tg_op),
    'noticias',
    v_id::text,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists noticias_auditoria on public.noticias;
create trigger noticias_auditoria
after insert or update or delete on public.noticias
for each row execute function public.agroflow_auditar_noticia();

alter table public.noticias enable row level security;

drop policy if exists noticias_select on public.noticias;
drop policy if exists noticias_admin_insert on public.noticias;
drop policy if exists noticias_admin_update on public.noticias;
drop policy if exists noticias_admin_delete on public.noticias;

create policy noticias_select
on public.noticias
for select
to authenticated
using (
  empresa_id = public.agroflow_empresa_atual_id()
  and (publicado or public.agroflow_is_admin())
);

create policy noticias_admin_insert
on public.noticias
for insert
to authenticated
with check (
  public.agroflow_is_admin()
  and empresa_id = public.agroflow_empresa_atual_id()
);

create policy noticias_admin_update
on public.noticias
for update
to authenticated
using (
  public.agroflow_is_admin()
  and empresa_id = public.agroflow_empresa_atual_id()
)
with check (
  public.agroflow_is_admin()
  and empresa_id = public.agroflow_empresa_atual_id()
);

create policy noticias_admin_delete
on public.noticias
for delete
to authenticated
using (
  public.agroflow_is_admin()
  and empresa_id = public.agroflow_empresa_atual_id()
);

grant select, insert, update, delete on public.noticias to authenticated;
revoke all on public.noticias from anon;

with empresa as (
  select id
  from public.empresas
  order by id
  limit 1
),
sementes (
  categoria,
  titulo,
  resumo,
  conteudo,
  data_publicacao,
  fonte,
  fonte_url
) as (
  values
    (
      'reforma_tributaria',
      'Reforma Tributária: orientações para CBS e IBS em 2026',
      'A Receita Federal detalha obrigações de documentos fiscais e regras do ano de testes da CBS e do IBS.',
      'A Receita Federal orienta que os documentos fiscais eletrônicos abrangidos pelas regras de 2026 sejam emitidos com o destaque individualizado da CBS e do IBS, conforme os leiautes e notas técnicas aplicáveis.

O ano de 2026 funciona como período de testes. De acordo com a orientação oficial, o cumprimento das obrigações acessórias previstas permite a dispensa do recolhimento dos tributos de teste nas situações estabelecidas.

A página oficial também informa que, a partir de julho de 2026, pessoas físicas contribuintes da CBS e do IBS deverão se inscrever no CNPJ. Essa inscrição tem finalidade cadastral e de apuração e, por si só, não transforma a pessoa física em pessoa jurídica.',
      date '2026-05-06',
      'Receita Federal',
      'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026'
    ),
    (
      'financeiro_economia',
      'Copom reduz a taxa Selic para 14,25% ao ano',
      'O Banco Central anunciou redução da taxa básica de juros e reforçou a necessidade de cautela diante do cenário econômico.',
      'Na 279ª reunião, realizada em junho de 2026, o Comitê de Política Monetária reduziu a taxa Selic para 14,25% ao ano.

O comunicado destacou um ambiente externo ainda incerto e a necessidade de cautela para economias emergentes. No cenário doméstico, o Banco Central apontou aceleração da atividade no primeiro trimestre, mercado de trabalho resiliente e inflação ainda acima da meta.

Para empresas do agronegócio, a taxa básica influencia o custo do crédito, o planejamento de investimentos, a formação de estoques e a negociação de financiamentos. A análise das condições específicas de cada operação continua sendo necessária.',
      date '2026-06-17',
      'Banco Central do Brasil',
      'https://www.bcb.gov.br/controleinflacao/comunicadoscopom'
    ),
    (
      'mercado_graos',
      'Conab estima safra de grãos em 358,6 milhões de toneladas',
      'A estimativa para 2025/26 mantém a expectativa de produção recorde, com destaque para soja, milho e sorgo.',
      'A Companhia Nacional de Abastecimento estimou a produção brasileira de grãos da safra 2025/26 em 358,6 milhões de toneladas, aumento de 5,7 milhões de toneladas sobre o volume anterior.

A soja aparece com produção estimada em 180,3 milhões de toneladas. Para o milho, somadas as três safras, a projeção informada é de 140,5 milhões de toneladas. O levantamento também registra evolução do sorgo e acompanha as perspectivas para algodão, arroz, feijão e trigo.

Segundo a Conab, a produção recorde de soja permite expectativa de exportações maiores e de ampliação do processamento interno. As projeções podem ser revisadas nos levantamentos seguintes conforme clima, colheita e condições de mercado.',
      date '2026-06-11',
      'Conab',
      'https://cast.conab.gov.br/post/2026-06-11_9_lev_graos/'
    ),
    (
      'agronegocio',
      'Agronegócio brasileiro encerra 2025 com recorde de exportações',
      'As exportações do setor somaram US$ 169,2 bilhões, com crescimento de volume e participação relevante nas vendas externas brasileiras.',
      'O Ministério da Agricultura e Pecuária informou que as exportações brasileiras do agronegócio totalizaram US$ 169,2 bilhões em 2025, crescimento de 3% em comparação com 2024.

O resultado foi acompanhado por aumento de 3,6% no volume exportado, compensando a redução observada nos preços médios. O agronegócio respondeu por 48,5% do valor total exportado pelo Brasil naquele ano.

O desempenho reforça a importância do acompanhamento de mercados, logística, custos, contratos e condições comerciais. Esses indicadores ajudam empresas e produtores a planejar operações, sem substituir análises específicas de risco e mercado.',
      date '2026-01-08',
      'Ministério da Agricultura e Pecuária',
      'https://www.gov.br/agricultura/pt-br/assuntos/noticias/agronegocio-brasileiro-fecha-2025-com-recorde-em-exportacoes-de-us-169-bilhoes-e-superavit-de-us-149-07-bilhoes'
    )
)
insert into public.noticias (
  empresa_id,
  categoria,
  titulo,
  resumo,
  conteudo,
  data_publicacao,
  fonte,
  fonte_url,
  publicado,
  destaque
)
select
  e.id,
  s.categoria,
  s.titulo,
  s.resumo,
  s.conteudo,
  s.data_publicacao,
  s.fonte,
  s.fonte_url,
  true,
  true
from empresa e
cross join sementes s
where not exists (
  select 1
  from public.noticias n
  where n.empresa_id = e.id
    and n.titulo = s.titulo
);
