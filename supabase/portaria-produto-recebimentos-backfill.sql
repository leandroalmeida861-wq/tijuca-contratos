-- AgroFlow - preservar produto da Portaria em Laboratorio/Recebimentos.
-- Corrige registros ja enviados da Portaria que tiveram produto_id apagado
-- por atualizacao parcial de status do laboratorio.
-- Nao altera portaria, fornecedor, motorista, transportadora, NF, placa, peso ou unidade.

update public.recebimentos r
set produto_id = pe.produto_id
from public.portaria_entradas pe
where r.portaria_id = pe.id
  and r.produto_id is null
  and pe.produto_id is not null;

update public.recebimento_itens ri
set produto_id = pe.produto_id
from public.recebimentos r
join public.portaria_entradas pe on pe.id = r.portaria_id
where ri.recebimento_id = r.id
  and ri.produto_id is null
  and pe.produto_id is not null;
