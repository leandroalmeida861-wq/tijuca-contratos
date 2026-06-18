import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuditLogsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('agroflow_auditar', { action_name: 'visualizacao_sensivel', table_name: 'audit_logs', record_id: null, old_data: null, new_data: null });
    supabase.from('audit_logs').select('*').order('criado_em', { ascending: false }).limit(500)
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        else setRows(data || []);
      });
  }, []);

  return (
    <div className="grid gap-5">
      <header><h1 className="text-2xl font-extrabold">Auditoria</h1><p className="mt-1 text-sm text-slate-500">Últimas 500 ações registradas no sistema.</p></header>
      {error && <div className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-panel">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Data</th><th>Perfil</th><th>Ação</th><th>Tabela</th><th>Registro</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="p-3">{new Date(row.criado_em).toLocaleString('pt-BR')}</td>
                <td className="font-semibold">{row.perfil || '-'}</td>
                <td>{row.acao}</td><td>{row.tabela || '-'}</td><td className="font-mono text-xs">{row.registro_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
