import { Check, Clock3, Save, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { EDITABLE_ROLE_OPTIONS, MENU_DEFINITIONS, PERMISSION_ACTIONS, ROLE_OPTIONS } from '../lib/permissions.js';
import { supabase } from '../lib/supabase.js';

const ADMIN_EMAIL = 'leandroalmeida861@gmail.com';
const EDITABLE_ROLE_VALUES = EDITABLE_ROLE_OPTIONS.map((role) => role.value);

export default function AdminAccessPage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestRoles, setRequestRoles] = useState({});
  const [permissionRows, setPermissionRows] = useState([]);
  const [selectedRole, setSelectedRole] = useState('gestor');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  async function load() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error('Sessao expirada. Entre novamente no AgroFlow.');

    const [profileResult, permissionResult, requestResponse] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('permissoes_menu').select('*').in('perfil', EDITABLE_ROLE_VALUES).order('menu'),
      fetch('/api/admin/solicitacoes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (permissionResult.error) throw permissionResult.error;
    const requestPayload = await requestResponse.json().catch(() => ({}));
    if (!requestResponse.ok) throw new Error(requestPayload.error || 'Nao foi possivel carregar os pedidos pendentes.');
    setProfiles(profileResult.data || []);
    setPermissionRows(ensurePermissionRows(permissionResult.data || []));
    setPendingRequests(requestPayload.requests || []);
    setRequestRoles((current) => Object.fromEntries(
      (requestPayload.requests || []).map((item) => [item.id, current[item.id] || 'operador']),
    ));
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

  async function processAccessRequest(row, action) {
    if (action === 'rejeitar' && !window.confirm(`Rejeitar o pedido de ${row.nome || row.email}?`)) return;

    setMessage('');
    setProcessingRequestId(row.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessao expirada. Entre novamente no AgroFlow.');

      const response = await fetch('/api/admin/solicitacoes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requestId: row.id,
          action,
          perfil: requestRoles[row.id] || 'operador',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel processar o pedido.');

      await load();
      setMessage(payload.message || 'Pedido processado com sucesso.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel processar o pedido.');
    } finally {
      setProcessingRequestId(null);
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
        <div className="flex items-center gap-2 border-b p-4">
          <Clock3 size={18} />
          <h2 className="font-extrabold">Pedidos pendentes de acesso</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">{pendingRequests.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="p-3">Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Observacao</th>
                <th>Data do pedido</th>
                <th>Perfil</th>
                <th className="text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((row) => (
                <tr key={row.id} className="border-b align-top last:border-0">
                  <td className="p-3 font-semibold">{row.nome || '-'}</td>
                  <td className="p-3">{row.email}</td>
                  <td className="p-3">{row.telefone || '-'}</td>
                  <td className="max-w-xs whitespace-normal p-3 text-slate-600">{row.observacao || '-'}</td>
                  <td className="p-3">{formatRequestDate(row.criado_em)}</td>
                  <td className="p-3">
                    <select
                      value={requestRoles[row.id] || 'operador'}
                      onChange={(event) => setRequestRoles((current) => ({ ...current, [row.id]: event.target.value }))}
                      className="h-9 rounded-md border border-slate-300 px-2"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => processAccessRequest(row, 'aprovar')}
                        disabled={processingRequestId === row.id}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check size={15} /> Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => processAccessRequest(row, 'rejeitar')}
                        disabled={processingRequestId === row.id}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        <X size={15} /> Rejeitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !pendingRequests.length && (
            <p className="p-5 text-sm text-slate-500">Nenhum pedido pendente.</p>
          )}
        </div>
      </section>

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
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
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
              {EDITABLE_ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
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

function formatRequestDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ensurePermissionRows(rows = []) {
  const map = new Map(rows.map((row) => [`${row.perfil}:${row.menu}`, row]));
  EDITABLE_ROLE_VALUES.forEach((perfil) => {
    MENU_DEFINITIONS
      .filter((menu) => !['usuarios', 'auditoria'].includes(menu.key))
      .forEach((menu) => {
        const key = `${perfil}:${menu.key}`;
        if (!map.has(key)) {
          map.set(key, {
            perfil,
            menu: menu.key,
            visualizar: false,
            cadastrar: false,
            editar: false,
            excluir: false,
            cancelar: false,
            aprovar: false,
            exportar: false,
          });
        }
      });
  });
  return Array.from(map.values()).sort((a, b) => {
    const roleDiff = EDITABLE_ROLE_VALUES.indexOf(a.perfil) - EDITABLE_ROLE_VALUES.indexOf(b.perfil);
    if (roleDiff !== 0) return roleDiff;
    return String(a.menu).localeCompare(String(b.menu), 'pt-BR');
  });
}
