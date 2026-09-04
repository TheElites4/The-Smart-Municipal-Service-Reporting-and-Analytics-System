import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, Shield, Lock, Mail, User, Phone, CreditCard, Eye, EyeOff, CheckCircle2, Home } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation, type Language } from '../utils/i18n';

interface RegistrationProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  onBackHome?: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function Registration({ onSuccess, onSwitchToLogin, onBackHome, language, onLanguageChange }: RegistrationProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'details' | 'mfa-setup'>('details');
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    mfaPhone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = t('fullNameRequired');
    }

    if (!formData.idNumber.trim()) {
      newErrors.idNumber = t('idNumberRequired');
    } else if (!/^\d{13}$/.test(formData.idNumber)) {
      newErrors.idNumber = t('idNumber13Digits');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalidEmail');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t('phoneRequired');
    } else if (!/^0\d{9}$/.test(formData.phone)) {
      newErrors.phone = t('invalidPhone');
    }

    if (!formData.password) {
      newErrors.password = t('passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('passwordMin8');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateMFASetup = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.mfaPhone.trim()) {
      newErrors.mfaPhone = t('mfaPhoneRequired');
    } else if (!/^0\d{9}$/.test(formData.mfaPhone)) {
      newErrors.mfaPhone = t('invalidPhone');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    setTimeout(async () => {
      let citizenId: string | undefined;
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/users/citizen`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fullName: formData.fullName, email: formData.email, phone: formData.phone }),
        });
        if (response.ok) citizenId = (await response.json()).id;
      } catch {
        // Keep the demo flow usable when the API is not configured.
      }
      if (citizenId) localStorage.setItem('pendingCitizenId', citizenId);
      setIsLoading(false);
      setFormData({ ...formData, mfaPhone: formData.phone });
      setStep('mfa-setup');
    }, 1000);
  };

  const handleMFASetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateMFASetup()) return;

    setIsLoading(true);

    setTimeout(() => {
      localStorage.setItem('user', JSON.stringify({
        id: localStorage.getItem('pendingCitizenId') || undefined,
        fullName: formData.fullName,
        idNumber: formData.idNumber,
        email: formData.email,
        phone: formData.phone,
        mfaEnabled: true,
      }));
      localStorage.removeItem('pendingCitizenId');
      setIsLoading(false);
      onSuccess();
    }, 1500);
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
            <h1 className="text-2xl font-bold text-white mb-2">{t('citizenRegistration')}</h1>
            <p className="text-white/90 text-sm">{t('tagline')} - MzansiReport</p>
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

          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('fullName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    placeholder={t('fullNamePlaceholder')}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="pl-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                </div>
                {errors.fullName && <p className="mt-1 text-sm text-red-300">{errors.fullName}</p>}
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('idNumber')}</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    placeholder={t('idNumberPlaceholder')}
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    maxLength={13}
                    className="pl-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                </div>
                {errors.idNumber && <p className="mt-1 text-sm text-red-300">{errors.idNumber}</p>}
              </div>

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
                <label className="block text-white mb-2 text-sm font-medium">{t('phone')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    type="tel"
                    placeholder={t('phonePlaceholder')}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    maxLength={10}
                    className="pl-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                </div>
                {errors.phone && <p className="mt-1 text-sm text-red-300">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('passwordMinPlaceholder')}
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

              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-11 pr-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-300">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90 font-semibold py-6 mt-6"
              >
                {isLoading ? t('processing') : t('continueToMFASetup')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMFASetupSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('cancel')}
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 backdrop-blur-md mb-3">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">{t('mfaSetup')}</h3>
                <p className="text-white/70 text-sm">{t('secureYourAccount')}</p>
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">{t('mfaPhoneLabel')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <Input
                    type="tel"
                    placeholder={t('phonePlaceholder')}
                    value={formData.mfaPhone}
                    onChange={(e) => setFormData({ ...formData, mfaPhone: e.target.value })}
                    maxLength={10}
                    className="pl-11 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30"
                  />
                </div>
                {errors.mfaPhone && <p className="mt-1 text-sm text-red-300">{errors.mfaPhone}</p>}
                <p className="mt-2 text-xs text-white/70">{t('weSendCodes')}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-white/80">{t('smsCodes')}</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-white/80">{t('emailVerification')}</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-white/80">{t('enhancedSecurity')}</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90 font-semibold py-6"
              >
                {isLoading ? t('registering') : t('completeRegistration')}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-white/80 text-sm">
              {t('alreadyAccount')}{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-[#FFB612] hover:underline font-medium"
              >
                {t('loginHere')}
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
