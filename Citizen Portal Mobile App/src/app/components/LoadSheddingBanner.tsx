import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface LoadSheddingBannerProps { className?: string; }
interface LocationStatus { stage?: number; current?: boolean; areas?: string[]; updatedAt?: string; }

export function LoadSheddingBanner({ className = '' }: LoadSheddingBannerProps) {
  const [status, setStatus] = useState<LocationStatus | null>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => { const load = () => { const location = JSON.parse(localStorage.getItem('clientLocation') || '{}'); const query = new URLSearchParams({ latitude: location.latitude || '', longitude: location.longitude || '', municipality: location.municipality || '' }); fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/location/status?${query}`).then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then((nextStatus) => { setStatus(nextStatus); setAvailable(true); }).catch(() => { setStatus(null); setAvailable(false); }); }; load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);
  return <div className={`flex items-center gap-3 p-4 rounded-xl border ${status?.current ? 'bg-amber-50 border-amber-300' : 'bg-white border-border'} ${className}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${status?.current ? 'bg-amber-400' : 'bg-muted'}`}><Zap className={`w-5 h-5 ${status?.current ? 'text-white' : 'text-muted-foreground'}`} /></div><div className="flex-1"><p className="text-sm font-semibold text-foreground">Load-shedding status</p><p className="text-xs text-muted-foreground">{!available ? 'Live provider unavailable' : !status ? 'Waiting for your location' : status.current ? `Stage ${status.stage ?? 'unknown'}${status.areas?.length ? ` · ${status.areas.join(', ')}` : ''}` : 'No active load shedding reported'}</p></div>{status?.updatedAt && <span className="text-xs text-muted-foreground">{new Date(status.updatedAt).toLocaleTimeString()}</span>}</div>;
}
