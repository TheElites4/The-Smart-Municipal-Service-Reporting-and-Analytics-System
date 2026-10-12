import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { HomePage } from './components/HomePage';
import { Dashboard } from './components/Dashboard';
import { ReportForm } from './components/ReportForm';
import { ReportDetail } from './components/ReportDetail';
import { CommunityFeed } from './components/CommunityFeed';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useTranslation, type Language } from './utils/i18n';
import { awardReportPoints, getHeroLevel, getHeroProfile } from './utils/gamification';
import { addNotification } from './utils/notifications';

type Screen =
  | 'home'
  | 'dashboard'
  | 'new-report'
  | 'report-detail'
  | 'community';

const toCitizenReport = (report: any) => ({
  ...report,
  id: report.id || report.public_reference,
  databaseId: report.databaseId || report.id,
  date: report.date || report.created_at,
  status: report.status?.replace('_', '-') || 'submitted',
});

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { language, setLanguage } = useTranslation();

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    localStorage.removeItem('reports');
    const updateLocation = (position: GeolocationPosition) => localStorage.setItem('clientLocation', JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date().toISOString() }));
    const locationWatch = navigator.geolocation?.watchPosition(updateLocation, () => undefined, { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 });
    let user = localStorage.getItem('user');
    if (!user) {
      const externalRef = crypto.randomUUID();
      user = JSON.stringify({ id: externalRef, externalRef, fullName: 'Anonymous Citizen', email: '' });
      localStorage.setItem('user', user);
      fetch(`${api}/api/users/anonymous`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ externalRef }) })
        .then((response) => response.ok ? response.json() : null)
        .then((identity) => { if (identity?.id) localStorage.setItem('user', JSON.stringify({ ...JSON.parse(user as string), id: identity.id })); })
        .catch(() => undefined);
    }

    const citizen = user ? JSON.parse(user) : {};
    const connectClient = (citizenId: string, externalRef: string) => {
      fetch(`${api}/api/reports?externalRef=${encodeURIComponent(externalRef)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((remoteReports) => { if (Array.isArray(remoteReports)) setReports(remoteReports.map(toCitizenReport)); })
        .catch(() => undefined);
      if (!window.EventSource) return undefined;
      const events = new EventSource(`${api}/api/events?citizenId=${encodeURIComponent(citizenId)}`);
      const refreshReports = () => fetch(`${api}/api/reports?externalRef=${encodeURIComponent(externalRef)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((remoteReports) => { if (Array.isArray(remoteReports)) setReports(remoteReports.map(toCitizenReport)); })
        .catch(() => undefined);
      events.addEventListener('report.updated', refreshReports);
      events.addEventListener('report.created', refreshReports);
      return () => events.close();
    };
    if (citizen.id && citizen.id !== citizen.externalRef) return connectClient(citizen.id, citizen.externalRef);
    if (citizen.externalRef) {
      fetch(`${api}/api/users/anonymous`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ externalRef: citizen.externalRef }) })
        .then((response) => response.ok ? response.json() : null)
        .then((identity) => { if (identity?.id) { const next = { ...citizen, id: identity.id }; localStorage.setItem('user', JSON.stringify(next)); connectClient(identity.id, citizen.externalRef); } })
        .catch(() => undefined);
    }
    return () => { if (locationWatch !== undefined) navigator.geolocation.clearWatch(locationWatch); };
  }, []);

  const handleLogout = () => {
    setCurrentScreen('home');
  };

  const handleSubmitReport = async (report: any) => {
    const citizen = JSON.parse(localStorage.getItem('user') || '{}');
    if (!citizen.externalRef) {
      citizen.externalRef = crypto.randomUUID();
      localStorage.setItem('user', JSON.stringify(citizen));
    }
    if (citizen.id === citizen.externalRef) {
      try {
        const identityResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/users/anonymous`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ externalRef: citizen.externalRef }) });
        if (identityResponse.ok) {
          const identity = await identityResponse.json();
          citizen.id = identity.id;
          localStorage.setItem('user', JSON.stringify(citizen));
        }
      } catch {
        citizen.id = citizen.externalRef;
      }
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...report, citizenId: citizen.id === citizen.externalRef ? null : citizen.id, externalRef: citizen.externalRef }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The service could not save this report.');
      const remoteReport = toCitizenReport(result);
      report = { ...remoteReport, id: remoteReport.public_reference || remoteReport.id, date: remoteReport.created_at || remoteReport.date };
    } catch (error) {
      toast.error('Report not submitted', { description: error instanceof Error ? error.message : 'The database could not confirm this report. Check your connection and try again.' });
      throw error;
    }
    setReports((currentReports) => [report, ...currentReports]);

    const prevProfile = getHeroProfile();
    const newProfile = awardReportPoints();
    const prevLevel = getHeroLevel(prevProfile.points).level;
    const newLevel = getHeroLevel(newProfile.points).level;

    toast.success(`Report submitted! +${report.points || 10} Hero Points 🎉`, {
      description: `${report.id} · ${report.category}`,
    });

    if (newLevel !== prevLevel) {
      confetti({ particleCount: 150, spread: 80, origin: { x: 0.5, y: 0.6 } });
      toast.success(`Level up! You are now a ${newLevel} hero! 🏆`);
    }

    addNotification({
      type: 'report',
      title: 'Report Submitted',
      message: `${report.id} has been submitted successfully.`,
    });

    setCurrentScreen('dashboard');
  };

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setCurrentScreen('report-detail');
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  if (currentScreen === 'dashboard') {
    return (
      <Dashboard
        onNewReport={() => setCurrentScreen('new-report')}
        onViewReport={handleViewReport}
        onLogout={handleLogout}
        onCommunityFeed={() => setCurrentScreen('community')}
        reports={reports}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  if (currentScreen === 'home') {
    return (
      <HomePage
        onGetStarted={() => setCurrentScreen('new-report')}
        onLogin={() => setCurrentScreen('dashboard')}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  if (currentScreen === 'community') {
    return (
      <CommunityFeed
        reports={reports}
        onViewReport={handleViewReport}
        language={language}
        onLanguageChange={handleLanguageChange}
        onBack={() => setCurrentScreen('dashboard')}
      />
    );
  }

  if (currentScreen === 'new-report') {
    return (
      <ReportForm
        onSubmit={handleSubmitReport}
        onCancel={() => setCurrentScreen('dashboard')}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  if (currentScreen === 'report-detail' && selectedReport) {
    return (
      <ReportDetail
        report={selectedReport}
        onBack={() => setCurrentScreen('dashboard')}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  return null;
}
