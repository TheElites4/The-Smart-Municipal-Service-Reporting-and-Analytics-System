import { Menu, X, ChevronRight, MapPin, FileText, BarChart3, Shield, ChevronDown, LayoutDashboard, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation, type Language } from '../utils/i18n';

// Staff and Admin dashboards are separate static apps. Default to the local
// static server; override with VITE_STAFF_DASHBOARD_URL / VITE_ADMIN_DASHBOARD_URL
// in deployment so the links point at the hosted dashboards.
const STAFF_DASHBOARD_URL =
  import.meta.env.VITE_STAFF_DASHBOARD_URL || 'http://localhost:8080/Staff%20Dashboard/';
const ADMIN_DASHBOARD_URL =
  import.meta.env.VITE_ADMIN_DASHBOARD_URL || 'http://localhost:8080/Admin%20Dashboard/';

interface HomePageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function HomePage({ onGetStarted, onLogin, language, onLanguageChange }: HomePageProps) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardsOpen, setDashboardsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img
                src="/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg"
                alt="MzansiReport Logo"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-lg font-semibold text-[#1e5a7d]">{t('appName')}</h1>
                <p className="text-xs text-muted-foreground">{t('tagline')}</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-4">
              <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
              <Button onClick={onLogin} variant="outline" size="sm" className="border-[#1e5a7d] text-[#1e5a7d]">{t('trackProgress')}</Button>
              <Button onClick={onGetStarted} size="sm" className="bg-[#FFB612] text-black hover:bg-[#FFB612]/90">{t('getStarted')}</Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2 border-t border-border">
              <div className="flex flex-col gap-2 mb-3">
                <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
                <Button onClick={onLogin} variant="outline" className="w-full border-[#1e5a7d] text-[#1e5a7d]">{t('trackProgress')}</Button>
                <Button onClick={onGetStarted} className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90">{t('getStarted')}</Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id="home"
        className="relative bg-cover bg-center bg-no-repeat py-24 px-4 min-h-[600px] flex items-center"
        style={{
          backgroundImage: `url('/src/imports/WhatsApp_Image_2026-05-11_at_22.41.20.jpeg')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e5a7d]/40 via-[#4a8f8f]/30 to-[#1e5a7d]/40"></div>
        <div className="relative max-w-7xl mx-auto text-center w-full">
          <div className="inline-flex items-center justify-center mb-6">
            <img
              src="/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg"
              alt="MzansiReport Logo"
              className="w-40 h-40 object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 drop-shadow-lg">
            {t('heroTitle')}
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-[#FFB612] mb-4 drop-shadow-md">
            {t('heroTagline')}
          </p>
          <p className="text-lg md:text-xl text-white/95 mb-8 max-w-3xl mx-auto drop-shadow-md">
            {t('heroDesc')}
          </p>
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={onGetStarted} size="lg" className="bg-[#FFB612] text-black hover:bg-[#FFB612]/90 shadow-lg">
                {t('getStarted')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button onClick={onLogin} size="lg" variant="outline" className="bg-white/90 text-[#1e5a7d] hover:bg-white border-white shadow-lg">
                {t('trackProgress')}
              </Button>
            </div>

            {/* Staff / Admin dashboard quick access */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDashboardsOpen((open) => !open)}
                aria-expanded={dashboardsOpen}
                aria-haspopup="true"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1e5a7d]/90 text-white text-sm font-semibold shadow-lg backdrop-blur-sm hover:bg-[#1e5a7d] transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Staff &amp; Admin dashboards
                <ChevronDown className={`w-4 h-4 transition-transform ${dashboardsOpen ? 'rotate-180' : ''}`} />
              </button>

              {dashboardsOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 rounded-xl bg-white shadow-2xl border border-border overflow-hidden z-50">
                  <a
                    href={STAFF_DASHBOARD_URL}
                    className="flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-lg bg-[#4a8f8f]/15 flex items-center justify-center flex-shrink-0">
                      <LayoutDashboard className="w-4 h-4 text-[#1e5a7d]" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#1e5a7d]">Staff dashboard</span>
                      <span className="block text-xs text-muted-foreground">Municipality service queue</span>
                    </span>
                  </a>
                  <a
                    href={ADMIN_DASHBOARD_URL}
                    className="flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-border"
                  >
                    <span className="w-9 h-9 rounded-lg bg-[#FFB612]/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-[#1e5a7d]" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#1e5a7d]">Admin dashboard</span>
                      <span className="block text-xs text-muted-foreground">Workforce management &amp; analytics</span>
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="services" className="py-20 px-4 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e5a7d] mb-4">
              {t('howItWorks')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('howItWorksDesc')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-16 h-16 bg-gradient-to-br from-[#1e5a7d] to-[#4a8f8f] rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#1e5a7d]">{t('featureReportTitle')}</h3>
              <p className="text-muted-foreground">{t('featureReportDesc')}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-16 h-16 bg-gradient-to-br from-[#1e5a7d] to-[#4a8f8f] rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#1e5a7d]">{t('featureTrackTitle')}</h3>
              <p className="text-muted-foreground">{t('featureTrackDesc')}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-16 h-16 bg-gradient-to-br from-[#1e5a7d] to-[#4a8f8f] rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#1e5a7d]">{t('featureResolveTitle')}</h3>
              <p className="text-muted-foreground">{t('featureResolveDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e5a7d] mb-6">
                {t('aboutTitle')}
              </h2>
              <p className="text-lg text-muted-foreground mb-4">{t('aboutDesc1')}</p>
              <p className="text-lg text-muted-foreground mb-6">{t('aboutDesc2')}</p>
              <Button onClick={onGetStarted} size="lg" className="bg-[#FFB612] text-black hover:bg-[#FFB612]/90">
                {t('joinNow')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-[#1e5a7d]/10 to-[#4a8f8f]/10 p-6 rounded-xl border border-[#1e5a7d]/20">
                <Shield className="w-12 h-12 text-[#1e5a7d] mb-3" />
                <h4 className="font-semibold mb-2 text-[#1e5a7d]">{t('secure')}</h4>
                <p className="text-sm text-muted-foreground">{t('secureDesc')}</p>
              </div>
              <div className="bg-gradient-to-br from-[#1e5a7d]/10 to-[#4a8f8f]/10 p-6 rounded-xl border border-[#1e5a7d]/20">
                <BarChart3 className="w-12 h-12 text-[#1e5a7d] mb-3" />
                <h4 className="font-semibold mb-2 text-[#1e5a7d]">{t('transparent')}</h4>
                <p className="text-sm text-muted-foreground">{t('transparentDesc')}</p>
              </div>
              <div className="bg-gradient-to-br from-[#1e5a7d]/10 to-[#4a8f8f]/10 p-6 rounded-xl border border-[#1e5a7d]/20">
                <FileText className="w-12 h-12 text-[#1e5a7d] mb-3" />
                <h4 className="font-semibold mb-2 text-[#1e5a7d]">{t('simple')}</h4>
                <p className="text-sm text-muted-foreground">{t('simpleDesc')}</p>
              </div>
              <div className="bg-gradient-to-br from-[#1e5a7d]/10 to-[#4a8f8f]/10 p-6 rounded-xl border border-[#1e5a7d]/20">
                <MapPin className="w-12 h-12 text-[#1e5a7d] mb-3" />
                <h4 className="font-semibold mb-2 text-[#1e5a7d]">{t('effective')}</h4>
                <p className="text-sm text-muted-foreground">{t('effectiveDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-20 px-4 bg-gradient-to-r from-[#1e5a7d] to-[#4a8f8f] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('readyToMake')}
          </h2>
          <p className="text-xl mb-8 text-white/90">
            {t('readyToMakeDesc')}
          </p>
          <Button onClick={onGetStarted} size="lg" className="bg-[#FFB612] text-black hover:bg-[#FFB612]/90 shadow-lg">
            {t('createAccount')}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg"
                  alt="MzansiReport Logo"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-semibold">{t('appName')}</span>
              </div>
              <p className="text-sm text-white/70">{t('footerAboutDesc')}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('quickLinks')}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#home" className="hover:text-white">{t('home')}</a></li>
                <li><a href="#about" className="hover:text-white">{t('about')}</a></li>
                <li><a href="#services" className="hover:text-white">{t('services')}</a></li>
                <li><a href="#contact" className="hover:text-white">{t('contact')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('legal')}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-white">{t('privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-white">{t('termsOfService')}</a></li>
                <li><a href="#" className="hover:text-white">{t('cookiePolicy')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('contact')}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>{t('emailContact')}</li>
                <li>{t('phoneContact')}</li>
                <li>{t('hoursContact')}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center text-sm text-white/70">
            <p>&copy; 2026 {t('appName')}. {t('copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
