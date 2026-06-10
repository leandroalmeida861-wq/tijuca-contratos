# Manual do Usuario - AgroFlow

Este manual explica como usar o sistema AgroFlow para gestao de contratos, fornecedores, fabricas, produtos, notas fiscais, fretes, documentos, relatorios financeiros e backup.

## 1. Acesso ao sistema

1. Acesse o site do AgroFlow pelo navegador.
2. Informe seu e-mail e senha na tela de login.
3. Depois de entrar, voce sera direcionado ao Dashboard.
4. Para sair com seguranca, clique em `Sair` no menu lateral.

Observacao: o sistema possui acesso restrito. Apenas usuarios autorizados conseguem entrar.

## 2. Menu Dashboard

O Dashboard e a tela inicial do sistema. Ele mostra um resumo geral dos contratos.

Nesta tela voce encontra:

- `Contratado`: total contratado nos contratos cadastrados.
- `Recebido`: total ja recebido por notas fiscais.
- `Saldo`: quantidade que ainda falta receber.
- `Custo medio c/ frete`: custo medio considerando contrato e frete vinculado.
- `Contratos ativos`: quantidade de contratos ativos.
- `Fornecedores`: total de fornecedores cadastrados.
- `Vencidos`: contratos que ja passaram da data de vencimento.
- `Vencem em 30d`: contratos que vencem nos proximos 30 dias.

Graficos do Dashboard:

- `Volume por fornecedor`: mostra quanto foi contratado por fornecedor.
- `Distribuicao por produto`: mostra a participacao de cada produto nos contratos.
- `Execucao por contrato`: mostra o percentual ja recebido de cada contrato.

Tabela de contratos:

- Mostra todos os contratos cadastrados.
- Permite buscar por contrato, fornecedor ou produto.
- Permite exportar os contratos para `CSV` ou `Excel`.
- Permite acessar a tela de contratos para visualizar, editar ou excluir.

## 3. Menu Fornecedores

Use este menu para cadastrar e consultar os fornecedores.

Campos principais:

- Nome do fornecedor.
- CNPJ.
- Cidade.
- Estado.
- Telefone.
- E-mail.

Como usar:

1. Preencha os dados do fornecedor.
2. Clique em `Salvar`.
3. O fornecedor ficara disponivel para vincular em contratos, notas fiscais e relatorios.

Dica: cadastre o CNPJ corretamente, pois o sistema usa essa informacao para identificar fornecedores ao importar XML de nota fiscal.

## 4. Menu Fabricas

Use este menu para cadastrar as fabricas ou unidades que recebem os produtos.

Campos principais:

- Nome da fabrica.
- CNPJ.
- Cidade.
- Estado.
- Observacoes, quando houver.

Como usar:

1. Cadastre a fabrica antes de criar o contrato, quando o contrato precisar estar vinculado a uma unidade.
2. Depois de salva, a fabrica aparecera como opcao no cadastro de contratos.

## 5. Menu Produtos

Use este menu para cadastrar os produtos negociados nos contratos.

Exemplos:

- Milho.
- Soja.
- Trigo.
- Algodao.

Como usar:

1. Informe o nome do produto.
2. Preencha os demais campos disponiveis, se necessario.
3. Clique em `Salvar`.

Dica: mantenha os nomes padronizados. Por exemplo, use sempre `Milho` em vez de cadastrar `Milho Graos`, `Milho em Graos` e `MILHO` como produtos diferentes.

## 6. Menu Contratos

Use este menu para cadastrar e acompanhar os contratos de compra.

Campos principais:

- Numero do contrato.
- Fornecedor.
- Produto.
- Fabrica.
- Quantidade contratada.
- Quantidade recebida.
- Custo por KG.
- Data de vencimento.
- Status.

Como usar:

1. Cadastre primeiro fornecedor, produto e fabrica, se ainda nao existirem.
2. Entre em `Contratos`.
3. Preencha os dados do contrato.
4. Clique em `Salvar`.

O sistema calcula automaticamente:

- Quantidade recebida, conforme notas fiscais importadas ou cadastradas.
- Saldo do contrato.
- Percentual de execucao.
- Status de vencimento.

Importante: ao excluir um contrato, confira antes se ele possui notas fiscais ou fretes vinculados.

## 7. Menu Notas Fiscais

Use este menu para registrar notas fiscais recebidas e vincular cada nota ao contrato correto.

Voce pode cadastrar uma nota manualmente ou importar XML de NF-e.

### Importar XML de NF-e

1. Selecione o contrato.
2. Se desejar, selecione a unidade do XML e a unidade para conversao.
3. Clique em `Importar XML`.
4. Escolha o arquivo XML da nota fiscal.
5. O sistema preenche numero da nota, fornecedor, quantidade, valor total, valor unitario e data.
6. Confira os dados.
7. Clique em `Salvar`.

