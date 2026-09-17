import { Trophy, Medal, Crown } from 'lucide-react';
import { getHeroProfile } from '../utils/gamification';
import { useTranslation } from '../utils/i18n';
import { useEffect, useState } from 'react';

interface LeaderboardProps {
  className?: string;
}

const RANK_COLORS = [
  { border: 'border-yellow-400', bg: 'bg-yellow-50', icon: Crown },
  { border: 'border-gray-300', bg: 'bg-gray-50', icon: Medal },
  { border: 'border-orange-400', bg: 'bg-orange-50', icon: Medal },
];

export function Leaderboard({ className = '' }: LeaderboardProps) {
  const { t } = useTranslation();
  const currentUser = getHeroProfile();
  const [leaders, setLeaders] = useState<any[]>([]);
  useEffect(() => { fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/leaderboard`).then((response) => response.ok ? response.json() : []).then(setLeaders).catch(() => setLeaders([])); }, []);

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <div className="p-5 border-b border-gray-100 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-[#FFB612]" />
        <h3 className="text-lg font-semibold text-[#1e5a7d]">Community Leaderboard</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {leaders.map((leader) => {
          const color = RANK_COLORS[leader.rank - 1] || RANK_COLORS[2];
          const RankIcon = color.icon;
          return (
            <div
              key={leader.rank}
              className={`flex items-center gap-4 p-4 ${color.bg} ${color.border} ${
                leader.rank <= 3 ? 'border-l-4' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#1e5a7d] text-white flex items-center justify-center font-bold">
                {leader.rank}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800 flex items-center gap-2">
                  {leader.name}
                  {leader.rank === 1 && <Crown className="w-4 h-4 text-[#FFB612]" />}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leader.reports} {t('report')}s
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#1e5a7d]">{leader.points}</p>
                <p className="text-xs text-muted-foreground">{t('pointsEarned')}</p>
              </div>
            </div>
          );
        })}
        {!leaders.length && <p className="p-4 text-sm text-muted-foreground">No community reports yet.</p>}
      </div>

      {/* Current user */}
      <div className="p-4 bg-gradient-to-r from-[#1e5a7d]/10 to-[#4a8f8f]/10 border-t-2 border-[#1e5a7d]/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#FFB612] text-black flex items-center justify-center font-bold">
            You
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800">You (Current)</p>
            <p className="text-xs text-muted-foreground">
              {currentUser.reportsSubmitted} {t('report')}s · {currentUser.upvotesGiven} {t('meToo')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-[#1e5a7d]">{currentUser.points}</p>
            <p className="text-xs text-muted-foreground">{t('pointsEarned')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
