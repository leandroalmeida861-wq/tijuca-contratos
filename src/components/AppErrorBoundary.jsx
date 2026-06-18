import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Erro inesperado no AgroFlow:', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-slate-900">
        <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-7 text-center shadow-lg">
          <img src="/agroflow-icon.png" alt="AgroFlow" className="mx-auto h-16 w-16 rounded-lg" />
          <h1 className="mt-5 text-2xl font-extrabold">Não foi possível carregar esta tela</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Seus dados permanecem salvos. Atualize o sistema para carregar novamente a versão estável.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 h-11 rounded-lg bg-emerald-600 px-5 text-sm font-extrabold text-white hover:bg-emerald-700"
          >
            Atualizar sistema
          </button>
        </section>
      </main>
    );
  }
}
