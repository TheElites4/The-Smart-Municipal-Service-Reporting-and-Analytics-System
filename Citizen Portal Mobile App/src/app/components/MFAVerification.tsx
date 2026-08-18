import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation, type Language } from '../utils/i18n';

interface MFAVerificationProps {
  onSuccess: () => void;
  onBack: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function MFAVerification({ onSuccess, onBack, language, onLanguageChange }: MFAVerificationProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setError(t('verificationCodeRequired'));
      return;
    }

    if (code.length !== 6) {
      setError(t('codeMustBe6Digits'));
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 1000);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{
        backgroundImage: `url('/src/imports/WhatsApp_Image_2026-05-11_at_22.41.20.jpeg')`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#1e5a7d]/60 via-[#4a8f8f]/50 to-[#1e5a7d]/60"></div>

      <div className="relative w-full max-w-md">
        <div className="absolute -top-4 right-0">
          <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8">
          {/* Header with Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              <img
                src="/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg"
                alt="MzansiReport Logo"
                className="w-32 h-32 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('mfaTitle')}</h1>
            <p className="text-white/90 text-sm">{t('secureLoginTagline')}</p>
          </div>

          {/* Security Badges */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/90 rounded-full text-xs font-medium text-white">
              <Lock className="w-3 h-3" />
              {t('tlsEncrypted')}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/90 rounded-full text-xs font-medium text-white">
              <Shield className="w-3 h-3" />
              {t('secureAuth')}
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 backdrop-blur-md mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">{t('verifyIdentity')}</h3>
            <p className="text-white/70 text-sm">{t('sendVerificationCodes')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white mb-2 text-sm font-medium">{t('verificationCode')}</label>
              <Input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
              />
              {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90 font-semibold py-6"
            >
              {isLoading ? t('verifying') : t('verify')}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <button
              type="button"
              className="text-white/70 hover:text-white text-sm"
            >
              {t('didntReceiveCode')} <span className="text-[#FFB612]">{t('resend')}</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-white/80 hover:text-white mx-auto text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('backToLogin')}
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-3 bg-white/5 rounded-lg border border-white/10">
            <p className="text-xs text-white/70 text-center">
              <Shield className="w-3 h-3 inline mr-1" />
              {t('popia')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
