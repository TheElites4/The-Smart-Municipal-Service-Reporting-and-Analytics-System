import { useState, useRef, useEffect } from 'react';
import { Languages, Check } from 'lucide-react';
import type { Language } from '../utils/i18n';

interface LanguageSwitcherProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zu', label: 'isiZulu', flag: '🇿🇦' },
  { code: 'xh', label: 'isiXhosa', flag: '🇿🇦' },
  { code: 'af', label: 'Afrikaans', flag: '🇿🇦' },
];

export function LanguageSwitcher({ language, onLanguageChange }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white"
      >
        <Languages className="w-4 h-4" />
        <span className="text-sm font-medium">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                onLanguageChange(lang.code);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span className={lang.code === language ? 'font-semibold text-[#1e5a7d]' : 'text-gray-700'}>
                  {lang.label}
                </span>
              </span>
              {lang.code === language && <Check className="w-4 h-4 text-[#1e5a7d]" />}
            </button>
          ))}
        </div>
      )}
</div>
  );
}
