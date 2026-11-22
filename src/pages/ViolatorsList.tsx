import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllViolatorsWithStats } from '../lib/store';
import { Users, Search, AlertTriangle, FileText, ChevronLeft, Plus, Phone, MapPin, ShieldAlert } from 'lucide-react';

export const ViolatorsList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterRepeatOnly, setFilterRepeatOnly] = useState(false);

  const violators = getAllViolatorsWithStats();

  const filtered = useMemo(() => {
    return violators.filter((v) => {
      if (filterRepeatOnly && !v.isRepeatOffender) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const name = `${v.firstName} ${v.lastName}`.toLowerCase();
      return name.includes(q) || v.nationalId.includes(q) || v.phone.includes(q);
    });
  }, [violators, search, filterRepeatOnly]);

  const repeatCount = violators.filter((v) => v.isRepeatOffender).length;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">قائمة المخالفين</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            سجل بطاقات المخالفين ومتابعة حالات التكرار
          </p>
        </div>

        <button
          onClick={() => navigate('/violations/new')}
          className="px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 touch-target active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>مخالف جديد</span>
        </button>
      </div>

      {/* Search & Quick Filters */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم بطاقة التعريف..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterRepeatOnly(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !filterRepeatOnly
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            الكل ({violators.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterRepeatOnly(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              filterRepeatOnly
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>المخالفون المتكررون ({repeatCount})</span>
          </button>
        </div>
      </div>

      {/* Violators List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">لا توجد نتائج مطابقة للبحث</p>
          </div>
        ) : (
          filtered.map((violator) => (
            <div
              key={violator.id}
              onClick={() => navigate(`/violators/${violator.id}`)}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {violator.photo ? (
                      <img src={violator.photo} alt={violator.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900">
                        {violator.firstName} {violator.lastName}
                      </h3>
                      {violator.isRepeatOffender && (
                        <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>مخالف متكرر ({violator.violationCount})</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-medium mt-0.5">
                      ب.ت.و: {violator.nationalId}
                    </div>
                  </div>
                </div>

                <div className="text-left flex-shrink-0">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-xl text-xs font-black">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{violator.violationCount} مخالفات</span>
                  </span>
                </div>
              </div>

              {/* Stats badges bar */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-3 text-[11px]">
                  <span>التنبيهات: <strong>{violator.warningCount}</strong></span>
                  <span>عمليات الحجز: <strong>{violator.seizureCount}</strong></span>
                </div>

                <div className="flex items-center gap-1 text-primary font-bold text-xs">
                  <span>فتح الملف الشخصي</span>
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
