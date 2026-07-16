import assert from 'node:assert/strict';
import { NfeParseError, parseNfeRecebimento } from '../src/lib/nfeRecebimento.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260712345678000123550010000001231000001234">
      <ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-07-16T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000123</CNPJ><xNome>FORNECEDOR TESTE</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>PROD-1</cProd><xProd>PRODUTO UM</xProd><NCM>10010010</NCM><CFOP>5101</CFOP>
          <uCom>KG</uCom><qCom>10.000</qCom><vUnCom>5.0000</vUnCom><vProd>50.00</vProd><vDesc>2.00</vDesc>
        </prod>
        <imposto><ICMS><ICMS40><vICMSDeson>1.00</vICMSDeson></ICMS40></ICMS></imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PROD-2</cProd><xProd>PRODUTO DOIS</xProd><NCM>23040090</NCM><CFOP>5102</CFOP>
          <uCom>KG</uCom><qCom>5.000</qCom><vUnCom>10.0000</vUnCom><vProd>50.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vDesc>2.00</vDesc><vNF>97.00</vNF></ICMSTot></total>
      <transp><vol><pesoL>15.000</pesoL><pesoB>16.000</pesoB></vol></transp>
    </infNFe>
  </NFe>
</nfeProc>`;

const parsed = parseNfeRecebimento(xml);

assert.equal(parsed.numero, '123', 'Número da NF deve ser lido');
assert.equal(parsed.chaveAcesso, '35260712345678000123550010000001231000001234', 'Chave deve ser lida');
assert.equal(parsed.itens.length, 2, 'Todos os itens da NF-e devem ser importados');
assert.deepEqual(parsed.itens.map((item) => item.codigo), ['PROD-1', 'PROD-2']);
assert.equal(parsed.itens[0].descontoProduto, 2, 'Desconto do produto deve ser lido');
assert.equal(parsed.itens[0].icmsDesonerado, 1, 'ICMS desonerado deve ser lido');
assert.equal(parsed.itens[0].desconto, 3, 'Desconto e desoneração devem ser combinados uma única vez');
assert.equal(parsed.valorTotalNota, 97, 'Total líquido oficial da NF-e deve ser preservado pelo parser');
assert.equal(parsed.pesoLiquidoNf, 15, 'Peso líquido deve ser lido');

assert.throws(
  () => parseNfeRecebimento('<xml-invalido />'),
  (error) => error instanceof NfeParseError,
  'XML inválido deve gerar erro claro sem persistência',
);

console.log('Testes do parser XML de recebimentos aprovados.');