### Conversao manual de unidade

A conversao nao e automatica. Ela so acontece se voce solicitar.

Use quando o contrato esta em uma unidade e a nota vem em outra. Exemplo: contrato em sacas, nota em KG.

Opcoes disponiveis:

- `KG`
- `Tonelada`
- `Saca`

Como converter:

1. Em `Unidade do XML`, escolha a unidade que veio na nota.
2. Em `Converter para`, escolha a unidade do contrato.
3. Em `KG por saca`, informe o peso da saca, por exemplo `60`.
4. Importe o XML.

Se deixar como `Sem conversao`, o sistema importa a quantidade como veio no XML.

Regras importantes:

- O sistema nao deixa importar XML sem selecionar o contrato.
- O sistema tenta localizar o fornecedor pelo CNPJ do XML.
- Se o fornecedor ja estiver cadastrado, ele e preenchido automaticamente.
- O sistema bloqueia XML repetido do mesmo fornecedor.
- As casas decimais do valor unitario seguem o valor da nota.

### Relatorio de notas

Na parte superior da tela, voce pode filtrar por:

- Contrato.
- Fornecedor.

Depois clique em `PDF` para baixar o relatorio.

## 8. Menu Frete

Use este menu para cadastrar fretes e vincular o valor do frete ao contrato.

Campos principais:

- Numero do CTe.
- Contrato.
- Fornecedor ou transportadora, conforme cadastro usado.
- Valor do frete.
- Data.
- Observacoes.

Como usar:

1. Informe os dados do frete.
2. Vincule ao contrato correto.
3. Clique em `Salvar`.

O valor do frete vinculado entra no calculo do custo medio com frete no Dashboard e no Relatorio Financeiro.

### Importar XML de CT-e

Quando disponivel:

1. Selecione ou informe os dados principais.
2. Importe o XML do CT-e.
3. Confira numero do CTe, valor e data.
4. Vincule ao contrato correto.
5. Salve.

Tambem e possivel excluir registros de frete cadastrados/importados incorretamente.

## 9. Menu Documentos

Use este menu para registrar documentos relacionados aos contratos.

Exemplos:

- Contratos assinados.
- Comprovantes.
- Anexos administrativos.
- Observacoes documentais.

Como usar:

1. Informe o nome ou descricao do documento.
2. Vincule ao contrato ou entidade correspondente, quando houver campo para isso.
3. Salve o registro.

Dica: use nomes claros para facilitar a busca depois, por exemplo `Contrato CT-001 assinado`.

## 10. Menu Rel. Financeiro

Use este menu para acompanhar valores financeiros por contrato e fornecedor.

Filtros disponiveis:

- Fornecedor.
- Contrato.

Indicadores apresentados:

- Valor contratado.
- Frete vinculado.
- Custo total com frete.
- Custo medio com frete.
- Saldo financeiro.

Como usar:

1. Escolha um fornecedor, um contrato ou ambos.
2. Confira os valores na tela.
3. Clique em `PDF` para baixar o relatorio financeiro.

Dica: use este relatorio para conferir se o custo medio esta correto depois de cadastrar notas e fretes.

## 11. Menu Backup

Use este menu para baixar uma copia dos dados do sistema.

O backup pode incluir:

- Fornecedores.
- Fabricas.
- Produtos.
- Contratos.
- Notas fiscais.
- Documentos.
- Fretes.

Opcoes comuns:

- Baixar tudo em Excel.
- Baixar tabelas separadas em CSV ou Excel.

Quando fazer backup:

- Antes de uma grande importacao.
- Antes de excluir muitos registros.
- No fim de cada semana ou mes.
- Sempre que quiser guardar uma copia local dos dados.

Importante: o backup baixa os dados para o seu computador. Guarde o arquivo em local seguro.

## 12. Menu Sair

Use `Sair` para encerrar a sessao.

Recomendacao:

- Sempre clique em `Sair` ao terminar de usar o sistema, principalmente em computador compartilhado.

## 13. Cuidados importantes

- Confira sempre o contrato antes de importar XML.
- Cadastre fornecedores com CNPJ correto.
- Evite cadastrar o mesmo fornecedor com nomes diferentes.
- Antes de excluir registros, confirme se eles nao serao usados em relatorios.
- Faca backup com frequencia.
- Se aparecer uma mensagem de erro, leia a orientacao exibida pelo sistema. Ela informa o problema e como corrigir.

## 14. Fluxo recomendado de uso

Para usar o sistema de forma organizada:

1. Cadastre fornecedores.
2. Cadastre fabricas.
3. Cadastre produtos.
4. Cadastre contratos.
5. Importe ou cadastre notas fiscais.
6. Cadastre ou importe fretes.
7. Confira o Dashboard.
8. Confira o Relatorio Financeiro.
9. Exporte relatorios ou faca backup quando necessario.

