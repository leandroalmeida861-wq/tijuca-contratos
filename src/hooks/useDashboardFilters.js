import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const emptyFilters = {
  dataInicial: '',
  dataFinal: '',
  fornecedorId: '',
  produtoId: '',
  contratoId: '',
};

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedFilters = useMemo(
    () => readDashboardFilters(searchParams),
    [searchParams],
  );
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  const updateFilter = useCallback((name, value) => {
    setDraftFilters((current) => ({ ...current, [name]: value }));
    setValidationError('');
  }, []);

  const applyFilters = useCallback(() => {
    const error = validateDashboardFilters(draftFilters);
    if (error) {
      setValidationError(error);
      return false;
    }

    setSearchParams(createDashboardSearchParams(draftFilters));
    return true;
  }, [draftFilters, setSearchParams]);

  const clearFilters = useCallback(() => {
    setDraftFilters(emptyFilters);
    setValidationError('');
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    appliedFilters,
    draftFilters,
    updateFilter,
    applyFilters,
    clearFilters,
    validationError,
  };
}

export function readDashboardFilters(searchParams) {
  return Object.keys(emptyFilters).reduce((filters, key) => {
    filters[key] = searchParams.get(key)?.trim() || '';
    return filters;
  }, {});
}

export function createDashboardSearchParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

export function validateDashboardFilters(filters) {
  if (filters.dataInicial && filters.dataFinal && filters.dataInicial > filters.dataFinal) {
    return 'A data inicial não pode ser maior que a data final. Como corrigir: ajuste o período e tente novamente.';
  }
  return '';
}
