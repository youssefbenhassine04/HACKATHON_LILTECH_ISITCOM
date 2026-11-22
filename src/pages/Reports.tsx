import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getViolations,
  getAllViolatorsWithStats,
  getSettings,
  getNationalMunicipalitySummary,
} from '../lib/store';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  Share2,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  Package,
  TrendingUp,
  ShieldAlert,
  ChevronLeft,
  PieChart,
  Percent,
  Check,
  Copy,
  FileDown,
} from 'lucide-react';
import { formatTunisianLiveDateTime } from '../lib/dateUtils';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const violations = getViolations();
  const violators = getAllViolatorsWithStats();
  const settings = getSettings();

  // Timeframe state: 'weekly' (last 7 days) vs 'monthly' (last 30 days)
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [copiedShareNotice, setCopiedShareNotice] = useState<string | null>(null);

  // Active view tab: 'national' (National Municipalities Summary) vs 'local' (Local Municipality Indicators)
  const [activeTab, setActiveTab] = useState<'national' | 'local'>('national');

  // National municipality summary calculation
  const nationalData = useMemo(() => {
    return getNationalMunicipalitySummary(timeframe);
  }, [timeframe, violations]);

  // Filter municipalities list in summary table
  const filteredMunicipalities = useMemo(() => {
    return nationalData.summaries.filter((m) => {
      if (showActiveOnly && m.totalViolations === 0) return false;
      if (!municipalitySearch.trim()) return true;

      const q = municipalitySearch.trim().toLowerCase();
      return (
        m.municipalityName.toLowerCase().includes(q) ||
        m.governorate.toLowerCase().includes(q) ||
        m.municipalityCode.toLowerCase().includes(q)
      );
    });
  }, [nationalData, municipalitySearch, showActiveOnly]);

  // Local analytics
  const typeCounts = useMemo(() => {
    const map: { [key: string]: number } = {};
    settings.violationTypes.forEach((t) => (map[t] = 0));
    violations.forEach((v) => {
      map[v.violationType] = (map[v.violationType] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [violations, settings]);

  const actionCounts = useMemo(() => {
    const map: { [key: string]: number } = {};
    settings.actionTypes.forEach((a) => (map[a] = 0));
    violations.forEach((v) => {
      map[v.action] = (map[v.action] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [violations, settings]);

  const topRepeatOffenders = useMemo(() => {
    return [...violators]
      .filter((v) => v.violationCount > 0)
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 5);
  }, [violators]);

  const handlePrintPdf = () => {
    window.print();
  };

  const handleShareReport = async () => {
    const periodText = timeframe === 'weekly' ? 'الأسبوعية' : 'الشهرية';
    const textToShare = `🏛️ الجمهورية التونسية - إدارة الشرطة البلدية\n📊 الحصيلة ${periodText} الموحدة لبلديات الجمهورية:\n• إجمالي المخالفات المسجلة: ${nationalData.totalViolations}\n• قيد التدقيق والمراجعة: ${nationalData.totalUnderReview}\n• تمت مراجعتها واعتمادها: ${nationalData.totalReviewed} (${nationalData.reviewPercentage}%)\n• عمليات الحجز الفعلي: ${nationalData.totalSeizures}\n• عدد البلديات النشطة: ${nationalData.activeMunicipalitiesCount}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `التقرير الإحصائي الوطني للشرطة البلدية (${periodText})`,
          text: textToShare,
          url: window.location.href,
        });
        return;
      } catch (err) {
        // Fallback to clipboard if dismissed or unsupported
      }
    }

    try {
      await navigator.clipboard.writeText(textToShare);
      setCopiedShareNotice('تم نسخ ملخص التقرير للحافظة بنجاح! يمكنك الآن مشاركته مباشرة.');
      setTimeout(() => setCopiedShareNotice(null), 4000);
    } catch {
      alert(textToShare);
    }
  };

  const currentDateTime = formatTunisianLiveDateTime();

  return (
    <div className="space-y-4">
      {/* Page Title & Main Tabs */}
      <div className="no-print space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">التقارير والإحصائيات</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة المخالفات الميدانية وحصيلة كافة بلديات الجمهورية التونسية
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShareReport}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 touch-target shadow-sm active:scale-95 transition-all"
              title="مشاركة التقرير"
            >
              <Share2 className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">مشاركة</span>
            </button>

            <button
              onClick={handlePrintPdf}
              className="px-3.5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 touch-target shadow-md active:scale-95 transition-all"
              title="تصدير وطباعة تقرير PDF رسمي"
            >
              <Printer className="w-4 h-4" />
              <span>تصدير PDF / طباعة</span>
            </button>
          </div>
        </div>

        {copiedShareNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{copiedShareNotice}</span>
          </div>
        )}

        {/* View Switcher Tabs: National Municipalities vs Local */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('national')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all touch-target ${
              activeTab === 'national'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>حصيلة بلديات الجمهورية (أسبوعي / شهري)</span>
            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.2 rounded-md font-mono">
              جديد
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all touch-target ${
              activeTab === 'local'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>مؤشرات بلدية {settings.municipalityName}</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION A: NATIONAL MUNICIPALITIES SUMMARY (WEEKLY & MONTHLY) */}
      {/* ============================================================ */}
      {activeTab === 'national' && (
        <div className="no-print space-y-4 animate-fadeIn">
          {/* Section Card with Timeframe Switcher & PDF Action */}
          <div className="bg-gradient-to-l from-primary via-slate-900 to-slate-900 text-white rounded-3xl p-5 shadow-lg border border-primary-light space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    الجمهورية التونسية
                  </span>
                  <span className="text-xs text-yellow-400 font-semibold">الإدارة العامة للشرطة البلدية</span>
                </div>
                <h2 className="text-lg font-black text-white mt-1">
                  الحصيلة الموحدة لكافة بلديات الجمهورية
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  رصد دقيق للمخالفات الإجمالية، المحاضر قيد التدقيق، والمحاضر المعتمدة
                </p>
              </div>

              {/* Timeframe Toggle Pills (Weekly vs Monthly) */}
              <div className="bg-white/10 p-1 rounded-2xl flex items-center gap-1 border border-white/20">
                <button
                  type="button"
                  onClick={() => setTimeframe('weekly')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all touch-target ${
                    timeframe === 'weekly'
                      ? 'bg-yellow-400 text-slate-950 shadow-md'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span>أسبوعي (7 أيام)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('monthly')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all touch-target ${
                    timeframe === 'monthly'
                      ? 'bg-yellow-400 text-slate-950 shadow-md'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span>شهري (30 يوماً)</span>
                </button>
              </div>
            </div>

            {/* National KPI Cards for the selected period */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* Total Violations */}
              <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/15 text-center">
                <span className="text-[11px] text-slate-300 font-bold block mb-1">
                  إجمالي المخالفات
                </span>
                <span className="text-2xl font-black text-white block">
                  {nationalData.totalViolations}
                </span>
                <span className="text-[10px] text-slate-300 mt-0.5 block">
                  في {nationalData.activeMunicipalitiesCount} بلدية نشطة
                </span>
              </div>

              {/* Under Review */}
              <div className="bg-amber-500/20 backdrop-blur rounded-2xl p-3 border border-amber-400/30 text-center">
                <span className="text-[11px] text-amber-200 font-bold block mb-1 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>قيد المراجعة</span>
                </span>
                <span className="text-2xl font-black text-amber-300 block">
                  {nationalData.totalUnderReview}
                </span>
                <span className="text-[10px] text-amber-200 mt-0.5 block">
                  تنتظر مصادقة رئيس الفرقة
                </span>
              </div>

              {/* Reviewed */}
              <div className="bg-emerald-500/20 backdrop-blur rounded-2xl p-3 border border-emerald-400/30 text-center">
                <span className="text-[11px] text-emerald-200 font-bold block mb-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تمت مراجعتها</span>
                </span>
                <span className="text-2xl font-black text-emerald-300 block">
                  {nationalData.totalReviewed}
                </span>
                <span className="text-[10px] text-emerald-200 mt-0.5 block">
                  محاضر مصادق عليها نهائياً
                </span>
              </div>

              {/* Review Percentage */}
              <div className="bg-blue-500/20 backdrop-blur rounded-2xl p-3 border border-blue-400/30 text-center">
                <span className="text-[11px] text-blue-200 font-bold block mb-1 flex items-center justify-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  <span>نسبة الاعتماد</span>
                </span>
                <span className="text-2xl font-black text-blue-300 block">
                  {nationalData.reviewPercentage}%
                </span>
                <div className="w-full bg-white/20 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${nationalData.reviewPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Export/Print Banner inside the summary */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-yellow-400" />
                <span>الفترة المحددة: <strong>{nationalData.timeframeLabel}</strong></span>
              </span>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow active:scale-95 transition-all touch-target"
              >
                <FileDown className="w-4 h-4" />
                <span>حفظ وطباعة جدول البلديات كملف PDF</span>
              </button>
            </div>
          </div>

          {/* Municipalities List & Filtering */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>جدول تفصيل البلديات عبر كامل تراب الجمهورية ({filteredMunicipalities.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  مقارنة المخالفات المسجلة وحالة المراجعة والتدقيق لكل بلدية
                </p>
              </div>

              {/* Active-only toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowActiveOnly(!showActiveOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    showActiveOnly
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {showActiveOnly ? 'البلديات النشطة فقط ✓' : 'عرض البلديات النشطة فقط'}
                </button>
              </div>
            </div>

            {/* Search filter for municipalities */}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={municipalitySearch}
                onChange={(e) => setMunicipalitySearch(e.target.value)}
                placeholder="ابحث باسم البلدية أو الولاية (مثال: سيدي بوعلي، تونس، صفاقس، سوسة...)"
                className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Responsive Table / Cards Grid */}
            <div className="space-y-2.5">
              {filteredMunicipalities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                  لم يتم العثور على بلديات مطابقة للبحث
                </div>
              ) : (
                filteredMunicipalities.map((m) => (
                  <div
                    key={m.municipalityCode}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      m.totalViolations > 0
                        ? 'bg-white border-slate-200/90 hover:border-primary/40 shadow-sm'
                        : 'bg-slate-50/60 border-slate-200/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            m.totalViolations > 0
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-slate-900">
                              بلدية {m.municipalityName}
                            </h4>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                              ولاية {m.governorate}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            الرمز: {m.municipalityCode}
                          </span>
                        </div>
                      </div>

                      {/* Total badge */}
                      <div className="text-left">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                            m.totalViolations > 0
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {m.totalViolations} مخالفات
                        </span>
                      </div>
                    </div>

                    {/* Breakdown metrics */}
                    <div className="grid grid-cols-3 gap-2 pt-2.5 mt-2.5 border-t border-slate-100 text-center text-xs">
                      {/* Under Review */}
                      <div className="bg-amber-50 rounded-xl p-2 border border-amber-200/60">
                        <span className="text-[10px] text-amber-800 font-bold block mb-0.5">
                          قيد المراجعة
                        </span>
                        <span className="font-black text-amber-900 text-sm">
                          {m.underReviewCount}
                        </span>
                      </div>

                      {/* Reviewed */}
                      <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-200/60">
                        <span className="text-[10px] text-emerald-800 font-bold block mb-0.5">
                          تمت مراجعتها
                        </span>
                        <span className="font-black text-emerald-900 text-sm">
                          {m.reviewedCount}
                        </span>
                      </div>

                      {/* Rate */}
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/80">
                        <span className="text-[10px] text-slate-600 font-bold block mb-0.5">
                          نسبة المراجعة
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          {m.reviewPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {m.totalViolations > 0 && (
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${m.reviewPercentage}%` }}
                          title={`تمت مراجعتها: ${m.reviewedCount}`}
                        />
                        <div
                          className="bg-amber-400 h-full"
                          style={{ width: `${100 - m.reviewPercentage}%` }}
                          title={`قيد المراجعة: ${m.underReviewCount}`}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION B: LOCAL MUNICIPALITY INDICATORS */}
      {/* ============================================================ */}
      {activeTab === 'local' && (
        <div className="no-print space-y-4 animate-fadeIn">
          {/* Local KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-primary mx-auto flex items-center justify-center mb-1.5">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-slate-900">{violations.length}</span>
              <span className="block text-[11px] font-bold text-slate-500 mt-0.5">إجمالي المخالفات</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 mx-auto flex items-center justify-center mb-1.5">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-slate-900">{violators.length}</span>
              <span className="block text-[11px] font-bold text-slate-500 mt-0.5">المخالفون المسجلون</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-1.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-red-600">
                {violators.filter((v) => v.isRepeatOffender).length}
              </span>
              <span className="block text-[11px] font-bold text-slate-500 mt-0.5">مخالفون متكررون</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center mb-1.5">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-emerald-700">
                {violations.filter((v) => v.seizure && v.seizure.has).length}
              </span>
              <span className="block text-[11px] font-bold text-slate-500 mt-0.5">محاضر حجز فعلي</span>
            </div>
          </div>

          {/* Top Repeat Offenders */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>قائمة المخالفين الأكثر ارتكاباً للمخالفات</span>
              </h2>
              <span className="text-[11px] text-slate-400">أولوية المتابعة</span>
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
                const percent =
                  violations.length > 0 ? Math.round((count / violations.length) * 100) : 0;
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
                const percent =
                  violations.length > 0 ? Math.round((count / violations.length) * 100) : 0;
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
        </div>
      )}

      {/* ============================================================ */}
      {/* OFFICIAL NATIONAL PRINTABLE PDF VIEW (.print-only) */}
      {/* ============================================================ */}
      <div className="print-only font-cairo text-black p-6 bg-white space-y-4 max-w-5xl mx-auto">
        {/* Official Tunisian National Header */}
        <div className="border-b-2 border-black pb-4 text-center space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-right text-xs leading-relaxed">
              <p className="font-bold">الجمهورية التونسية</p>
              <p>وزارة الداخلية</p>
              <p>الإدارة العامة للأمن الوطني</p>
              <p>إدارة الشرطة البلدية</p>
              <p className="font-bold">الإدارة المركزية للتنسيق والعمليات</p>
            </div>

            <div className="w-16 h-16 flex items-center justify-center">
              <img src="/logo-192.png" alt="شعار الشرطة البلدية" className="w-full h-full object-contain" />
            </div>

            <div className="text-left text-xs leading-relaxed font-mono">
              <p>تاريخ الاستخراج:</p>
              <p className="font-bold">{currentDateTime.fullStr}</p>
              <p className="mt-1">نوع الحصيلة:</p>
              <p className="font-bold">{timeframe === 'weekly' ? 'أسبوعية' : 'شهرية'}</p>
            </div>
          </div>

          <h1 className="text-lg font-black mt-3 underline decoration-double">
            التقرير الإحصائي الوطني الموحد لمخالفات الشرطة البلدية ({nationalData.timeframeLabel})
          </h1>
          <p className="text-xs font-semibold text-gray-700">
            متابعة شاملة لكافة بلديات الجمهورية التونسية: المخالفات، قيد المراجعة، والتي تمت مراجعتها
          </p>
        </div>

        {/* National Macro Indicators Table */}
        <div className="border border-black p-3 text-xs">
          <h2 className="font-bold border-b border-black pb-1 mb-2">
            أولاً: المؤشرات الوطنية الإجمالية ({nationalData.timeframeLabel})
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="border border-gray-400 p-2">
              <span className="block text-gray-600 font-semibold">إجمالي المخالفات المسجلة</span>
              <span className="text-base font-black">{nationalData.totalViolations}</span>
            </div>
            <div className="border border-gray-400 p-2">
              <span className="block text-gray-600 font-semibold">المحاضر قيد المراجعة</span>
              <span className="text-base font-black text-amber-900">{nationalData.totalUnderReview}</span>
            </div>
            <div className="border border-gray-400 p-2">
              <span className="block text-gray-600 font-semibold">المحاضر المعتمدة والمراجعة</span>
              <span className="text-base font-black text-emerald-900">{nationalData.totalReviewed}</span>
            </div>
            <div className="border border-gray-400 p-2">
              <span className="block text-gray-600 font-semibold">نسبة الاعتماد الوطني</span>
              <span className="text-base font-black">{nationalData.reviewPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Detailed Municipality Table */}
        <div className="border border-black text-xs">
          <h2 className="font-bold p-2 bg-gray-100 border-b border-black">
            ثانياً: الحصيلة التفصيلية حسب بلديات الجمهورية التونسية
          </h2>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-black text-[11px]">
                <th className="p-2 border-l border-black">الرقم</th>
                <th className="p-2 border-l border-black">البلدية</th>
                <th className="p-2 border-l border-black">الولاية</th>
                <th className="p-2 border-l border-black text-center">رمز البلدية</th>
                <th className="p-2 border-l border-black text-center">إجمالي المخالفات</th>
                <th className="p-2 border-l border-black text-center">قيد المراجعة</th>
                <th className="p-2 border-l border-black text-center">تمت مراجعتها</th>
                <th className="p-2 text-center">نسبة الاعتماد</th>
              </tr>
            </thead>
            <tbody>
              {nationalData.summaries.map((m, idx) => (
                <tr key={m.municipalityCode} className="border-b border-gray-300">
                  <td className="p-2 border-l border-gray-300 font-mono text-[10px]">{idx + 1}</td>
                  <td className="p-2 border-l border-gray-300 font-bold">بلدية {m.municipalityName}</td>
                  <td className="p-2 border-l border-gray-300">{m.governorate}</td>
                  <td className="p-2 border-l border-gray-300 text-center font-mono">{m.municipalityCode}</td>
                  <td className="p-2 border-l border-gray-300 text-center font-bold">{m.totalViolations}</td>
                  <td className="p-2 border-l border-gray-300 text-center">{m.underReviewCount}</td>
                  <td className="p-2 border-l border-gray-300 text-center">{m.reviewedCount}</td>
                  <td className="p-2 text-center font-mono font-bold">
                    {m.totalViolations > 0 ? `${m.reviewPercentage}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-black border-t-2 border-black">
                <td colSpan={4} className="p-2 border-l border-black text-left">
                  المجموع العام للجمهورية التونسية:
                </td>
                <td className="p-2 border-l border-black text-center">{nationalData.totalViolations}</td>
                <td className="p-2 border-l border-black text-center">{nationalData.totalUnderReview}</td>
                <td className="p-2 border-l border-black text-center">{nationalData.totalReviewed}</td>
                <td className="p-2 text-center">{nationalData.reviewPercentage}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Central Signatures Box */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center print-break-inside-avoid">
          <div className="border border-black p-4 h-28 flex flex-col justify-between">
            <p className="font-bold">رئيس مصلحة الإحصاء والتخطيط</p>
            <p className="text-[10px] text-gray-600">إدارة الشرطة البلدية</p>
          </div>

          <div className="border border-black p-4 h-28 flex flex-col justify-between">
            <p className="font-bold">مدير إدارة الشرطة البلدية (ختم واعتماد)</p>
            <p className="text-[10px] text-gray-600">الإدارة العامة للأمن الوطني</p>
          </div>
        </div>

        <p className="text-[9px] text-center text-gray-500 pt-3">
          وثيقة رسمية مستخرجة آلياً من المنظومة المركزية للشرطة البلدية بالجمهورية التونسية
        </p>
      </div>
    </div>
  );
};
