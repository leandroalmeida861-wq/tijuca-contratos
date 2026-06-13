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

export function exportFullBackupJson(data) {
  const payload = {
    app: 'AgroFlow',
    type: 'full-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    tables: backupTables.map((table) => table.key),
    data: Object.fromEntries(backupTables.map((table) => [table.key, data?.[table.key] || []])),
  };

  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' }),
    `backup-agroflow-completo-${todayStamp()}.json`,
  );
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

export async function parseBackupFile(file, tableKey = '') {
  if (!file) throw new Error('Selecione um arquivo de backup para importar.');

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'json') return parseFullBackupJson(await file.text());
  if (extension === 'xlsx' || extension === 'xls') return parseExcelBackup(await file.arrayBuffer());
  if (extension === 'csv') {
    if (!tableKey) throw new Error('Escolha a área do CSV antes de importar. Como corrigir: selecione fornecedores, contratos, notas fiscais ou outra área no campo acima.');
    return { [tableKey]: parseCsv(await file.text()) };
  }

  throw new Error('Formato de arquivo não aceito. Como corrigir: use o backup completo (.json), Excel (.xlsx) ou CSV (.csv).');
}

export { backupTables, normalizeRows };

function parseFullBackupJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Arquivo JSON inválido. Como corrigir: importe o arquivo backup-agroflow-completo gerado pelo AgroFlow.');
  }

  const data = parsed?.data || parsed;
  const result = {};

  backupTables.forEach((table) => {
    if (Array.isArray(data?.[table.key])) result[table.key] = data[table.key];
  });

  if (!Object.keys(result).length) {
    throw new Error('Backup completo sem dados reconhecidos. Como corrigir: use o arquivo .json baixado na opção "Baixar backup completo".');
  }

  return result;
}

function parseExcelBackup(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const result = {};

  workbook.SheetNames.forEach((sheetName) => {
    const table = backupTables.find((item) => normalizeSheetName(item.label) === normalizeSheetName(sheetName)
      || normalizeSheetName(item.key) === normalizeSheetName(sheetName));
    if (!table) return;

    result[table.key] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  });

  if (!Object.keys(result).length) {
    throw new Error('Não encontrei abas válidas no Excel. Como corrigir: importe o arquivo gerado pelo Backup geral do AgroFlow.');
  }

  return result;
}

function parseCsv(csv) {
  const rows = csv.split(/\r?\n/).filter((line) => line.trim());
  if (!rows.length) return [];
  const separator = rows[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(rows[0], separator).map((header) => header.replace(/^\uFEFF/, '').trim());

  return rows.slice(1).map((line) => {
    const values = splitCsvLine(line, separator);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function splitCsvLine(line, separator) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function normalizeSheetName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

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
