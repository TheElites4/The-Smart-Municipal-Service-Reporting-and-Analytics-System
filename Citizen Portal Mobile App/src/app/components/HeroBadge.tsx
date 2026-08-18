import { Medal } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { getHeroLevel, getHeroProfile } from '../utils/gamification';

interface HeroBadgeProps {
  className?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-300',
  platinum: 'from-cyan-500 to-cyan-300',
  diamond: 'from-blue-600 to-purple-500',
};

export function HeroBadge({ className = '' }: HeroBadgeProps) {
  const { t } = useTranslation();
  const profile = getHeroProfile();
  const { level, labelKey, next } = getHeroLevel(profile.points);

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-full bg-gradient-to-br ${LEVEL_COLORS[level]} flex items-center justify-center shadow-lg flex-shrink-0`}
        >
          <Medal className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{t('heroPointsTitle')}</p>
          <p className="text-2xl font-bold text-[#1e5a7d]">{profile.points}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FFB612]/20 text-[#1e5a7d]">
              {t(labelKey as 'levelBronze')}
            </span>
            {next !== null && (
              <span className="text-xs text-muted-foreground">
                {next} {t('pointsEarned')} to next level
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          📝 {profile.reportsSubmitted} {t('report')}
          {profile.reportsSubmitted !== 1 ? 's' : ''}
        </span>
        <span>
          👍 {profile.upvotesGiven} {t('meToo')}
        </span>
      </div>
    </div>
  );
}
