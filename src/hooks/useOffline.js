import { useContext } from 'react';
import { OfflineContext } from '../context/OfflineContext';

export function useOffline() {
  return useContext(OfflineContext);
}
