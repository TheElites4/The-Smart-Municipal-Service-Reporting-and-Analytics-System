import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, Shield, Lock, Mail, Eye, EyeOff, CheckCircle2, Home } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation, type Language } from '../utils/i18n';

interface LoginProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
  onBackHome?: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function Login({ onSuccess, onSwitchToRegister, onBackHome, language, onLanguageChange }: LoginProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mfaCode: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateCredentials = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalidEmail');
    }

    if (!formData.password) {
      newErrors.password = t('passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateMFA = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.mfaCode.trim()) {
      newErrors.mfaCode = t('verificationCodeRequired');
    } else if (!/^\d{6}$/.test(formData.mfaCode)) {
      newErrors.mfaCode = t('codeMustBe6Digits');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCredentials()) return;

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setStep('mfa');
    }, 1000);
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateMFA()) return;

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
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              <img
                src="/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg"
                alt="MzansiReport Logo"
                className="w-32 h-32 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('citizenPortal')}</h1>
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

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-300">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('passwordPlaceholder')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-11 pr-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-300">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                    className="w-4 h-4 rounded border-white/30"
                  />
                  {t('rememberMe')}
                </label>
                <a href="#" className="text-[#FFB612] hover:underline">
                  {t('forgotPassword')}
                </a>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90 font-semibold py-6"
              >
                {isLoading ? t('verifying') : t('continueToMFA')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMFASubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('cancel')}
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 backdrop-blur-md mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">{t('verifyIdentity')}</h3>
                <p className="text-white/70 text-sm">
                  {t('enter6DigitCode')} {formData.email}
                </p>
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('verificationCode')}</label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={formData.mfaCode}
                  onChange={(e) => setFormData({ ...formData, mfaCode: e.target.value.replace(/\D/g, '') })}
                  className="text-center text-2xl tracking-widest bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                />
                {errors.mfaCode && <p className="mt-1 text-sm text-red-300">{errors.mfaCode}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90 font-semibold py-6"
              >
                {isLoading ? t('verifying') : t('verify')}
              </Button>

              <div className="text-center">
                <button type="button" className="text-white/70 hover:text-white text-sm">
                  {t('didntReceiveCode')} <span className="text-[#FFB612]">{t('resend')}</span>
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-white/80 text-sm">
              {t('donthaveAccount')}{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-[#FFB612] hover:underline font-medium"
              >
                {t('register')}
              </button>
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onBackHome}
              className="text-white/70 hover:text-white text-sm flex items-center justify-center gap-1 mx-auto"
            >
              <Home className="w-3 h-3" />
              {t('backToHome')}
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
