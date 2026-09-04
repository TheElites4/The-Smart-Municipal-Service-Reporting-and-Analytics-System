import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { HomePage } from './components/HomePage';
import { Registration } from './components/Registration';
import { Login } from './components/Login';
import { MFAVerification } from './components/MFAVerification';
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
  | 'registration'
  | 'login'
  | 'mfa'
  | 'dashboard'
  | 'new-report'
  | 'report-detail'
  | 'community';

const toCitizenReport = (report: any) => ({
  ...report,
  id: report.id || report.public_reference,
  date: report.date || report.created_at,
  status: report.status?.replace('_', '-') || 'submitted',
});

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { language, setLanguage } = useTranslation();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setIsAuthenticated(true);
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('home');
    }

    const savedReports = localStorage.getItem('reports');
    if (savedReports) setReports(JSON.parse(savedReports));
    const citizen = user ? JSON.parse(user) : {};
    if (citizen.id) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/reports?citizenId=${encodeURIComponent(citizen.id)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((remoteReports) => { if (remoteReports) setReports(remoteReports.map(toCitizenReport)); })
        .catch(() => undefined);
    }
    if (citizen.id && window.EventSource) {
      const events = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/events`);
      const refreshReports = () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/reports?citizenId=${encodeURIComponent(citizen.id)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((remoteReports) => { if (remoteReports) setReports(remoteReports.map(toCitizenReport)); })
        .catch(() => undefined);
      events.addEventListener('report.updated', refreshReports);
      events.addEventListener('report.created', refreshReports);
      return () => events.close();
    }
  }, []);

  const handleRegistrationSuccess = () => {
    setCurrentScreen('mfa');
  };

  const handleLoginSuccess = () => {
    setCurrentScreen('mfa');
  };

  const handleMFASuccess = () => {
    setIsAuthenticated(true);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentScreen('home');
    setReports([]);
  };

const handleSubmitReport = async (report: any) => {
    const citizen = JSON.parse(localStorage.getItem('user') || '{}');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...report, citizenId: citizen.id }),
      });
      if (response.ok) {
        const remoteReport = await response.json();
        report = toCitizenReport({ ...report, ...remoteReport, id: remoteReport.public_reference || remoteReport.id, date: remoteReport.created_at || report.date });
      }
    } catch {
      // Keep local persistence as an offline queue until the API is reachable.
    }
    const updatedReports = [...reports, report];
    setReports(updatedReports);
    localStorage.setItem('reports', JSON.stringify(updatedReports));

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

  if (currentScreen === 'home') {
    return (
      <HomePage
        onGetStarted={() => setCurrentScreen('registration')}
        onLogin={() => setCurrentScreen('login')}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  if (!isAuthenticated) {
    if (currentScreen === 'registration') {
      return (
        <Registration
          onSuccess={handleRegistrationSuccess}
          onSwitchToLogin={() => setCurrentScreen('login')}
          onBackHome={() => setCurrentScreen('home')}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
      );
    }

    if (currentScreen === 'login') {
      return (
        <Login
          onSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setCurrentScreen('registration')}
          onBackHome={() => setCurrentScreen('home')}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
      );
    }

    if (currentScreen === 'mfa') {
      return (
        <MFAVerification
          onSuccess={handleMFASuccess}
          onBack={() => setCurrentScreen('login')}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
      );
    }
  }

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
