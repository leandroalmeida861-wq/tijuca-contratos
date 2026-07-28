import { Navigate, useParams } from 'react-router-dom';
import BalancasPage from '../pages/BalancasPage.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { UNIDADES, abaPorSegmento, rotaInicialDaUnidade } from '../config/unidades.js';

/**
 * Ponte entre a rota da unidade e o modulo de balanca reaproveitado.
 * Traduz o segmento da URL (`/balanca-haisa/portaria`) na aba correspondente e
 * redireciona para a rota inicial quando o segmento nao existe na unidade —
 * e assim que o Armazem Iguatu abre direto na Portaria, sem Dashboard.
 *
 * Tambem barra o acesso direto pela URL a uma unidade nao liberada. Esta e a
 * barreira de navegacao; a barreira real dos dados sao as policies RESTRICTIVE
 * de public.agroflow_acessa_unidade() no banco.
 */
export default function UnidadeModulo({ unidade }) {
  const params = useParams();
  const { podeAcessarUnidade } = useAuth();
  const segmento = String(params['*'] || '').split('/')[0];
  const aba = abaPorSegmento(unidade, segmento);

  if (!podeAcessarUnidade(unidade.codigo)) {
    const alternativa = UNIDADES.find((item) => podeAcessarUnidade(item.codigo));
    return <Navigate to={alternativa ? rotaInicialDaUnidade(alternativa) : '/acesso-negado'} replace />;
  }

  if (!aba) return <Navigate to={rotaInicialDaUnidade(unidade)} replace />;

  // O React Router reaproveita o mesmo tipo de componente entre as rotas das
  // unidades. A chave garante estado, filtros e dados novos a cada troca.
  return <BalancasPage key={unidade.codigo} unidade={unidade} aba={aba.key} />;
}
