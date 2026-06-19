import { Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { MENU_DEFINITIONS, PERMISSION_ACTIONS } from '../lib/permissions.js';
import { supabase } from '../lib/supabase.js';

const ADMIN_EMAIL = 'leandroalmeida861@gmail.com';

export default function AdminAccessPage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [permissionRows, setPermissionRows] = useState([]);
  const [selectedRole, setSelectedRole] = useState('gestor');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    const [profileResult, permissionResult] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('permissoes_menu').select('*').in('perfil', ['gestor', 'operador']).order('menu'),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (permissionResult.error) throw permissionResult.error;
    setProfiles(profileResult.data || []);
    setPermissionRows(permissionResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((error) => {
      setMessage(error.message);
      setLoading(false);
    });
  }, []);

  const rolePermissions = useMemo(
    () => Object.fromEntries(permissionRows.filter((row) => row.perfil === selectedRole).map((row) => [row.menu, row])),
    [permissionRows, selectedRole],
  );

  async function updateProfile(row, changes) {
    setMessage('');
    if (row.email === ADMIN_EMAIL && (changes.perfil && changes.perfil !== 'admin' || changes.ativo === false)) {
      setMessage('O Admin principal não pode ser rebaixado ou bloqueado.');
      return;
    }
    const { error } = await supabase.from('profiles').update({ ...changes, atualizado_em: new Date().toISOString() }).eq('id', row.id);
    if (error) return setMessage(error.message);
    await supabase.rpc('agroflow_auditar', {
      action_name: changes.perfil ? 'alterar_perfil' : 'alterar_usuario',
      table_name: 'profiles',
      record_id: row.id,
      old_data: row,
      new_data: { ...row, ...changes },
    });
    await load();
    setMessage('Usuário atualizado com sucesso.');
  }

  async function deleteProfile(row) {
    if (row.email === ADMIN_EMAIL) {
      setMessage('O Admin principal não pode ser excluído.');
      return;
    }
    if (!window.confirm(`Excluir definitivamente o acesso de ${row.nome || row.email}?\n\nO usuário não conseguirá mais entrar. Os dados operacionais cadastrados por ele serão preservados.`)) return;

    setMessage('');
    setDeletingId(row.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Entre novamente no AgroFlow.');

      const response = await fetch('/api/admin/excluir-usuario', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ profileId: row.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir o usuário.');

      await load();
      setMessage(payload.message || 'Usuário excluído com sucesso.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível excluir o usuário.');
    } finally {
      setDeletingId(null);
    }
  }

  function togglePermission(menu, action) {
    setPermissionRows((current) => current.map((row) => (
      row.perfil === selectedRole && row.menu === menu ? { ...row, [action]: !row[action] } : row
    )));
  }

  async function savePermissions() {
    setMessage('');
    const rows = permissionRows
      .filter((row) => row.perfil === selectedRole)
      .map((row) => ({ ...row, atualizado_em: new Date().toISOString() }));
    const { error } = await supabase.from('permissoes_menu').upsert(rows, { onConflict: 'perfil,menu' });
    if (error) return setMessage(error.message);
    await supabase.rpc('agroflow_auditar', {
      action_name: 'alterar_permissoes',
      table_name: 'permissoes_menu',
      record_id: selectedRole,
      old_data: null,
      new_data: rows,
    });
    setMessage('Permissões salvas com sucesso.');
  }

  if (profile !== 'admin') return null;

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-950">Usuários e permissões</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Controle perfis, bloqueios e ações permitidas em cada menu.</p>
      </header>

      {message && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">{message}</div>}

      <section className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <div className="flex items-center gap-2 border-b p-4"><Users size={18} /><h2 className="font-extrabold">Usuários</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th className="text-center">Ações</th></tr></thead>
            <tbody>
              {profiles.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{row.nome || '-'}</td>
                  <td>{row.email}</td>
                  <td>
                    <select
                      value={row.perfil}
                      disabled={row.email === ADMIN_EMAIL}
                      onChange={(event) => updateProfile(row, { perfil: event.target.value })}
                      className="h-9 rounded-md border border-slate-300 px-2"
                    >
                      <option value="admin">Admin</option>
                      <option value="gestor">Gestor</option>
                      <option value="operador">Operador</option>
                    </select>
                  </td>
                  <td>
                    <label className="inline-flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={row.ativo}
                        disabled={row.email === ADMIN_EMAIL}
                        onChange={(event) => updateProfile(row, { ativo: event.target.checked })}
                      />
                      {row.ativo ? 'Ativo' : 'Bloqueado'}
                    </label>
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => deleteProfile(row)}
                      disabled={row.email === ADMIN_EMAIL || deletingId === row.id}
                      className="inline-grid h-9 w-9 place-items-center rounded-md text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      title={row.email === ADMIN_EMAIL ? 'O Admin principal não pode ser excluído' : 'Excluir usuário'}
                      aria-label={`Excluir usuário ${row.email}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !profiles.length && <p className="p-5 text-sm text-slate-500">Nenhum usuário encontrado.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><ShieldCheck size={18} /><h2 className="font-extrabold">Permissões por menu</h2></div>
          <div className="flex items-center gap-2">
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3">
              <option value="gestor">Gestor</option>
              <option value="operador">Operador</option>
            </select>
            <button onClick={savePermissions} className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white">
              <Save size={16} /> Salvar
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3 text-left">Menu</th>{PERMISSION_ACTIONS.map((action) => <th key={action}>{action}</th>)}</tr></thead>
            <tbody>
              {MENU_DEFINITIONS.filter((menu) => !['usuarios', 'auditoria'].includes(menu.key)).map((menu) => (
                <tr key={menu.key} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{menu.label}</td>
                  {PERMISSION_ACTIONS.map((action) => (
                    <td key={action} className="text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(rolePermissions[menu.key]?.[action])}
                        onChange={() => togglePermission(menu.key, action)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
