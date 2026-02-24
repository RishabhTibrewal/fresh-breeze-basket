import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';

export interface ModuleKPIData {
  [key: string]: number | null;
}

export const useModuleKPIs = (moduleKey: string) => {
  return useQuery<ModuleKPIData>({
    queryKey: ['module-kpis', moduleKey],
    queryFn: async () => {
      const response = await apiClient.get(`/kpis/${moduleKey}`);
      return response.data.data || {};
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!moduleKey
  });
};
