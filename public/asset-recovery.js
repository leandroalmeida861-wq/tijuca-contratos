const recoveryKey = 'agroflow_asset_recovery';
const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
const now = Date.now();

if (now - lastRecovery > 60_000) {
  sessionStorage.setItem(recoveryKey, String(now));
  const url = new URL(window.location.href);
  url.searchParams.set('atualizar', String(now));
  window.location.replace(url.toString());
} else {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;color:#0f172a">
        <section style="max-width:520px;background:white;border:1px solid #e2e8f0;border-radius:8px;padding:28px;text-align:center">
          <h1 style="font-size:24px;margin:0">Atualização necessária</h1>
          <p style="color:#475569;line-height:1.6">A versão do AgroFlow mudou. Atualize a página para continuar.</p>
          <button onclick="window.location.reload()" style="border:0;border-radius:8px;background:#059669;color:white;padding:12px 18px;font-weight:700;cursor:pointer">Atualizar sistema</button>
        </section>
      </main>
    `;
  }
}
