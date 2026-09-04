import { Button } from './ui/button';
import { Plus, FileText, User, LogOut, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { NotificationCenter } from './NotificationCenter';
import { SOSButton } from './SOSButton';
import { LoadSheddingBanner } from './LoadSheddingBanner';
import { HeroBadge } from './HeroBadge';
import { ServiceStatusBoard } from './ServiceStatusBoard';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { Leaderboard } from './Leaderboard';
import { MunicipalityDirectory } from './MunicipalityDirectory';
import { CitizenAssistant } from './CitizenAssistant';
import { useTranslation, type Language } from '../utils/i18n';

interface DashboardProps {
  onNewReport: () => void;
  onViewReport: (report: any) => void;
  onLogout: () => void;
  onCommunityFeed: () => void;
  reports: any[];
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function Dashboard({
  onNewReport,
  onViewReport,
  onLogout,
  onCommunityFeed,
  reports,
  language,
  onLanguageChange,
}: DashboardProps) {
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'in-progress':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-[#173d3c] to-[#176b5b] shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/src/imports/WhatsApp_Image_2026-05-11_at_23.03.44.jpeg"
                alt="MzansiReport Logo"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="text-white font-semibold">{user.fullName}</h2>
                <p className="text-xs text-white/80">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <ThemeToggle />
              <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Load Shedding Banner */}
        <LoadSheddingBanner className="mb-6" />

        {/* Hero Badge */}
        <HeroBadge className="mb-6" />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-[#1e5a7d]">{reports.length}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('totalReports')}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-[#1e5a7d]/10 to-[#4a8f8f]/10 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#1e5a7d]" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">
                  {reports.filter((r) => r.status === 'in-progress').length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t('inProgress')}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600">
                  {reports.filter((r) => r.status === 'resolved').length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t('resolved')}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
          <h3 className="text-2xl font-bold text-[#1e5a7d]">{t('myReports')}</h3>
          <div className="flex gap-2">
            <Button
              onClick={onCommunityFeed}
              variant="outline"
              className="flex items-center gap-2 border-[#1e5a7d] text-[#1e5a7d]"
            >
              <Users className="w-4 h-4" />
              {t('communityFeed')}
            </Button>
            <Button
              onClick={onNewReport}
              className="flex items-center gap-2 bg-[#FFB612] text-black hover:bg-[#FFB612]/90 shadow-md"
            >
              <Plus className="w-4 h-4" />
              {t('newReport')}
            </Button>
          </div>
        </div>

        {/* Reports List */}
        {reports.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#1e5a7d]/10 to-[#4a8f8f]/10 mb-4">
              <FileText className="w-10 h-10 text-[#1e5a7d]" />
            </div>
            <h4 className="text-xl font-semibold text-[#1e5a7d] mb-2">{t('noReports')}</h4>
            <p className="text-muted-foreground mb-6">{t('submitFirst')}</p>
            <Button
              onClick={onNewReport}
              className="bg-[#FFB612] text-black hover:bg-[#FFB612]/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('submitReport')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => onViewReport(report)}
                className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-lg hover:border-[#1e5a7d]/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(report.status)}
                    <div>
                      <span className="font-semibold text-[#1e5a7d] text-lg">{report.id}</span>
                      <p className="text-sm text-muted-foreground">
                        {new Date(report.date).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      report.status
                    )}`}
                  >
                    {report.status.replace('-', ' ').toUpperCase()}
                  </span>
                </div>

                <h4 className="font-semibold text-foreground mb-2 group-hover:text-[#1e5a7d] transition-colors">
                  {report.category}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {report.description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        report.urgency === 'high' ? 'bg-red-500' :
                        report.urgency === 'medium' ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}></span>
                      {report.urgency.charAt(0).toUpperCase() + report.urgency.slice(1)} urgency
                    </span>
                  </div>
                  <span className="text-xs text-[#1e5a7d] font-medium group-hover:underline">
                    {t('viewDetails')} →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Advanced Sections */}
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <AnalyticsDashboard className="md:col-span-2" />
          <ServiceStatusBoard />
          <Leaderboard />
          <MunicipalityDirectory />
        </div>
      </div>

      <SOSButton />
      <CitizenAssistant />
    </div>
  );
}
