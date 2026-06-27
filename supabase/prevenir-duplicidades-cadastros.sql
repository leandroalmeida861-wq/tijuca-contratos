-- AgroFlow - Prevencao de duplicidades em cadastros
-- SQL incremental: nao apaga dados existentes e nao altera permissoes.

create extension if not exists unaccent;

create or replace function public.agroflow_normalizar_texto(valor text)
returns text
language sql
stable
as $$
  select regexp_replace(
    lower(unaccent(coalesce(valor, ''))),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.agroflow_apenas_digitos(valor text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(valor, ''), '\D', '', 'g');
$$;

create or replace function public.agroflow_normalizar_produto(valor text)
returns text
language sql
stable
as $$
  with palavras as (
    select unnest(regexp_split_to_array(
      regexp_replace(
        lower(unaccent(coalesce(valor, ''))),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+'
    )) as palavra
  )
  select coalesce(string_agg(palavra, ''), '')
  from palavras
  where palavra <> ''
    and palavra not in ('em', 'grao', 'graos');
$$;

create or replace function public.agroflow_normalizar_placa(valor text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(valor, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create or replace function public.agroflow_bloquear_produto_duplicado()
returns trigger
language plpgsql
as $$
declare
  chave text;
  existente text;
begin
  chave := public.agroflow_normalizar_produto(new.nome);
  if chave = '' then
    return new;
  end if;

  select nome into existente
  from public.produtos
  where id <> new.id
    and public.agroflow_normalizar_produto(nome) = chave
  limit 1;

  if existente is not null then
    raise exception 'Produto duplicado. "%" ja esta cadastrado como "%". Como corrigir: use o cadastro existente ou edite o produto ja salvo.', new.nome, existente
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agroflow_bloquear_produto_duplicado on public.produtos;
create trigger trg_agroflow_bloquear_produto_duplicado
before insert or update of nome on public.produtos
for each row execute function public.agroflow_bloquear_produto_duplicado();

create or replace function public.agroflow_bloquear_veiculo_duplicado()
returns trigger
language plpgsql
as $$
declare
  existente text;
begin
  select placa into existente
  from public.recebimento_veiculos
  where id <> new.id
    and public.agroflow_normalizar_placa(placa) = public.agroflow_normalizar_placa(new.placa)
  limit 1;

  if existente is not null then
    raise exception 'Veiculo duplicado. A placa "%" ja esta cadastrada. Como corrigir: use o cadastro existente ou edite o veiculo ja salvo.', new.placa
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agroflow_bloquear_veiculo_duplicado on public.recebimento_veiculos;
create trigger trg_agroflow_bloquear_veiculo_duplicado
before insert or update of placa on public.recebimento_veiculos
for each row execute function public.agroflow_bloquear_veiculo_duplicado();

create or replace function public.agroflow_bloquear_motorista_duplicado()
returns trigger
language plpgsql
as $$
declare
  existente text;
  cpf_novo text;
begin
  cpf_novo := public.agroflow_apenas_digitos(new.cpf);

  if cpf_novo <> '' then
    select nome into existente
    from public.recebimento_motoristas
    where id <> new.id
      and public.agroflow_apenas_digitos(cpf) = cpf_novo
    limit 1;

    if existente is not null then
      raise exception 'Motorista duplicado. Este CPF ja esta cadastrado para "%". Como corrigir: use o cadastro existente ou edite o motorista ja salvo.', existente
        using errcode = '23505';
    end if;
  end if;

  select nome into existente
  from public.recebimento_motoristas
  where id <> new.id
    and public.agroflow_normalizar_texto(nome) = public.agroflow_normalizar_texto(new.nome)
  limit 1;

  if existente is not null then
    raise exception 'Motorista duplicado. "%" ja esta cadastrado. Como corrigir: use o cadastro existente ou edite o motorista ja salvo.', new.nome
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agroflow_bloquear_motorista_duplicado on public.recebimento_motoristas;
create trigger trg_agroflow_bloquear_motorista_duplicado
before insert or update of nome, cpf on public.recebimento_motoristas
for each row execute function public.agroflow_bloquear_motorista_duplicado();

create or replace function public.agroflow_bloquear_transportadora_duplicada()
returns trigger
language plpgsql
as $$
declare
  existente text;
  cnpj_novo text;
begin
  cnpj_novo := public.agroflow_apenas_digitos(new.cnpj);

  if cnpj_novo <> '' then
    select nome into existente
    from public.recebimento_transportadoras
    where id <> new.id
      and public.agroflow_apenas_digitos(cnpj) = cnpj_novo
    limit 1;

    if existente is not null then
      raise exception 'Transportadora duplicada. Este CNPJ ja esta cadastrado para "%". Como corrigir: use o cadastro existente ou edite a transportadora ja salva.', existente
        using errcode = '23505';
    end if;
  end if;

  select nome into existente
  from public.recebimento_transportadoras
  where id <> new.id
    and public.agroflow_normalizar_texto(nome) = public.agroflow_normalizar_texto(new.nome)
  limit 1;

  if existente is not null then
    raise exception 'Transportadora duplicada. "%" ja esta cadastrada. Como corrigir: use o cadastro existente ou edite a transportadora ja salva.', new.nome
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agroflow_bloquear_transportadora_duplicada on public.recebimento_transportadoras;
create trigger trg_agroflow_bloquear_transportadora_duplicada
before insert or update of nome, cnpj on public.recebimento_transportadoras
for each row execute function public.agroflow_bloquear_transportadora_duplicada();

create or replace function public.agroflow_bloquear_laboratorio_duplicado()
returns trigger
language plpgsql
as $$
declare
  existente text;
begin
  select nome into existente
  from public.recebimento_laboratorios
  where id <> new.id
    and public.agroflow_normalizar_texto(nome) = public.agroflow_normalizar_texto(new.nome)
  limit 1;

  if existente is not null then
    raise exception 'Laboratorio duplicado. "%" ja esta cadastrado. Como corrigir: use o cadastro existente ou edite o laboratorio ja salvo.', new.nome
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agroflow_bloquear_laboratorio_duplicado on public.recebimento_laboratorios;
create trigger trg_agroflow_bloquear_laboratorio_duplicado
before insert or update of nome on public.recebimento_laboratorios
for each row execute function public.agroflow_bloquear_laboratorio_duplicado();
