import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getViolatorWithStats, getViolationsByViolatorId } from '../lib/store';
import {
  User,
  AlertTriangle,
  FileText,
  MapPin,
  Phone,
  PlusCircle,
  Clock,
  Camera,
  Package,
  Calendar,
  ChevronLeft,
  ShieldAlert,
} from 'lucide-react';
import { formatArabicDate, formatRelativeArabicTime } from '../lib/dateUtils';

export const ViolatorProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  const violator = getViolatorWithStats(id);
  const violations = getViolationsByViolatorId(id);

  if (!violator) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-800">لم يتم العثور على ملف المخالف</h2>
        <button
          onClick={() => navigate('/violators')}
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
        >
          العودة لقائمة المخالفين
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Violator Header Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {violator.photo ? (
                <img src={violator.photo} alt={violator.firstName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-9 h-9 text-slate-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900 leading-tight">
                  {violator.firstName} {violator.lastName}
                </h1>
                {violator.isRepeatOffender && (
                  <span className="bg-red-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>مخالف متكرر</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-600 font-mono mt-1">
                ب.ت.و: <span className="font-bold text-slate-900">{violator.nationalId}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/violations/new?violatorId=${violator.id}`)}
            className="px-3.5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow hover:opacity-90 active:scale-95 flex items-center gap-1.5 touch-target flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">تسجيل مخالفة جديدة</span>
            <span className="sm:hidden">مخالفة جديدة</span>
          </button>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>الهاتف: {violator.phone || 'غير مسجل'}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>العنوان: {violator.address}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
          <span className="text-2xl font-black text-primary block">{violator.violationCount}</span>
          <span className="text-[11px] font-bold text-slate-500">إجمالي المخالفات</span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
          <span className="text-2xl font-black text-amber-600 block">{violator.warningCount}</span>
          <span className="text-[11px] font-bold text-slate-500">التنبيهات (شفوي/كتابي)</span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center">
          <span className="text-2xl font-black text-emerald-600 block">{violator.seizureCount}</span>
          <span className="text-[11px] font-bold text-slate-500">عمليات الحجز</span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-slate-200 text-center col-span-2 sm:col-span-1">
          <span className="text-xs font-black text-slate-800 block truncate">
            {violator.lastAction || 'لا يوجد'}
          </span>
          <span className="text-[11px] font-bold text-slate-500">آخر إجراء متخذ</span>
        </div>
      </div>

      {/* Last violation place info */}
      {violator.lastViolationPlace && (
        <div className="bg-slate-100/80 rounded-2xl px-3.5 py-2.5 text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span>آخر مكان مخالفة: <strong>{violator.lastViolationPlace}</strong></span>
          </div>
          {violator.lastViolationDate && (
            <span className="text-[10px] text-slate-400 font-mono">
              {formatRelativeArabicTime(violator.lastViolationDate)}
            </span>
          )}
        </div>
      )}

      {/* Violation History List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            <span>سجل المخالفات المسجلة ({violations.length})</span>
          </h2>
          <span className="text-[11px] text-slate-500">مرتبة من الأحدث إلى الأقدم</span>
        </div>

        {violations.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-400 border border-slate-200">
            لا توجد مخالفات مسجلة لهذا الشخص
          </div>
        ) : (
          violations.map((violation) => {
            const totalPhotos = Object.values(violation.photosByCategory || {}).reduce(
              (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
              0
            );

            return (
              <div
                key={violation.id}
                onClick={() => navigate(`/violations/${violation.id}`)}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
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

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {violation.description}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{violation.street}</span>
                    </span>

                    {totalPhotos > 0 && (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Camera className="w-3 h-3 text-slate-500" />
                        <span>{totalPhotos} صور</span>
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
                    <span>التفاصيل</span>
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
