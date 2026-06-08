import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const currency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export const kg = (value) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value || 0))} KG`;

export const percent = (value) => `${Math.round(Number(value || 0))}%`;

export const dateBr = (value) => {
  if (!value) return '-';
  return format(parseISO(value), 'dd/MM/yyyy', { locale: ptBR });
};

export const contractStatus = (contract) => {
  const remaining = Number(contract.quantidade_contratada || 0) - Number(contract.quantidade_recebida || 0);
  if (contract.data_vencimento) {
    const days = differenceInCalendarDays(parseISO(contract.data_vencimento), new Date());
    if (days < 0 && remaining > 0) return 'Vencido';
  }
  if (remaining <= 0) return 'Concluído';
  return 'Ativo';
};

export const statusClass = (status) => {
  if (status === 'Vencido') return 'bg-rose-100 text-rose-700 ring-rose-200';
  if (status === 'Concluído') return 'bg-slate-100 text-slate-700 ring-slate-200';
  return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
};
