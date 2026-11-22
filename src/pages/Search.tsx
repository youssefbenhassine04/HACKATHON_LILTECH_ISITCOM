import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllViolatorsWithStats, getViolations } from '../lib/store';
import { Search as SearchIcon, AlertTriangle, User, FileText, ChevronLeft, Car, Hash } from 'lucide-react';
import { formatRelativeArabicTime } from '../lib/dateUtils';

export const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const violators = getAllViolatorsWithStats();
  const violations = getViolations();

  // Instant multi-criteria search
  const filteredViolators = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return violators;

    return violators.filter((v) => {
      // 1. By first name or last name or full name
      const fullName = `${v.firstName} ${v.lastName}`.toLowerCase();
      if (fullName.includes(q)) return true;

      // 2. By CIN (National ID)
      if (v.nationalId.includes(q)) return true;

      // 3. By phone
      if (v.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) return true;

      // 4. By vehicle plate of any violation linked to this violator
      const userViolations = violations.filter((viol) => viol.violatorId === v.id);
      const matchesPlate = userViolations.some(
        (viol) => viol.hasVehicle && viol.vehiclePlate?.toLowerCase().includes(q)
      );
      if (matchesPlate) return true;

      // 5. By violation reference number
      const matchesRef = userViolations.some(
        (viol) => viol.reference.toLowerCase().includes(q) || viol.arabicReference.includes(q)
      );
      if (matchesRef) return true;

      return false;
    });
  }, [query, violators, violations]);

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900">البحث السريع الميداني</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          ابحث بالاسم، اللقب، رقم ب.ت.و، رقم لوحة السيارة، أو رقم مرجع المخالفة
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <SearchIcon className="w-5 h-5 text-primary" />
        </div>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اكتب للبحث الفوري..."
          className="w-full pr-11 pl-4 py-3.5 rounded-2xl border-2 border-slate-200 focus:border-primary bg-white text-base font-semibold shadow-sm focus:outline-none transition-all placeholder:text-slate-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            مسح
          </button>
        )}
      </div>

      {/* Search Criteria Guide Tags */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700 flex-shrink-0">البحث يشمل:</span>
        <span className="bg-slate-200/70 px-2 py-0.5 rounded-md flex-shrink-0">الاسم واللقب</span>
        <span className="bg-slate-200/70 px-2 py-0.5 rounded-md flex-shrink-0">ب.ت.و (CIN)</span>
        <span className="bg-slate-200/70 px-2 py-0.5 rounded-md flex-shrink-0">رقم اللوحة</span>
        <span className="bg-slate-200/70 px-2 py-0.5 rounded-md flex-shrink-0">رقم المخالفة</span>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-1">
        <span>نتائج البحث ({filteredViolators.length})</span>
        {query && <span className="text-primary">مفلترة حسب: "{query}"</span>}
      </div>

      {/* Violators Cards List */}
      {filteredViolators.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <SearchIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">لم يتم العثور على أي نتائج مطابقة</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              تأكد من كتابة الاسم أو رقم بطاقة التعريف أو رقم السيارة بشكل صحيح
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/violations/new')}
            className="mt-2 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow hover:opacity-90 active:scale-95 touch-target"
          >
            تسجيل مخالف جديد الآن
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredViolators.map((violator) => {
            const userViolations = violations.filter((v) => v.violatorId === violator.id);
            const vehicles = userViolations
              .filter((v) => v.hasVehicle && v.vehiclePlate)
              .map((v) => v.vehiclePlate);
            const uniquePlates = Array.from(new Set(vehicles));

            return (
              <div
                key={violator.id}
                onClick={() => navigate(`/violators/${violator.id}`)}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Violator Avatar */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-400">
                      {violator.photo ? (
                        <img
                          src={violator.photo}
                          alt={violator.firstName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900">
                          {violator.firstName} {violator.lastName}
                        </h3>
                        {violator.isRepeatOffender && (
                          <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>مخالف متكرر</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-semibold">ب.ت.و: {violator.nationalId}</span>
                        <span>•</span>
                        <span>الهاتف: {violator.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Violations count badge */}
                  <div className="text-left flex-shrink-0">
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-xl text-xs font-black">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{violator.violationCount} مخالفات</span>
                    </span>
                  </div>
                </div>

                {/* Additional Info Snippets */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                  <span className="truncate max-w-[220px]">📍 {violator.address}</span>

                  {uniquePlates.length > 0 && (
                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-mono font-semibold">
                      <Car className="w-3 h-3 text-slate-500" />
                      <span>{uniquePlates.join(', ')}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-primary font-bold text-xs">
                    <span>عرض الملف</span>
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
