import useSWR from 'swr';
import { getVisualizationConfig, getSolvers } from '../services/api';
import { SolverInfo } from '../types/models';
import {  VisualizationConfig } from '../types/config';

export function useConfig() {
  const { 
    data: visualConfig,
    error: visualError, 
    isLoading: isVisualLoading 
  } = useSWR<VisualizationConfig>('/config/visualization', getVisualizationConfig);
  
  const { 
    data: solversData, 
    error: solversError, 
    isLoading: isSolversLoading 
  } = useSWR<{ solvers: SolverInfo[] }>('/solvers', getSolvers);
  
  return {
    visualConfig,
    solvers: solversData?.solvers || [],
    defaultSolver: visualConfig?.solver?.default,
    mapCenter: visualConfig?.map?.center || [0, 0],
    isLoading: isVisualLoading || isSolversLoading,
    error: visualError || solversError,
  };
}
