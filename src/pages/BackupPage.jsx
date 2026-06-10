import { Download, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { backupSummary, backupTables, exportAllCsv, exportBackupExcel, exportTableCsv, exportTableExcel } from '../lib/backup.js';
import { listBackupData } from '../lib/api.js';

export default function BackupPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await listBackupData());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => backupSummary(data || {}), [data]);
  const total = summary.reduce((sum, table) => sum + table.total, 0);
  const disabled = loading || !data;

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Backup</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Exporte contratos, notas fiscais e cadastros para guardar uma copia local dos dados.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Backup geral</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">{loading ? 'Carregando dados...' : `${total} registros disponiveis`}</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                O Excel geral baixa uma planilha unica com abas separadas para cada area do sistema.
                O CSV geral baixa um arquivo por area.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={disabled}
              onClick={() => exportBackupExcel(data)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-tijuca-600 px-5 text-sm font-extrabold text-white hover:bg-tijuca-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FileSpreadsheet size={17} />
              Baixar tudo em Excel
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => exportAllCsv(data)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Download size={17} />
              Baixar tudo em CSV
            </button>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resumo</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {summary.map((table) => (
              <div key={table.key} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">{table.label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-950">{loading ? '-' : table.total}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Exportar por area</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {backupTables.map((table) => {
            const count = summary.find((item) => item.key === table.key)?.total || 0;
            return (
              <div key={table.key} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-extrabold text-slate-900">{table.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{loading ? 'Carregando...' : `${count} registros`}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => exportTableExcel(table.key, data)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => exportTableCsv(table.key, data)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <Download size={16} />
                    CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
