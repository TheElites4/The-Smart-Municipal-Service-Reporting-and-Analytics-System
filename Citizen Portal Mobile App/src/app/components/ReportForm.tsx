import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BackgroundWrapper } from './BackgroundWrapper';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SOSButton } from './SOSButton';
import { useTranslation, type Language } from '../utils/i18n';
import {
  FileText,
  MapPin,
  Upload,
  Locate,
  Droplet,
  Zap,
  Construction,
  Lightbulb,
  Trash2,
  Trees,
  MoreHorizontal,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ReportFormProps {
  onSubmit: (report: any) => void;
  onCancel: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const ISSUE_CATEGORIES = [
  {
    name: 'Water & Sanitation',
    icon: Droplet,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    keywords: ['water', 'leak', 'pipe', 'sewage', 'drain', 'flood', 'meter'],
  },
  {
    name: 'Electricity',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    keywords: ['power', 'electricity', 'outage', 'cable', 'spark', 'wire', 'transformer'],
  },
  {
    name: 'Roads & Potholes',
    icon: Construction,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    keywords: ['pothole', 'road', 'asphalt', 'traffic', 'street', 'pavement', 'crater'],
  },
  {
    name: 'Street Lighting',
    icon: Lightbulb,
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    keywords: ['light', 'lamp', 'streetlight', 'dark', 'bulb', 'illuminat'],
  },
  {
    name: 'Waste Management',
    icon: Trash2,
    color: 'bg-green-100 text-green-700 border-green-300',
    keywords: ['garbage', 'waste', 'rubbish', 'litter', 'bin', 'dump', 'refuse'],
  },
  {
    name: 'Parks & Recreation',
    icon: Trees,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    keywords: ['park', 'playground', 'grass', 'tree', 'garden', 'green'],
  },
  {
    name: 'Other',
    icon: MoreHorizontal,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    keywords: [],
  },
];

export function ReportForm({ onSubmit, onCancel, language, onLanguageChange }: ReportFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    location: '',
    municipality: '',
    urgency: 'medium',
  });
const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const [aiStatus, setAiStatus] = useState<
    'idle' | 'analyzing' | 'detected' | 'failed'
  >('idle');
  const [aiDetectedCategory, setAiDetectedCategory] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: string[] = [];
    Array.from(files).slice(0, 4).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          newPhotos.push(reader.result);
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.category) {
      newErrors.category = t('pleaseSelectCategory');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('descriptionRequired');
    } else if (formData.description.length < 20) {
      newErrors.description = t('descriptionMin');
    }

    if (!formData.location.trim()) {
      newErrors.location = t('locationRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAiDetection = (description: string) => {
    setAiStatus('analyzing');
    setAiDetectedCategory('');

    // Simulate AI processing delay
    setTimeout(() => {
      const lower = description.toLowerCase();

      // Find matching category based on keywords
      let detected: string | null = null;
      for (const cat of ISSUE_CATEGORIES) {
        if (cat.keywords.some((kw) => lower.includes(kw))) {
          detected = cat.name;
          break;
        }
      }

      if (detected) {
        setAiDetectedCategory(detected);
        setFormData((prev) => ({ ...prev, category: detected }));
        setAiStatus('detected');
      } else {
        setAiStatus('failed');
      }
    }, 1500);
  };

  const getMunicipality = async () => {
    setLocating(true);

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const mockMunicipalities = [
          { name: 'City of Johannesburg', lat: -26.2041, lon: 28.0473 },
          { name: 'City of Cape Town', lat: -33.9249, lon: 18.4241 },
          { name: 'eThekwini Municipality', lat: -29.8587, lon: 31.0218 },
          { name: 'City of Tshwane', lat: -25.7479, lon: 28.2293 },
          { name: 'Ekurhuleni Metropolitan Municipality', lat: -26.1714, lon: 28.2460 },
        ];

        let nearest = mockMunicipalities[0];
        let minDistance = Infinity;

        mockMunicipalities.forEach((muni) => {
          const distance = Math.sqrt(
            Math.pow(latitude - muni.lat, 2) + Math.pow(longitude - muni.lon, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearest = muni;
          }
        });

        setFormData({
          ...formData,
          municipality: nearest.name,
          location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        });
        setLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enter it manually.');
        setLocating(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

const report = {
      id: `RPT-${Date.now()}`,
      ...formData,
      status: 'submitted',
      date: new Date().toISOString(),
      aiDetected: aiStatus === 'detected' ? aiDetectedCategory : null,
      photos,
    };

    onSubmit(report);
  };

  return (
    <BackgroundWrapper>
      <div className="min-h-screen">
        <div className="sticky top-0 bg-gradient-to-r from-[#1e5a7d] to-[#4a8f8f] text-white p-4 shadow-lg z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <div>
                <h2>{t('submitReportTitle')}</h2>
                <p className="text-xs text-primary-foreground/80">MzansiReport - {t('tagline')}</p>
              </div>
            </div>
            <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
          </div>
        </div>

        <div className="max-w-md mx-auto p-4 pb-8">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-primary/20 mt-4">
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div>
                <Label>{t('selectCategory')}</Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {ISSUE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = formData.category === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: cat.name })
                        }
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? `${cat.color} border-current shadow-md scale-105`
                            : 'bg-white border-border hover:border-primary/30'
                        }`}
                      >
                        <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? '' : 'text-muted-foreground'}`} />
                        <p className={`text-sm font-medium text-center ${isSelected ? '' : 'text-foreground'}`}>
                          {cat.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {errors.category && (
                  <p className="mt-2 text-sm text-destructive">{errors.category}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="description">{t('description')}</Label>
                  <button
                    type="button"
                    onClick={() => handleAiDetection(formData.description)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[#1e5a7d]/10 text-[#1e5a7d] hover:bg-[#1e5a7d]/20 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    AI Detect
                  </button>
                </div>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (aiStatus !== 'idle') setAiStatus('idle');
                  }}
                  placeholder="Provide detailed information about the issue..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
                />

                {/* AI Detection Status */}
                {aiStatus === 'analyzing' && (
                  <div className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                    <p className="text-sm text-blue-700">{t('aiAnalyzing')}</p>
                  </div>
                )}
                {aiStatus === 'detected' && (
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        {t('aiDetect')}: {aiDetectedCategory}
                      </p>
                      <p className="text-xs text-green-700">Category auto-selected</p>
                    </div>
                  </div>
                )}
                {aiStatus === 'failed' && (
                  <div className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700">{t('aiAnalysisFailed')}</p>
                  </div>
                )}

                {errors.description && (
                  <p className="mt-1 text-sm text-destructive">{errors.description}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {formData.description.length} {t('characterCount')}
                </p>
              </div>

              <div>
                <Label htmlFor="location">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  {t('locationLabel')}
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="location"
                    placeholder={t('streetAddressPlaceholder')}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getMunicipality}
                    disabled={locating}
                    className="px-3"
                  >
                    <Locate className={`w-5 h-5 ${locating ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {errors.location && <p className="mt-1 text-sm text-destructive">{errors.location}</p>}
                {formData.municipality && (
                  <p className="mt-2 text-sm text-primary font-medium">
                    📍 {formData.municipality}
                  </p>
                )}
              </div>

              <div>
                <Label>{t('urgency')}</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: level })}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        formData.urgency === level
                          ? 'bg-[#1e5a7d] text-white border-[#1e5a7d]'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {t(level === 'low' ? 'urgencyLow' : level === 'medium' ? 'urgencyMedium' : 'urgencyHigh')}
                    </button>
                  ))}
                </div>
              </div>

<div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-[#1e5a7d]/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('uploadPhotos')}</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 4 photos</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onCancel}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" className="w-full bg-[#FFB612] text-black hover:bg-[#FFB612]/90">
                  {t('submitReport')}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <SOSButton />
      </div>
    </BackgroundWrapper>
  );
}
