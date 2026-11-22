import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getViolations, getAllViolatorsWithStats, getSettings, subscribeToStore } from '../lib/store';
import { formatTunisianLiveDateTime, getRoleArabicLabel } from '../lib/dateUtils';
import {
  Search,
  PlusCircle,
  Users,
  FileText,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Clock,
  Shield,
  AlertTriangle,
  Package,
  Calendar,
  ChevronLeft,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [liveTime, setLiveTime] = useState(formatTunisianLiveDateTime());
  const [violations, setViolations] = useState(getViolations());
  const [violators, setViolators] = useState(getAllViolatorsWithStats());
  const [settings, setSettings] = useState(getSettings());

  // Live updating clock
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(formatTunisianLiveDateTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync with store updates
  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setViolations(getViolations());
      setViolators(getAllViolatorsWithStats());
      setSettings(getSettings());
    });
    return unsub;
  }, []);

  const repeatOffendersCount = violators.filter((v) => v.isRepeatOffender).length;
  const seizuresCount = violations.filter((v) => v.seizure && v.seizure.has).length;

  const handleLogout = () => {
    if (window.confirm('هل تريد تسجيل الخروج والعودة لشاشة الدخول؟')) {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Agent & Live Time Card */}
      <div className="bg-gradient-to-l from-primary via-slate-900 to-slate-900 text-white rounded-3xl p-5 shadow-lg border border-primary-light relative overflow-hidden">
        {/* Subtle background insignia */}
        <div className="absolute left-[-15px] bottom-[-20px] opacity-10 pointer-events-none w-44 h-44">
          <img src="/badge.svg" alt="" className="w-full h-full object-contain" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 p-2 flex items-center justify-center border border-white/20 shadow-inner">
                <Shield className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-300 block uppercase tracking-wider">
                  العون الميداني المتصل
                </span>
                <h2 className="text-lg font-black text-white leading-tight">
                  {user?.fullName || 'عون الشرطة البلدية'}
                </h2>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                user?.role === 'admin'
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  : user?.role === 'chef'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {getRoleArabicLabel(user?.role || 'agent')}
            </span>
          </div>

          {/* Live Tunisian Date & Time */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-200 gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-semibold">{liveTime.dayName}</span>
              <span>{liveTime.dateStr}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/25 px-2.5 py-1 rounded-lg font-mono text-yellow-400 font-bold">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              <span>{liveTime.timeStr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Statistics Banner */}
      <div className="grid grid-cols-3 gap-2.5">
        <div
          onClick={() => navigate('/violations')}
          className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 active:scale-95 transition-all text-center"
        >
          <span className="text-xl font-black text-primary">{violations.length}</span>
          <span className="text-[11px] font-bold text-slate-600 mt-0.5">مخالفة مسجلة</span>
        </div>

        <div
          onClick={() => navigate('/violators')}
          className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-red-300 active:scale-95 transition-all text-center"
        >
          <div className="flex items-center gap-1">
            <span className="text-xl font-black text-red-600">{repeatOffendersCount}</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          </div>
          <span className="text-[11px] font-bold text-slate-600 mt-0.5">مخالف متكرر</span>
        </div>

        <div
          onClick={() => navigate('/violations')}
          className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-emerald-300 active:scale-95 transition-all text-center"
        >
          <div className="flex items-center gap-1">
            <span className="text-xl font-black text-emerald-700">{seizuresCount}</span>
            <Package className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-[11px] font-bold text-slate-600 mt-0.5">عمليات حجز</span>
        </div>
      </div>

      {/* Grid of Large Touch-Friendly Tiles */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* Tile 1: Quick Search */}
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="group bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all flex flex-col items-start justify-between min-h-[120px] text-right touch-target"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
            <Search className="w-6 h-6" />
          </div>
          <div className="w-full mt-2">
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-primary transition-colors">
              بحث سريع عن مخالف
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">بالاسم، بطاقة التعريف أو اللوحة</p>
          </div>
        </button>

        {/* Tile 2: Add Violation (Highlighted Primary) */}
        <button
          type="button"
          onClick={() => navigate('/violations/new')}
          className="group bg-primary text-white rounded-3xl p-4 shadow-md shadow-primary/25 hover:shadow-lg active:scale-[0.98] transition-all flex flex-col items-start justify-between min-h-[120px] text-right touch-target relative overflow-hidden"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover:bg-white group-hover:text-primary transition-colors">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div className="w-full mt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-white">إضافة مخالفة جديدة</h3>
              <ChevronLeft className="w-4 h-4 text-white/80 group-hover:-translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-200 mt-0.5">معاينة ميدانية، GPS وصور</p>
          </div>
        </button>

        {/* Tile 3: Violators List */}
        <button
          type="button"
          onClick={() => navigate('/violators')}
          className="group bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all flex flex-col items-start justify-between min-h-[120px] text-right touch-target"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-700 group-hover:text-white transition-colors">
            <Users className="w-6 h-6" />
          </div>
          <div className="w-full mt-2">
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition-colors">
              قائمة المخالفين
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{violators.length} ملف مخالف مسجل</p>
          </div>
        </button>

        {/* Tile 4: Violations Register */}
        <button
          type="button"
          onClick={() => navigate('/violations')}
          className="group bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all flex flex-col items-start justify-between min-h-[120px] text-right touch-target"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors">
            <FileText className="w-6 h-6" />
          </div>
          <div className="w-full mt-2">
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
              سجل المخالفات
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">استعراض وتصفية المحاضر</p>
          </div>
        </button>

        {/* Tile 5: Reports */}
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="group bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all flex flex-col items-start justify-between min-h-[120px] text-right touch-target"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition-colors">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="w-full mt-2">
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors">
              التقارير والإحصائيات
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">حصيلة شهرية ورسوم بيانية</p>
          </div>
        </button>

        {/* Tile 6: Settings (Only for رئيس مركز) or Logout if not admin */}
        {user?.role === 'admin' ? (
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="group bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all flex flex-col items-start justify-between min-h-[120px] text-right touch-target"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-colors">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div className="w-full mt-2">
              <div className="flex items-center gap-1">
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-slate-800 transition-colors">
                  الإعدادات العامة
                </h3>
                <span className="text-[9px] bg-slate-200 px-1.5 py-0.2 rounded font-semibold">إدارة</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">تخصيص الهوية، الأعوان والبيانات</p>
            </div>
          </button>
        ) : (
          <div className="bg-slate-100/60 rounded-3xl p-4 border border-slate-200/50 flex flex-col items-start justify-between min-h-[120px] text-right opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-500">الإعدادات</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">متاحة فقط لرئيس المركز</p>
            </div>
          </div>
        )}
      </div>

      {/* Logout Button (Red Tile) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all touch-target"
        >
          <LogOut className="w-4 h-4 text-red-600" />
          <span>تسجيل الخروج من التطبيق الميداني</span>
        </button>
      </div>
    </div>
  );
};
