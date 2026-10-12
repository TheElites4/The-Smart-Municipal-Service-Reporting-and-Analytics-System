import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BackgroundWrapper } from './BackgroundWrapper';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SOSButton } from './SOSButton';
import { useTranslation, type Language } from '../utils/i18n';
import { FileText, MapPin, Locate, CheckCircle2, XCircle, Check } from 'lucide-react';
import { categoryVisual } from '../utils/categoryIcons';

const api = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface ReportFormProps {
  onSubmit: (report: any) => Promise<void>;
  onCancel: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function ReportForm({ onSubmit, onCancel, language, onLanguageChange }: ReportFormProps) {
  const { t } = useTranslation();
  const [serviceOptions, setServiceOptions] = useState<{ categories: string[]; municipalities: string[]; issues: { category: string; label: string }[] }>({ categories: [], municipalities: [], issues: [] });
  const [optionsUnavailable, setOptionsUnavailable] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    issueType: '',
    description: '',
    location: '',
    municipality: '',
    urgency: 'medium',
  });
const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const [suggestionStatus] = useState<'idle' | 'matched' | 'unmatched'>('idle');
  const [suggestedCategory] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photo, setPhoto] = useState<{ base64: string; contentType: string } | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/options`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Options unavailable')))
      .then((options) => setServiceOptions({ categories: options.categories || [], municipalities: [...new Set(options.municipalities || [])], issues: options.issues || [] }))
      .catch(() => setOptionsUnavailable(true));
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.category) {
      newErrors.category = t('pleaseSelectCategory');
    }

    if (!formData.issueType && !formData.description.trim()) newErrors.description = 'Choose an issue or describe what happened.';

    if (!formData.location.trim()) {
      newErrors.location = t('locationRequired');
    }
    if (!serviceOptions.municipalities.includes(formData.municipality)) newErrors.municipality = 'Choose a municipality from the list.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

        try {
          const response = await fetch(`${api}/api/location/reverse?latitude=${latitude}&longitude=${longitude}`);
          const place = await response.json();
          if (!response.ok || !place.location) throw new Error(place.error || 'Could not identify your location');
          setCoordinates({ latitude, longitude });
          setFormData((previous) => ({ ...previous, municipality: serviceOptions.municipalities.includes(place.municipality) ? place.municipality : '', location: place.location }));
          if (!serviceOptions.municipalities.includes(place.municipality)) alert('Location found. Please choose your municipality from the list.');
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Location lookup unavailable. Enter an address manually.');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enter it manually.');
        setLocating(false);
      }
    );
  };

  const choosePhoto = async (file?: File) => {
    setPhoto(null);
    setPhotoName('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3_000_000) {
      setErrors((previous) => ({ ...previous, photo: 'Choose a JPEG, PNG or WebP photo under 3 MB.' }));
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Unable to read photo'));
      reader.readAsDataURL(file);
    });
    setPhoto({ contentType: file.type, base64: dataUrl.split(',')[1] });
    setPhotoName(file.name);
    setErrors((previous) => ({ ...previous, photo: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try { await onSubmit({ ...formData, description: [formData.issueType, formData.description.trim()].filter(Boolean).join(' — '), ...coordinates, ...(photo ? { photo } : {}) }); }
    catch { /* The parent displays the API error; keep this form available to retry. */ }
    finally { setSubmitting(false); }
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
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 pb-8 border border-primary/20 mt-4 overflow-hidden">
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div>
                <Label>{t('selectCategory')}</Label>
                {optionsUnavailable ? (
                  <p className="mt-2 text-sm text-muted-foreground">Categories unavailable — check the service connection.</p>
                ) : (
                  <div role="radiogroup" aria-label={t('selectCategory')} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                    {serviceOptions.categories.map((category) => {
                      const { Icon, selected, idle } = categoryVisual(category);
                      const isSelected = formData.category === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setFormData((previous) => ({ ...previous, category, issueType: '' }))}
                          className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all ${
                            isSelected
                              ? 'border-[#1e5a7d] bg-[#1e5a7d]/5 ring-2 ring-[#1e5a7d]/30 shadow-sm'
                              : 'border-border bg-white hover:border-[#1e5a7d]/40 hover:shadow-sm'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1e5a7d] text-white">
                              <Check className="w-3 h-3" strokeWidth={3} />
                            </span>
                          )}
                          <span className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${isSelected ? selected : idle}`}>
                            <Icon className="w-5 h-5" strokeWidth={2} />
                          </span>
                          <span className={`text-xs font-medium leading-tight ${isSelected ? 'text-[#1e5a7d]' : 'text-foreground'}`}>{category}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.category && (
                  <p className="mt-2 text-sm text-destructive">{errors.category}</p>
                )}
              </div>

              <div>
                <Label htmlFor="issue-type">What happened? (choose instead of typing)</Label>
                <select id="issue-type" value={formData.issueType} onChange={(event) => setFormData({ ...formData, issueType: event.target.value })} disabled={!formData.category} className="mt-2 w-full rounded-lg border-border bg-input-background px-4 py-3">
                  <option value="">Choose an issue or describe it below</option>
                  {serviceOptions.issues.filter((issue) => issue.category === formData.category).map((issue) => <option key={issue.label} value={issue.label}>{issue.label}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="description">{t('description')}</Label>
                </div>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                  }}
                  placeholder="Provide detailed information about the issue..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
                />

                {false && suggestionStatus === 'matched' && (
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        {t('categorySuggested')}: {suggestedCategory}
                      </p>
                      <p className="text-xs text-green-700">Category auto-selected</p>
                    </div>
                  </div>
                )}
                {false && suggestionStatus === 'unmatched' && (
                  <div className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700">{t('categorySuggestionNoMatch')}</p>
                  </div>
                )}

                {errors.description && (
                  <p className="mt-1 text-sm text-destructive">{errors.description}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">{formData.description.length} characters · Optional details are saved exactly as entered.</p>
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
                    onChange={(e) => { setCoordinates(null); setFormData({ ...formData, location: e.target.value }); }}
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
                {formData.location && <p className="mt-2 text-sm text-primary font-medium">📍 {formData.location}{formData.municipality ? ` · ${formData.municipality}` : ''}</p>}
                <label className="block mt-3 text-sm text-muted-foreground" htmlFor="municipality-confirm">Choose your municipality</label>
                <select id="municipality-confirm" value={formData.municipality} onChange={(event) => setFormData((previous) => ({ ...previous, municipality: event.target.value }))} disabled={!serviceOptions.municipalities.length} className="w-full px-4 py-3 rounded-lg bg-input-background border border-border">
                  <option value="">{optionsUnavailable ? 'Municipalities unavailable' : 'Choose municipality'}</option>
                  {serviceOptions.municipalities.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                {errors.municipality && <p className="mt-1 text-sm text-destructive">{errors.municipality}</p>}
              </div>

              <div>
                <Label htmlFor="report-photo">Add a photo (optional)</Label>
                <Input id="report-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0]).catch(() => setErrors((previous) => ({ ...previous, photo: 'Unable to read photo.' })))} className="mt-2" />
                <p className="mt-1 text-sm text-muted-foreground">{photoName || 'JPEG, PNG or WebP · max 3 MB · stored with your report'}</p>
                {photo && <img src={`data:${photo.contentType};base64,${photo.base64}`} alt="Selected report preview" className="mt-3 max-h-48 w-full rounded-lg object-cover" />}
                {photo && <Button type="button" variant="outline" onClick={() => { setPhoto(null); setPhotoName(''); }} className="mt-2">Remove photo</Button>}
                {errors.photo && <p className="text-sm text-destructive">{errors.photo}</p>}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-5 mt-2 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-w-0 min-h-12"
                  onClick={onCancel}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={submitting || optionsUnavailable || !serviceOptions.categories.length || !serviceOptions.municipalities.length} className="w-full min-w-0 min-h-12 bg-[#f4b942] text-[#17383a] hover:bg-[#f4b942]/90 shadow-md">
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
