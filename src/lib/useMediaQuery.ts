'use client';
import { useEffect, useState } from 'react';
/** Vraća true kad upit vrijedi (samo na klijentu; prije mounta je false). */
export function useMediaQuery(query: string): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
