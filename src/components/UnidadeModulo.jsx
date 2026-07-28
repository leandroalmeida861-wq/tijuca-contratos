import { Navigate, useParams } from 'react-router-dom';
import BalancasPage from '../pages/BalancasPage.jsx';
import { abaPorSegmento, rotaInicialDaUnidade } from '../config/unidades.js';

/**
 * Ponte entre a rota da unidade e o modulo de balanca reaproveitado.
 * Traduz o segmento da URL (`/balanca-haisa/portaria`) na aba correspondente e
 * redireciona para a rota inicial quando o segmento nao existe na unidade —
 * e assim que o Armazem Iguatu abre direto na Portaria, sem Dashboard.
 */
export default function UnidadeModulo({ unidade }) {
  const params = useParams();
  const segmento = String(params['*'] || '').split('/')[0];
  const aba = abaPorSegmento(unidade, segmento);

  if (!aba) return <Navigate to={rotaInicialDaUnidade(unidade)} replace />;

  return <BalancasPage unidade={unidade} aba={aba.key} />;
}
