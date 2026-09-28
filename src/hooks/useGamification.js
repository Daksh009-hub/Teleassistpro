import { useContext } from 'react';
import { GamificationContext } from '../context/GamificationContext';

export function useGamification() {
  return useContext(GamificationContext);
}
