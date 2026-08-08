-- A função é um detalhe interno das RPCs transacionais e não deve ser exposta
-- diretamente na API para usuários autenticados.
revoke all on function public.oficina_messejana_saldo_fornecedor(uuid,uuid,uuid,uuid)
from public, anon, authenticated;
