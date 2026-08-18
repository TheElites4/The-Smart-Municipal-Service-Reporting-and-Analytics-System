import { useState } from 'react';
import { AlertTriangle, Phone, X, Shield } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface SOSButtonProps {
  className?: string;
}

const EMERGENCY_CONTACTS = [
  { key: 'police', number: '10111', icon: '🚔' },
  { key: 'fire', number: '10177', icon: '🚒' },
  { key: 'medical', number: '10177', icon: '🚑' },
];

export function SOSButton({ className = '' }: SOSButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-4 rounded-full bg-red-600 text-white font-bold shadow-2xl hover:bg-red-700 active:scale-95 transition-all ${className}`}
        aria-label={t('emergencySOS')}
      >
        <AlertTriangle className="w-6 h-6 animate-pulse" />
        <span className="hidden sm:inline">{t('emergencySOS')}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{t('sosTitle')}</h3>
                    <p className="text-sm text-white/90">{t('sosSubtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <Shield className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{t('sosServices')}</p>
              </div>

              {EMERGENCY_CONTACTS.map((contact) => (
                <a
                  key={contact.key}
                  href={`tel:${contact.number}`}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{contact.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{t(contact.key as 'police')}</p>
                      <p className="text-sm text-muted-foreground">{contact.number}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium group-hover:bg-red-700">
                    <Phone className="w-4 h-4" />
                    {t('callNow')}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
