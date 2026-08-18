import { useState } from 'react';
import { Building2, Phone, Mail, MapPin, Search } from 'lucide-react';
import { MUNICIPALITIES } from '../utils/serviceData';

export function MunicipalityDirectory({ className = '' }: { className?: string }) {
  const [search, setSearch] = useState('');

  const filtered = MUNICIPALITIES.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.province.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-[#1e5a7d] flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Municipality Directory
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Contact details for major SA metropolitan municipalities
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search municipality or province..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a7d] text-sm"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No municipalities found
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.name} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1e5a7d]/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-[#1e5a7d]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{m.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {m.province}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm">
                    <a
                      href={`tel:${m.phone.replace(/\s/g, '')}`}
                      className="flex items-center gap-1 text-[#1e5a7d] hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {m.phone}
                    </a>
                    <a
                      href={`mailto:${m.email}`}
                      className="flex items-center gap-1 text-[#1e5a7d] hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      {m.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
