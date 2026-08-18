export interface ServiceStatus {
  area: string;
  water: 'normal' | 'reduced' | 'outage';
  power: 'normal' | 'reduced' | 'outage';
  updated: string;
}

export const MUNICIPALITIES = [
  { name: 'City of Johannesburg', province: 'Gauteng', phone: '0860 562 874', email: 'info@joburg.org.za' },
  { name: 'City of Cape Town', province: 'Western Cape', phone: '0860 103 089', email: 'contact@capetown.gov.za' },
  { name: 'eThekwini Municipality', province: 'KwaZulu-Natal', phone: '031 311 1111', email: 'info@durban.gov.za' },
  { name: 'City of Tshwane', province: 'Gauteng', phone: '012 358 9999', email: 'info@tshwane.gov.za' },
  { name: 'Ekurhuleni Metropolitan Municipality', province: 'Gauteng', phone: '0860 543 000', email: 'info@ekurhuleni.gov.za' },
  { name: 'Nelson Mandela Bay', province: 'Eastern Cape', phone: '041 506 1911', email: 'info@mandelametro.gov.za' },
  { name: 'Buffalo City', province: 'Eastern Cape', phone: '043 705 1000', email: 'info@buffalocity.gov.za' },
  { name: 'Mangaung Metropolitan Municipality', province: 'Free State', phone: '051 405 8911', email: 'info@mangaung.co.za' },
];

export const SERVICE_STATUS: ServiceStatus[] = [
  { area: 'City of Johannesburg', water: 'normal', power: 'reduced', updated: '2 mins ago' },
  { area: 'City of Cape Town', water: 'outage', power: 'normal', updated: '5 mins ago' },
  { area: 'eThekwini Municipality', water: 'normal', power: 'normal', updated: '10 mins ago' },
  { area: 'City of Tshwane', water: 'reduced', power: 'reduced', updated: '15 mins ago' },
  { area: 'Ekurhuleni', water: 'outage', power: 'normal', updated: '20 mins ago' },
];

export const SLA_BY_CATEGORY: Record<string, number> = {
  'Water & Sanitation': 48,
  Electricity: 72,
  'Roads & Potholes': 120,
  'Street Lighting': 96,
  'Waste Management': 24,
  'Parks & Recreation': 168,
  Other: 240,
};

export const CATEGORY_STATS = {
  'Water & Sanitation': 34,
  Electricity: 22,
  'Roads & Potholes': 18,
  'Street Lighting': 11,
  'Waste Management': 9,
  'Parks & Recreation': 4,
  Other: 2,
};

export const STATUS_DISTRIBUTION = [
  { name: 'Submitted', value: 25 },
  { name: 'In Progress', value: 45 },
  { name: 'Resolved', value: 30 },
];

export const TREND_DATA = [
  { month: 'Jan', reports: 120, resolved: 90 },
  { month: 'Feb', reports: 150, resolved: 110 },
  { month: 'Mar', reports: 135, resolved: 100 },
  { month: 'Apr', reports: 180, resolved: 140 },
  { month: 'May', reports: 210, resolved: 160 },
  { month: 'Jun', reports: 195, resolved: 150 },
];
