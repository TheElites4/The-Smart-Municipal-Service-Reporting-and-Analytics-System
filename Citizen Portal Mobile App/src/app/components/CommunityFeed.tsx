import { useState } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { ThumbsUp, Flame, MapPin, Clock, ArrowLeft } from 'lucide-react';
import { useTranslation, type Language } from '../utils/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { awardUpvotePoints, getHeroLevel, getHeroProfile } from '../utils/gamification';

interface CommunityFeedProps {
  reports: any[];
  onViewReport: (report: any) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onBack: () => void;
}

const UPVOTES_KEY = 'communityUpvotes';

function loadUpvotes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(UPVOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveUpvotes(upvotes: Record<string, number>) {
  localStorage.setItem(UPVOTES_KEY, JSON.stringify(upvotes));
}

export function CommunityFeed({
  reports,
  onViewReport,
  language,
  onLanguageChange,
  onBack,
}: CommunityFeedProps) {
  const { t } = useTranslation();
  const [upvotes, setUpvotes] = useState<Record<string, number>>(loadUpvotes);
  const [voted, setVoted] = useState<Set<string>>(new Set());

const handleUpvote = (reportId: string) => {
    if (voted.has(reportId)) return;

    const next = { ...upvotes, [reportId]: (upvotes[reportId] || 0) + 1 };
    setUpvotes(next);
    saveUpvotes(next);

    const nextVoted = new Set(voted);
    nextVoted.add(reportId);
    setVoted(nextVoted);

    const prevProfile = getHeroProfile();
    awardUpvotePoints();
    const newProfile = getHeroProfile();
    const prevLevel = getHeroLevel(prevProfile.points).level;
    const newLevel = getHeroLevel(newProfile.points).level;

    toast.success('Me Too! +2 Hero Points ⭐', {
      description: `You supported this report. Total: ${newProfile.points} points`,
    });

    if (newLevel !== prevLevel) {
      confetti({ particleCount: 120, spread: 70, origin: { x: 0.5, y: 0.6 } });
      toast.success(`Level up! You are now a ${newLevel} hero! 🏆`);
    }
  };

  const sorted = [...reports].sort((a, b) => {
    const aCount = upvotes[a.id] || 0;
    const bCount = upvotes[b.id] || 0;
    return bCount - aCount;
  });

  const hero = getHeroProfile();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-[#1e5a7d] to-[#4a8f8f] shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                aria-label={t('backToDashboard')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-white font-semibold">{t('communityFeedTitle')}</h2>
                <p className="text-xs text-white/80">{t('communityFeedTagline')}</p>
              </div>
            </div>
            <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <h3 className="text-2xl font-bold text-[#1e5a7d]">{t('trendingNow')}</h3>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-muted-foreground">{t('noReports')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sorted.map((report) => {
              const count = upvotes[report.id] || 0;
              const isVoted = voted.has(report.id);
              return (
                <div
                  key={report.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-semibold text-[#1e5a7d] text-lg">{report.id}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {report.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.date).toLocaleDateString('en-ZA', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1e5a7d]/10 text-[#1e5a7d] border border-[#1e5a7d]/20">
                      {report.category}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {report.description}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleUpvote(report.id)}
                      disabled={isVoted}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        isVoted
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:bg-green-50'
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${isVoted ? 'fill-green-500 text-green-500' : ''}`} />
                      <span className="font-medium">{t('meToo')}</span>
                      <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                        {count}
                      </span>
                    </button>

                    <button
                      onClick={() => onViewReport(report)}
                      className="text-xs text-[#1e5a7d] font-medium hover:underline"
                    >
                      {t('viewDetails')} →
                    </button>
                  </div>

                  {count > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {count} {t('peopleAlsoReported')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 bg-gradient-to-r from-[#1e5a7d] to-[#4a8f8f] rounded-xl text-white text-sm">
          <p>
            ⭐ {t('heroPoints')}: <strong>{hero.points}</strong> {t('pointsEarned')}
          </p>
        </div>
      </div>
    </div>
  );
}
