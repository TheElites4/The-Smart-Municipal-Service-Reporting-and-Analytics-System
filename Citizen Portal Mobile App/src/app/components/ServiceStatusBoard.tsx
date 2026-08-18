import { Droplets, Zap, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { SERVICE_STATUS } from '../utils/serviceData';
import { useTranslation } from '../utils/i18n';

const STATUS_CONFIG = {
  normal: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Normal' },
  reduced: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Reduced' },
  outage: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Outage' },
};

export function ServiceStatusBoard({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-[#1e5a7d]">Service Status Board</h3>
        <p className="text-sm text-muted-foreground">Live water & power status by municipality</p>
      </div>

      <div className="divide-y divide-gray-100">
        {SERVICE_STATUS.map((status) => {
          const water = STATUS_CONFIG[status.water];
          const power = STATUS_CONFIG[status.power];
          const WaterIcon = water.icon;
          const PowerIcon = power.icon;
          return (
            <div key={status.area} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-800">{status.area}</p>
                <span className="text-xs text-muted-foreground">{status.updated}</span>
              </div>
              <div className="flex items-center gap-6">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${water.bg}`}>
                  <WaterIcon className={`w-4 h-4 ${water.color}`} />
                  <span className={`text-xs font-medium ${water.color}`}>
                    💧 Water · {water.label}
                  </span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${power.bg}`}>
                  <PowerIcon className={`w-4 h-4 ${power.color}`} />
                  <span className={`text-xs font-medium ${power.color}`}>
                    ⚡ Power · {power.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
