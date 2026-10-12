import {
  Droplets,
  Zap,
  Construction,
  Lightbulb,
  Trash2,
  Trees,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * One icon, one accent colour per service category, shared by the report form
 * picker and the report list so a category is always recognisable at a glance.
 * Keys are the exact category names returned by `GET /api/options`.
 */
export interface CategoryVisual {
  Icon: LucideIcon;
  /** Tailwind classes for the selected tile's icon bubble. */
  selected: string;
  /** Tailwind classes for an unselected tile's icon bubble. */
  idle: string;
  /** Hex used for the small inline icon in report lists. */
  hex: string;
}

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  'Water & Sanitation': { Icon: Droplets, selected: 'bg-blue-500 text-white', idle: 'bg-blue-50 text-blue-600', hex: '#3b82f6' },
  Electricity: { Icon: Zap, selected: 'bg-amber-500 text-white', idle: 'bg-amber-50 text-amber-600', hex: '#f59e0b' },
  'Roads & Potholes': { Icon: Construction, selected: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-600', hex: '#f97316' },
  'Street Lighting': { Icon: Lightbulb, selected: 'bg-yellow-500 text-white', idle: 'bg-yellow-50 text-yellow-600', hex: '#eab308' },
  'Waste Management': { Icon: Trash2, selected: 'bg-emerald-500 text-white', idle: 'bg-emerald-50 text-emerald-600', hex: '#10b981' },
  'Parks & Recreation': { Icon: Trees, selected: 'bg-green-600 text-white', idle: 'bg-green-50 text-green-700', hex: '#16a34a' },
  Other: { Icon: Wrench, selected: 'bg-slate-500 text-white', idle: 'bg-slate-100 text-slate-600', hex: '#64748b' },
};

const FALLBACK: CategoryVisual = CATEGORY_VISUALS.Other;

/** Looks up a category's visuals, falling back gracefully for unknown names. */
export function categoryVisual(name: string): CategoryVisual {
  return CATEGORY_VISUALS[name] ?? FALLBACK;
}
