export type HeroLevel = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface HeroProfile {
  points: number;
  reportsSubmitted: number;
  upvotesGiven: number;
}

const STORAGE_KEY = 'heroPoints';

const LEVEL_THRESHOLDS: Record<HeroLevel, number> = {
  bronze: 0,
  silver: 100,
  gold: 250,
  platinum: 500,
  diamond: 1000,
};

export const POINTS_PER_REPORT = 10;
export const POINTS_PER_UPVOTE = 2;

export function getHeroProfile(): HeroProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore parse errors
  }
  return { points: 0, reportsSubmitted: 0, upvotesGiven: 0 };
}

function saveHeroProfile(profile: HeroProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function awardReportPoints(): HeroProfile {
  const profile = getHeroProfile();
  profile.points += POINTS_PER_REPORT;
  profile.reportsSubmitted += 1;
  saveHeroProfile(profile);
  return profile;
}

export function awardUpvotePoints(): HeroProfile {
  const profile = getHeroProfile();
  profile.points += POINTS_PER_UPVOTE;
  profile.upvotesGiven += 1;
  saveHeroProfile(profile);
  return profile;
}

export function getHeroLevel(points: number): { level: HeroLevel; labelKey: string; next: number | null } {
  let level: HeroLevel = 'bronze';
  let next: number | null = null;

  if (points >= LEVEL_THRESHOLDS.diamond) {
    level = 'diamond';
  } else if (points >= LEVEL_THRESHOLDS.platinum) {
    level = 'platinum';
    next = LEVEL_THRESHOLDS.diamond - points;
  } else if (points >= LEVEL_THRESHOLDS.gold) {
    level = 'gold';
    next = LEVEL_THRESHOLDS.platinum - points;
  } else if (points >= LEVEL_THRESHOLDS.silver) {
    level = 'silver';
    next = LEVEL_THRESHOLDS.gold - points;
  } else {
    level = 'bronze';
    next = LEVEL_THRESHOLDS.silver - points;
  }

  const labelKey =
    level === 'bronze'
      ? 'levelBronze'
      : level === 'silver'
      ? 'levelSilver'
      : level === 'gold'
      ? 'levelGold'
      : level === 'platinum'
      ? 'levelPlatinum'
      : 'levelDiamond';

  return { level, labelKey, next };
}
