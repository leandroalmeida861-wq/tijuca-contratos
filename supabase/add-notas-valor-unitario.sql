alter table public.notas_fiscais
add column if not exists valor_unitario numeric(18, 10),
add column if not exists valor_unitario_decimais integer;

notify pgrst, 'reload schema';
