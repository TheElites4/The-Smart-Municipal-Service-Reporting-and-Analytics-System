import { Zap } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface LoadSheddingBannerProps {
  className?: string;
}

// Mock data - in production this would come from the EskomSePush API or similar
const MOCK_LOAD_SHEDDING = {
  stage: 2,
  areas: ['Johannesburg', 'Pretoria', 'Soweto'],
  current: true,
};

export function LoadSheddingBanner({ className = '' }: LoadSheddingBannerProps) {
  const { t } = useTranslation();
  const { stage, areas, current } = MOCK_LOAD_SHEDDING;

  if (!current) {
    return (
      <div
        className={`flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-800">{t('loadSheddingTitle')}</p>
          <p className="text-xs text-green-700">{t('loadSheddingNoLoadShedding')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 animate-pulse">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">
          {t('loadSheddingTitle')} · {t('loadSheddingStage')} {stage}
        </p>
        <p className="text-xs text-amber-700">{areas.join(', ')}</p>
      </div>
      <span className="px-2 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">
        {stage}
      </span>
    </div>
  );
}
