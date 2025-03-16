import useSWR from 'swr';
import { getSolvers } from '../services/api';
import { SolverInfo } from '../types/models';

export function useSolversList() {
  const { 
    data: solversData, 
    error: solversError, 
    isLoading: isSolversLoading 
  } = useSWR<{ solvers: SolverInfo[] }>('/solvers', getSolvers);
  
  return {
    solvers: solversData?.solvers || [],
    isLoading: isSolversLoading,
    error: solversError,
  };
}
