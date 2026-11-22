import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getViolations, getSettings, getViolators } from '../lib/store';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  MapPin,
  Camera,
  Package,
  ChevronLeft,
  Plus,
  Car,
  User,
} from 'lucide-react';
import { formatArabicDate } from '../lib/dateUtils';

export const ViolationsRegister: React.FC = () => {
  const navigate = useNavigate();
  const settings = getSettings();
  const violations = getViolations();
  const violators = getViolators();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      // Type filter
      if (selectedType !== 'ALL' && v.violationType !== selectedType) return false;

      // Action filter
      if (selectedAction !== 'ALL' && v.action !== selectedAction) return false;

      // Date filter (YYYY-MM-DD)
      if (dateFilter) {
        const violDate = v.date.split('T')[0];
        if (violDate !== dateFilter) return false;
      }

      // Search query (violator name, reference, street, plate)
      const q = search.trim().toLowerCase();
      if (q) {
        const violator = violators.find((viol) => viol.id === v.violatorId);
        const violatorName = violator
          ? `${violator.firstName} ${violator.lastName} ${violator.nationalId}`.toLowerCase()
          : '';
        const matches =
          v.reference.toLowerCase().includes(q) ||
          v.arabicReference.includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.street.toLowerCase().includes(q) ||
          (v.vehiclePlate && v.vehiclePlate.toLowerCase().includes(q)) ||
          violatorName.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [violations, violators, selectedType, selectedAction, dateFilter, search]);

  const resetFilters = () => {
    setSearch('');
    setSelectedType('ALL');
    setSelectedAction('ALL');
    setDateFilter('');
  };

  const hasActiveFilters =
    search || selectedType !== 'ALL' || selectedAction !== 'ALL' || dateFilter;

  return (
    <div className="space-y-4">
      {/* Title & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">سجل المخالفات البلدية</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            الأرشيف الميداني الرسمي لمحاضر ومعاينات الشرطة البلدية
          </p>
        </div>

        <button
          onClick={() => navigate('/violations/new')}
          className="px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 touch-target active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>مخالفة جديدة</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالرقم المرجعي، اسم المخالف، المكان..."
          className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Filter Controls Accordion / Row */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>خيارات التصفية والتصنيف</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-red-600 hover:underline text-[11px] font-semibold"
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Violation Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              صنف المخالفة
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 font-medium focus:bg-white focus:outline-none"
            >
              <option value="ALL">جميع الأصناف ({violations.length})</option>
              {settings.violationTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Action Taken */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              الإجراء المتخذ
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 font-medium focus:bg-white focus:outline-none"
            >
              <option value="ALL">جميع الإجراءات</option>
              {settings.actionTypes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              تاريخ المعاينة
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-slate-50 font-medium focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Results Count Banner */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
        <span>المعاينات المسجلة ({filteredViolations.length})</span>
        <span className="text-[11px] text-slate-400">مرتبة من الأحدث إلى الأقدم</span>
      </div>

      {/* Violations List */}
      <div className="space-y-3">
        {filteredViolations.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">لا توجد مخالفات مطابقة لمعايير البحث</p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-primary font-bold hover:underline"
              >
                إعادة ضبط خيارات التصفية
              </button>
            )}
          </div>
        ) : (
          filteredViolations.map((violation) => {
            const violator = violators.find((v) => v.id === violation.violatorId);
            const totalPhotos = Object.values(violation.photosByCategory || {}).reduce(
              (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
              0
            );

            return (
              <div
                key={violation.id}
                onClick={() => navigate(`/violations/${violation.id}`)}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
              >
                {/* Header row: Ref & Action */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                        {violation.reference}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {violation.violationType}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatArabicDate(violation.date)}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                      violation.action.includes('حجز')
                        ? 'bg-red-100 text-red-800'
                        : violation.action.includes('تنبيه')
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {violation.action}
                  </span>
                </div>

                {/* Violator & Arabic reference text */}
                <div className="bg-slate-50 p-2 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>{violator ? `${violator.firstName} ${violator.lastName}` : 'مخالف'}</span>
                      {violator && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          (ب.ت.و: {violator.nationalId})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      العون: {violation.agentName}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 italic">
                    المرجع اللفظي: {violation.arabicReference}
                  </div>
                </div>

                {/* Short description */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {violation.description}
                </p>

                {/* Footer info badges */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{violation.street}، {violation.area}</span>
                    </span>

                    {totalPhotos > 0 && (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                        <Camera className="w-3 h-3 text-slate-500" />
                        <span>{totalPhotos} صور</span>
                      </span>
                    )}

                    {violation.hasVehicle && violation.vehiclePlate && (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-slate-700">
                        <Car className="w-3 h-3 text-slate-500" />
                        <span>{violation.vehiclePlate}</span>
                      </span>
                    )}

                    {violation.seizure?.has && (
                      <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                        <Package className="w-3 h-3 text-emerald-600" />
                        <span>حجز {violation.seizure.quantity} {violation.seizure.unit}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-primary font-bold text-xs">
                    <span>فتح المحضر</span>
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
