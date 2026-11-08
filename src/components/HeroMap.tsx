'use client';
import { useMemo } from 'react';
import { createCampaignState } from '@/engine/state';
import { getPlayerView } from '@/engine/view';
import { HexMap } from '@/components/game/HexMap';

/** Prava, generirana karta (isti engine kao u igri) kao lebdeći hero na naslovnici. */
export function HeroMap({ className = '' }: { className?: string }) {
  const view = useMemo(() => {
    const s = createCampaignState({ campaignId: 'hero', seed: 'dominacija-hero', players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i + 1}`, userId: null, name: ['Ti', 'Marko', 'Ana', 'Ivan', 'Petra'][i] })) });
    return getPlayerView(s, 'p1');
  }, []);
  return <HexMap view={view} selectedId={null} onSelect={() => undefined} interactive={false} className={className} />;
}
