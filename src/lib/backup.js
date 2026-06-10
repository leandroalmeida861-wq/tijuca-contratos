import * as XLSX from 'xlsx';

const backupTables = [
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'fabricas', label: 'Fabricas' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'notas_fiscais', label: 'Notas Fiscais' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'fretes', label: 'Fretes' },
];

export function backupSummary(data) {
  return backupTables.map((table) => ({
    ...table,
    total: data?.[table.key]?.length || 0,
  }));
}

export function exportBackupExcel(data) {
  const workbook = XLSX.utils.book_new();

  backupTables.forEach((table) => {
    const rows = normalizeRows(table.key, data?.[table.key] || []);
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ aviso: 'Nenhum registro encontrado' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, table.label.slice(0, 31));
  });

  XLSX.writeFile(workbook, `backup-agroflow-${todayStamp()}.xlsx`);
}

export function exportTableExcel(tableKey, data) {
  const table = backupTables.find((item) => item.key === tableKey);
  const rows = normalizeRows(tableKey, data?.[tableKey] || []);
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ aviso: 'Nenhum registro encontrado' }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, table?.label.slice(0, 31) || tableKey);
  XLSX.writeFile(workbook, `${tableKey}-agroflow-${todayStamp()}.xlsx`);
}

export function exportTableCsv(tableKey, data) {
  const rows = normalizeRows(tableKey, data?.[tableKey] || []);
  const csv = toCsv(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${tableKey}-agroflow-${todayStamp()}.csv`);
}

export function exportAllCsv(data) {
  backupTables.forEach((table, index) => {
    window.setTimeout(() => exportTableCsv(table.key, data), index * 250);
  });
}

export { backupTables };

function normalizeRows(tableKey, rows) {
  return rows.map((row) => {
    if (tableKey === 'contratos') {
      return {
        id: row.id,
        numero_contrato: row.numero_contrato,
        fornecedor: row.fornecedor?.nome || '',
        produto: row.produto?.nome || '',
        fabrica: row.fabrica?.nome || '',
        quantidade_contratada: row.quantidade_contratada,
        quantidade_recebida: row.quantidade_recebida,
        saldo: row.saldo,
        percentual_execucao: Math.round(Number(row.percentual || 0)),
        custo_kg: row.custo_kg,
        data_vencimento: row.data_vencimento,
        status: row.status_calculado,
        created_at: row.created_at,
      };
    }

    if (tableKey === 'notas_fiscais') {
      return {
        id: row.id,
        numero_nf: row.numero_nf,
        numero_contrato: row.contrato?.numero_contrato || '',
        fornecedor: row.fornecedor?.nome || '',
        quantidade_recebida: row.quantidade_recebida,
        valor_unitario: row.valor_unitario,
        valor_total: row.valor_total,
        data_recebimento: row.data_recebimento,
        created_at: row.created_at,
      };
    }

    return flattenRow(row);
  });
}

function flattenRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value && typeof value === 'object') return [key, JSON.stringify(value)];
      return [key, value];
    }),
  );
}

function toCsv(rows) {
  const safeRows = rows.length ? rows : [{ aviso: 'Nenhum registro encontrado' }];
  const headers = Object.keys(safeRows[0]);
  const lines = safeRows.map((row) => headers.map((header) => csvCell(row[header])).join(';'));
  return [headers.join(';'), ...lines].join('\n');
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
