import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  LineChart,
} from 'recharts';
import { CATEGORY_STATS, STATUS_DISTRIBUTION, TREND_DATA } from '../utils/serviceData';

const CATEGORY_COLORS = ['#1e5a7d', '#4a8f8f', '#FFB612', '#E03C31', '#7c3aed', '#059669', '#6b7280'];
const STATUS_COLORS = ['#FFB612', '#1e5a7d', '#059669'];

export function AnalyticsDashboard({ className = '' }: { className?: string }) {
  const categoryData = Object.entries(CATEGORY_STATS).map(([name, value]) => ({ name, value }));

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
      <h3 className="text-lg font-semibold text-[#1e5a7d] mb-1">Analytics Dashboard</h3>
      <p className="text-sm text-muted-foreground mb-6">Community issue trends & performance</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Reports by Category */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Reports by Category</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {categoryData.map((entry, index) => (
                  <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Status Distribution</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={STATUS_DISTRIBUTION}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {STATUS_DISTRIBUTION.map((entry, index) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Trend */}
        <div className="md:col-span-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Monthly Trend (Reports vs Resolved)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={TREND_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="reports" stroke="#1e5a7d" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="resolved" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
