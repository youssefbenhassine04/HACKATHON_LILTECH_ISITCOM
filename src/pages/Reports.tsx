import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getViolations, getAllViolatorsWithStats, getSettings } from '../lib/store';
import {
  BarChart3,
  Users,
  FileText,
  AlertTriangle,
  Package,
  Calendar,
  TrendingUp,
  ShieldAlert,
  ChevronLeft,
  PieChart,
} from 'lucide-react';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const violations = getViolations();
  const violators = getAllViolatorsWithStats();
  const settings = getSettings();

  // 1. Counts by violation type
  const typeCounts = useMemo(() => {
    const map: { [key: string]: number } = {};
    settings.violationTypes.forEach((t) => (map[t] = 0));
    violations.forEach((v) => {
      map[v.violationType] = (map[v.violationType] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [violations, settings]);

  // 2. Counts by action taken
  const actionCounts = useMemo(() => {
    const map: { [key: string]: number } = {};
    settings.actionTypes.forEach((a) => (map[a] = 0));
    violations.forEach((v) => {
      map[v.action] = (map[v.action] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [violations, settings]);

  // 3. Monthly breakdown
  const monthlyCounts = useMemo(() => {
    const months = [
      'جانفي',
      'فيفري',
      'مارس',
      'أفريل',
      'ماي',
      'جوان',
      'جويلية',
      'أوت',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];

    const map: { [key: string]: number } = {};
    violations.forEach((v) => {
      const d = new Date(v.date);
      if (!isNaN(d.getTime())) {
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        map[key] = (map[key] || 0) + 1;
      }
    });

    return Object.entries(map);
  }, [violations]);

  // 4. Top repeat offenders
  const topRepeatOffenders = useMemo(() => {
    return [...violators]
      .filter((v) => v.violationCount > 0)
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 5);
  }, [violators]);

  const totalViolations = violations.length;
  const totalViolators = violators.length;
  const repeatOffendersCount = violators.filter((v) => v.isRepeatOffender).length;
  const seizuresCount = violations.filter((v) => v.seizure && v.seizure.has).length;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-slate-900">التقارير والإحصائيات الميدانية</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          لوحة مؤشرات أداء الشرطة البلدية ببلدية {settings.municipalityName}
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-primary mx-auto flex items-center justify-center mb-1.5">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900">{totalViolations}</span>
          <span className="block text-[11px] font-bold text-slate-500 mt-0.5">إجمالي المخالفات</span>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 mx-auto flex items-center justify-center mb-1.5">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900">{totalViolators}</span>
          <span className="block text-[11px] font-bold text-slate-500 mt-0.5">المخالفون المسجلون</span>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-1.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-red-600">{repeatOffendersCount}</span>
          <span className="block text-[11px] font-bold text-slate-500 mt-0.5">مخالفون متكررون (≥3)</span>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center mb-1.5">
            <Package className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-emerald-700">{seizuresCount}</span>
          <span className="block text-[11px] font-bold text-slate-500 mt-0.5">محاضر حجز فعلي</span>
        </div>
      </div>

      {/* Top Repeat Offenders Leaderboard */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>قائمة المخالفين الأكثر ارتكاباً للمخالفات</span>
          </h2>
          <span className="text-[11px] text-slate-400">أولوية المتابعة القانونية</span>
        </div>

        <div className="space-y-2">
          {topRepeatOffenders.map((offender, index) => (
            <div
              key={offender.id}
              onClick={() => navigate(`/violators/${offender.id}`)}
              className="bg-slate-50 hover:bg-slate-100 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                    index === 0
                      ? 'bg-red-600 text-white'
                      : index === 1
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {index + 1}
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">
                      {offender.firstName} {offender.lastName}
                    </span>
                    {offender.isRepeatOffender && (
                      <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                        متكرر
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ب.ت.و: {offender.nationalId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary font-black text-xs px-2.5 py-1 rounded-xl">
                  {offender.violationCount} مخالفات
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Counts by Violation Type */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
          <PieChart className="w-4 h-4 text-primary" />
          <span>توزيع المخالفات حسب الصنف</span>
        </h2>

        <div className="space-y-3 pt-1">
          {typeCounts.map(([typeName, count]) => {
            const percent = totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0;
            return (
              <div key={typeName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{typeName}</span>
                  <span className="text-slate-500 font-mono">
                    <strong>{count}</strong> ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Counts by Action Taken */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
          <TrendingUp className="w-4 h-4 text-emerald-700" />
          <span>توزيع الإجراءات المتخذة</span>
        </h2>

        <div className="space-y-3 pt-1">
          {actionCounts.map(([actionName, count]) => {
            const percent = totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0;
            const isSeizure = actionName.includes('حجز');
            const isWarning = actionName.includes('تنبيه');

            return (
              <div key={actionName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{actionName}</span>
                  <span className="text-slate-500 font-mono">
                    <strong>{count}</strong> ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSeizure ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthlyCounts.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span>الحصيلة الشهرية</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {monthlyCounts.map(([monthStr, count]) => (
              <div key={monthStr} className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                <span className="text-xs text-slate-500 font-bold block">{monthStr}</span>
                <span className="text-lg font-black text-primary block mt-0.5">{count} مخالفات</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
