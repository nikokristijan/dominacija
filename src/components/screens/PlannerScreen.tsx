'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGame } from '@/components/game/GameProvider';

/** Stari put /operacija: operacija je sada popup nad kartom — preusmjeri. */
export function PlannerScreen() {
  const g = useGame(); const router = useRouter(); const sp = useSearchParams();
  useEffect(() => { const t = sp.get('target'); router.replace(`/k/${g.id}/karta${t ? `?op=${t}` : ''}`); }, [g.id, router, sp]);
  return null;
}
