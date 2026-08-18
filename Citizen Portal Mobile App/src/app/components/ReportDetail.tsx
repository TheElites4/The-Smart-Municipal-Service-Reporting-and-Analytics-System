import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { BackgroundWrapper } from './BackgroundWrapper';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SOSButton } from './SOSButton';
import { useTranslation, type Language } from '../utils/i18n';
import { SLA_BY_CATEGORY } from '../utils/serviceData';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Share2,
  Timer,
} from 'lucide-react';

interface ReportDetailProps {
  report: any;
  onBack: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const MOCK_TIMELINE = [
  {
    status: 'submitted',
    date: '2026-05-11',
    time: '09:30',
    description: 'reportSubmittedBy',
  },
  {
    status: 'reviewed',
    date: '2026-05-11',
    time: '14:15',
    description: 'reportAssigned',
  },
  {
    status: 'in-progress',
    date: '2026-05-12',
    time: '08:00',
    description: 'technicianDispatched',
  },
];

export function ReportDetail({ report, onBack, language, onLanguageChange }: ReportDetailProps) {
  const { t } = useTranslation();

  // SLA Countdown
  const slaHours = SLA_BY_CATEGORY[report.category] || 48;
  const submittedDate = new Date(report.date).getTime();
  const deadline = submittedDate + slaHours * 60 * 60 * 1000;

  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setIsOverdue(true);
        setTimeLeft('0h 0m');
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-5 h-5 text-yellow-600" />;
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
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `${t('appName')} - ${report.id}\n${report.category}\n${report.description}\n📍 ${report.location}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <BackgroundWrapper>
      <div className="min-h-screen">
        <div className="sticky top-0 bg-gradient-to-r from-[#1e5a7d] to-[#4a8f8f] text-white p-4 shadow-lg z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-primary-foreground/10 rounded-lg transition-colors"
                aria-label={t('backToDashboard')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2>{t('reportDetailsTitle')}</h2>
                <p className="text-xs text-primary-foreground/80">{t('reportTracking')}</p>
              </div>
            </div>
            <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
          </div>
        </div>

        <div className="max-w-md mx-auto p-4 pb-8">
          {report.aiDetected && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <SparklesIcon />
              <p className="text-sm text-purple-800">
                <strong>{t('aiDetect')}:</strong> {report.aiDetected}
              </p>
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-md border-2 border-primary/20 rounded-xl p-4 mb-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(report.status)}
                <span className="font-semibold text-foreground">{report.id}</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(
                  report.status
                )}`}
              >
                {report.status.replace('-', ' ')}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('categoryLabel')}</p>
                <p className="font-medium text-foreground">{report.category}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('description')}</p>
                <p className="text-foreground">{report.description}</p>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t('locationLabel')}</p>
                  <p className="text-foreground">{report.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t('submittedLabel')}</p>
                  <p className="text-foreground">
                    {new Date(report.date).toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('urgencyLabel')}</p>
                <span
                  className={`inline-block px-2 py-1 rounded text-sm ${
                    report.urgency === 'high'
                      ? 'bg-red-100 text-red-800'
                      : report.urgency === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {report.urgency.charAt(0).toUpperCase() + report.urgency.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* SLA Countdown */}
          {report.status !== 'resolved' && (
            <div
              className={`rounded-xl p-4 mb-4 shadow-lg border-2 ${
                isOverdue
                  ? 'bg-red-50 border-red-300'
                  : 'bg-blue-50 border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isOverdue ? 'bg-red-100' : 'bg-blue-100'
                  }`}
                >
                  <Timer className={`w-6 h-6 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${isOverdue ? 'text-red-800' : 'text-blue-800'}`}>
                    {isOverdue ? 'SLA Overdue' : 'SLA Countdown'}
                  </p>
                  <p className={`text-sm ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                    Expected resolution: {slaHours}h · Remaining: {timeLeft}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {report.photos && report.photos.length > 0 && (
            <div className="bg-white/95 backdrop-blur-md border-2 border-primary/20 rounded-xl p-4 mb-4 shadow-lg">
              <h3 className="mb-3">Attached Photos ({report.photos.length})</h3>
              <div className="grid grid-cols-2 gap-2">
                {report.photos.map((photo: string, index: number) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={photo} alt={`Report photo ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-md border-2 border-primary/20 rounded-xl p-4 shadow-lg">
            <h3 className="mb-4">{t('trackProgress')}</h3>

            <div className="space-y-4">
              {MOCK_TIMELINE.map((event, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                    {index < MOCK_TIMELINE.length - 1 && (
                      <div className="w-0.5 h-full bg-border mt-1 flex-1 min-h-[24px]" />
                    )}
                  </div>

                  <div className="flex-1 pb-4">
                    <p className="font-medium text-foreground">{t(event.description as 'reportSubmittedBy')}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString('en-ZA', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at {event.time}
                    </p>
                  </div>
                </div>
              ))}

              {report.status !== 'resolved' && (
                <div className="flex gap-3 opacity-50">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full border-2 border-border" />
                  </div>
                  <div className="flex-1">
                    <p className="text-muted-foreground">{t('issueResolved')}</p>
                    <p className="text-sm text-muted-foreground">{t('pending')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={handleWhatsAppShare}
              className="w-full bg-green-500 hover:bg-green-600 text-white mb-3"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {t('shareOnWhatsApp')}
            </Button>
            <Button className="w-full" variant="outline" onClick={onBack}>
              {t('backToDashboard')}
            </Button>
          </div>
        </div>

        <SOSButton />
      </div>
    </BackgroundWrapper>
  );
}

function SparklesIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100">
      <FileText className="w-3 h-3 text-purple-600" />
    </span>
  );
}
