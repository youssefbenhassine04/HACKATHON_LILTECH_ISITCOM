import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getViolationById, getViolatorById, getSettings, setViolationReviewStatus } from '../lib/store';
import { PhotoCategory, ReviewStatus } from '../types';
import { formatArabicDate } from '../lib/dateUtils';
import {
  FileText,
  Printer,
  Edit,
  User,
  MapPin,
  ExternalLink,
  Car,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  ZoomIn,
  X,
  FileDown,
  Building,
} from 'lucide-react';

const CATEGORY_NAMES: { [key in PhotoCategory]: string } = {
  violation: 'صور وضعية المخالفة',
  goods: 'صور البضائع والمعروضات',
  vehicle: 'صور وسيلة النقل واللوحة المنجمية',
  documents: 'صور الوثائق والالتزامات',
  place: 'صور مكان ورصيف الانتصاب',
};

export const ViolationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = getSettings();

  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  const [violationState, setViolationState] = useState(() => (id ? getViolationById(id) : null));

  if (!id) return null;

  const violation = violationState || getViolationById(id);
  if (!violation) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-800">لم يتم العثور على محضر المخالفة</h2>
        <button
          onClick={() => navigate('/violations')}
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
        >
          العودة لسجل المخالفات
        </button>
      </div>
    );
  }

  const violator = getViolatorById(violation.violatorId);
  const canEdit = user?.role === 'chef' || user?.role === 'admin';

  const handlePrint = () => {
    window.print();
  };

  const handleToggleReview = () => {
    if (!user) return;
    const nextStatus: ReviewStatus = violation.reviewStatus === 'reviewed' ? 'under_review' : 'reviewed';
    const updated = setViolationReviewStatus(violation.id, nextStatus, user);
    setViolationState(updated);
  };

  const hasCoordinates = violation.geo && violation.geo.lat !== 0 && violation.geo.lng !== 0;
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${violation.geo.lat},${violation.geo.lng}`
    : '#';

  const embedMapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${violation.geo.lng - 0.005}%2C${
        violation.geo.lat - 0.003
      }%2C${violation.geo.lng + 0.005}%2C${violation.geo.lat + 0.003}&layer=mapnik&marker=${
        violation.geo.lat
      }%2C${violation.geo.lng}`
    : null;

  const totalPhotos = Object.values(violation.photosByCategory || {}).reduce(
    (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* On-Screen Action Controls Bar (Hidden during Print) */}
      <div className="no-print bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-primary text-sm bg-primary/10 px-2.5 py-1 rounded-xl">
            {violation.reference}
          </span>
          <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
            بلدية {violation.municipalityName || settings.municipalityName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => navigate(`/violations/${violation.id}/edit`)}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 touch-target active:scale-95 transition-all"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>تعديل</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 touch-target active:scale-95 transition-all"
            title="طباعة محضر رسمي"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 touch-target active:scale-95 transition-all"
            title="تصدير كملف PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>تصدير PDF</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SCREEN UI VIEW (Clean interactive mobile cards) */}
      {/* ============================================================ */}
      <div className="no-print space-y-4">
        {/* Review Status Banner & Approval Action */}
        <div
          className={`p-3.5 rounded-3xl flex flex-wrap items-center justify-between gap-2.5 border shadow-sm ${
            violation.reviewStatus === 'reviewed'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/90 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                violation.reviewStatus === 'reviewed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {violation.reviewStatus === 'reviewed' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs">
                  {violation.reviewStatus === 'reviewed'
                    ? 'محضر معتمد ومصادق عليه نهائياً'
                    : 'محضر قيد التدقيق والمراجعة الإدارية'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                    violation.reviewStatus === 'reviewed'
                      ? 'bg-emerald-200 text-emerald-800'
                      : 'bg-amber-200 text-amber-800'
                  }`}
                >
                  {violation.reviewStatus === 'reviewed' ? 'تمت المراجعة' : 'تحت المراجعة'}
                </span>
              </div>
              {violation.reviewedBy ? (
                <span className="text-[11px] text-emerald-800 block mt-0.5 font-medium">
                  تم التدقيق والاعتماد من قبل: <strong>{violation.reviewedBy}</strong>
                  {violation.reviewedAt && ` • ${formatArabicDate(violation.reviewedAt)}`}
                </span>
              ) : (
                <span className="text-[11px] text-amber-800 block mt-0.5">
                  بانتظار مصادقة رئيس الفرقة أو رئيس المركز
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <button
              onClick={handleToggleReview}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 touch-target ${
                violation.reviewStatus === 'reviewed'
                  ? 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {violation.reviewStatus === 'reviewed'
                ? 'إعادة للتدقيق'
                : 'اعتماد ومصادقة المحضر ✓'}
            </button>
          )}
        </div>

        {/* Main Reference & Header Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                المرجع الفني للمخالفة
              </span>
              <h1 className="text-xl font-black text-primary font-mono">{violation.reference}</h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                المرجع اللفظي: <strong className="text-slate-900">{violation.arabicReference}</strong>
              </p>
            </div>

            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                violation.action.includes('حجز')
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : violation.action.includes('تنبيه')
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}
            >
              {violation.action}
            </span>
          </div>

          {/* Metadata chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>تاريخ وساعة المعاينة: <strong>{formatArabicDate(violation.date)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>العون المعاين: <strong>{violation.agentName}</strong> ({violation.agentUsername})</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-400" />
              <span>البلدية: <strong>بلدية {violation.municipalityName || settings.municipalityName}</strong> (ولاية {violation.governorate})</span>
            </div>
          </div>
        </div>

        {/* Violator Information Card */}
        {violator && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>بيانات المخالف</span>
              </h2>
              <button
                onClick={() => navigate(`/violators/${violator.id}`)}
                className="text-primary text-xs font-bold hover:underline"
              >
                عرض الملف الكامل ←
              </button>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {violator.photo ? (
                  <img src={violator.photo} alt={violator.firstName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
              </div>

              <div className="space-y-1 text-xs text-slate-700">
                <div className="font-bold text-sm text-slate-900">
                  {violator.firstName} {violator.lastName}
                </div>
                <div className="font-mono">
                  رقم بطاقة التعريف: <strong>{violator.nationalId}</strong>
                </div>
                <div>الهاتف: {violator.phone || 'غير متوفر'}</div>
                <div>العنوان: {violator.address}</div>
              </div>
            </div>
          </div>
        )}

        {/* Violation & Legal Description Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span>حيثيات المخالفة الميدانية</span>
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl">
              <span className="text-slate-500 block mb-0.5">صنف المخالفة</span>
              <span className="font-bold text-slate-900">{violation.violationType}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl">
              <span className="text-slate-500 block mb-0.5">نوع النشاط</span>
              <span className="font-bold text-slate-900">{violation.activityType || 'غير محدد'}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl col-span-2">
              <span className="text-slate-500 block mb-0.5">البضاعة المعروضة</span>
              <span className="font-bold text-slate-900">{violation.goodsType || 'غير محدد'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 block mb-1">وصف المخالفة:</span>
            <p className="text-xs text-slate-800 bg-slate-50 p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap border border-slate-100">
              {violation.description}
            </p>
          </div>

          {violation.notes && (
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">ملاحظات إضافية:</span>
              <p className="text-xs text-slate-600 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/60 leading-relaxed">
                {violation.notes}
              </p>
            </div>
          )}
        </div>

        {/* Vehicle Info Card (If any) */}
        {violation.hasVehicle && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              <span>بيانات وسيلة النقل المستعملة</span>
            </h2>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl">
                <span className="text-slate-500 block">نوع الوسيلة</span>
                <span className="font-bold text-slate-900">{violation.vehicleType || 'غير محدد'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl">
                <span className="text-slate-500 block">اللوحة المنجمية</span>
                <span className="font-bold font-mono text-primary">
                  {violation.vehiclePlate || 'بدون لوحة'}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl">
                <span className="text-slate-500 block">اللون</span>
                <span className="font-bold text-slate-900">{violation.vehicleColor || 'غير محدد'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Location & GPS Map Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>المكان والإحداثيات الجغرافية (GPS)</span>
            </h2>
            {hasCoordinates && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-xs font-bold hover:underline flex items-center gap-1"
              >
                <span>فتح في خرائط Google</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">الشارع والنهج:</span>
              <span className="font-bold text-slate-900">{violation.street}</span>
            </div>
            <div>
              <span className="text-slate-500 block">المنطقة والحي:</span>
              <span className="font-bold text-slate-900">{violation.area || 'غير محدد'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">المعتمدية / البلدية:</span>
              <span className="font-bold text-slate-900">{violation.delegation}</span>
            </div>
            <div>
              <span className="text-slate-500 block">الولاية:</span>
              <span className="font-bold text-slate-900">{violation.governorate}</span>
            </div>
          </div>

          {/* Embedded OpenStreetMap */}
          {embedMapUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-300 shadow-inner mt-2">
              <iframe
                title="موقع المعاينة"
                src={embedMapUrl}
                className="w-full h-48 border-0"
                loading="lazy"
              />
              <div className="p-2 bg-slate-50 text-[11px] text-slate-600 flex items-center justify-between">
                <span className="font-mono">
                  📍 {violation.geo.lat.toFixed(5)}, {violation.geo.lng.toFixed(5)}
                </span>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <span>تكبير الخريطة</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Seizure Section (If any) */}
        {violation.seizure?.has && (
          <div className="bg-emerald-50/70 rounded-3xl p-5 border border-emerald-200 shadow-sm space-y-3">
            <h2 className="text-sm font-black text-emerald-900 border-b border-emerald-200 pb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>إجراءات الحجز الفعلي للمواد</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-2xl border border-emerald-100 col-span-2 sm:col-span-1">
                <span className="text-emerald-700 block font-medium">نوع المادة المحجوزة</span>
                <span className="font-black text-slate-900 text-sm">
                  {violation.seizure.itemType}
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-emerald-100">
                <span className="text-emerald-700 block font-medium">الكمية والوحدة</span>
                <span className="font-black text-emerald-900 text-sm">
                  {violation.seizure.quantity} {violation.seizure.unit}
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-emerald-100 col-span-2 sm:col-span-1">
                <span className="text-emerald-700 block font-medium">مكان الحفظ والإيداع</span>
                <span className="font-bold text-slate-800">
                  {violation.seizure.storage || 'المستودع البلدي'}
                </span>
              </div>
            </div>

            {violation.seizure.notes && (
              <p className="text-xs text-slate-700 bg-white p-3 rounded-2xl border border-emerald-100 leading-relaxed">
                {violation.seizure.notes}
              </p>
            )}
          </div>
        )}

        {/* Categorized Photos Section (الصور والمرفقات) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>الصور والمرفقات الميدانية ({totalPhotos} صور)</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">مصنفة حسب الفئات الرسمية</span>
          </div>

          {(['violation', 'goods', 'vehicle', 'documents', 'place'] as PhotoCategory[]).map(
            (catKey) => {
              const list = violation.photosByCategory?.[catKey] || [];
              if (list.length === 0) return null;

              return (
                <div key={catKey} className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span>{CATEGORY_NAMES[catKey]} ({list.length})</span>
                  </h3>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {list.map((photoUrl, pIdx) => (
                      <div
                        key={pIdx}
                        onClick={() => setActiveModalImage(photoUrl)}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm cursor-pointer"
                      >
                        <img
                          src={photoUrl}
                          alt={`${CATEGORY_NAMES[catKey]} ${pIdx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <ZoomIn className="w-5 h-5 drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          )}

          {totalPhotos === 0 && (
            <p className="text-center text-xs text-slate-400 py-4">
              لم يتم إرفاق صور في هذا المحضر
            </p>
          )}
        </div>

        {/* Edit History Section (سجل التعديلات) */}
        {violation.edits && violation.edits.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>سجل التعديلات والتدقيق ({violation.edits.length})</span>
            </h2>

            <div className="space-y-2.5">
              {violation.edits.map((edit, eIdx) => (
                <div key={eIdx} className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{edit.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatArabicDate(edit.date)}
                    </span>
                  </div>
                  <div className="text-slate-700">
                    <strong>سبب التعديل:</strong> {edit.reason}
                  </div>
                  {edit.fields && edit.fields.length > 0 && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      الحقول المعدلة: {edit.fields.join('، ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* OFFICIAL PRINT LAYOUT (Shown only when window.print() is called) */}
      {/* ============================================================ */}
      <div className="print-only font-cairo text-black p-6 bg-white space-y-4 max-w-4xl mx-auto">
        {/* Official Tunisian Republic Header */}
        <div className="border-b-2 border-black pb-4 text-center space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-right text-xs leading-relaxed">
              <p className="font-bold">الجمهورية التونسية</p>
              <p>وزارة الداخلية</p>
              <p>الإدارة العامة للأمن الوطني</p>
              <p>إدارة الشرطة البلدية</p>
              <p className="font-bold">بلدية {violation.municipalityName || settings.municipalityName}</p>
            </div>

            <div className="w-16 h-16 flex items-center justify-center">
              <img src="/logo-192.png" alt="شعار الشرطة البلدية" className="w-full h-full object-contain" />
            </div>

            <div className="text-left text-xs leading-relaxed font-mono">
              <p>تاريخ المعاينة:</p>
              <p className="font-bold">{formatArabicDate(violation.date)}</p>
              <p className="mt-1">رقم المحضر:</p>
              <p className="font-bold">{violation.reference}</p>
              <p className="mt-1">حالة التدقيق:</p>
              <p className="font-bold">{violation.reviewStatus === 'reviewed' ? 'معتمد ومصادق عليه' : 'قيد التدقيق'}</p>
            </div>
          </div>

          <h1 className="text-xl font-black mt-4 underline decoration-double">
            محضر معاينة مخالفة بلدية
          </h1>
          <p className="text-xs font-semibold">
            المرجع اللفظي: {violation.arabicReference}
          </p>
        </div>

        {/* Legal Statement */}
        <p className="text-xs leading-relaxed text-justify">
          نحن الممضين أسفله، أعوان إدارة الشرطة البلدية ببلدية <strong>{violation.municipalityName || settings.municipalityName}</strong>،
          المحلفين طبقاً للقانون، عاينّا في نطاق مهام المراقبة والتراتيب البلدية الوقائع التالية:
        </p>

        {/* Section 1: Violator */}
        <div className="border border-black p-3 space-y-1 text-xs">
          <h2 className="font-bold border-b border-black pb-1 mb-1">أولاً: هوية المخالف</h2>
          <div className="grid grid-cols-2 gap-2">
            <p><strong>الاسم واللقب:</strong> {violator ? `${violator.firstName} ${violator.lastName}` : 'مجهول'}</p>
            <p><strong>رقم بطاقة التعريف الوطنية:</strong> {violator?.nationalId || 'بدون'}</p>
            <p><strong>رقم الهاتف:</strong> {violator?.phone || 'غير متوفر'}</p>
            <p><strong>العنوان ومقر السكن:</strong> {violator?.address || 'غير محدد'}</p>
          </div>
        </div>

        {/* Section 2: Location */}
        <div className="border border-black p-3 space-y-1 text-xs">
          <h2 className="font-bold border-b border-black pb-1 mb-1">ثانياً: مكان المعاينة الميدانية</h2>
          <div className="grid grid-cols-2 gap-2">
            <p><strong>الولاية:</strong> {violation.governorate}</p>
            <p><strong>المعتمدية / البلدية:</strong> {violation.delegation}</p>
            <p><strong>المنطقة / الحي:</strong> {violation.area}</p>
            <p><strong>الشارع / النهج:</strong> {violation.street}</p>
            {hasCoordinates && (
              <p className="col-span-2 font-mono">
                <strong>إحداثيات GPS:</strong> خط عرض {violation.geo.lat} - خط طول {violation.geo.lng}
              </p>
            )}
          </div>
        </div>

        {/* Section 3: Violation Description */}
        <div className="border border-black p-3 space-y-2 text-xs">
          <h2 className="font-bold border-b border-black pb-1 mb-1">ثالثاً: وصف المخالفة والإجراء</h2>
          <div className="grid grid-cols-2 gap-2">
            <p><strong>صنف المخالفة:</strong> {violation.violationType}</p>
            <p><strong>نوع النشاط:</strong> {violation.activityType}</p>
            <p><strong>البضاعة المعروضة:</strong> {violation.goodsType}</p>
            <p><strong>الإجراء المتخذ:</strong> {violation.action}</p>
          </div>
          <div>
            <strong>الوصف التفصيلي:</strong>
            <p className="mt-1 p-2 bg-gray-50 border border-gray-200">{violation.description}</p>
          </div>
          {violation.hasVehicle && (
            <div className="pt-1 border-t border-dashed border-black">
              <strong>وسيلة النقل المستعملة:</strong> {violation.vehicleType} - لوحة منجمية: {violation.vehiclePlate || 'بدون'} - اللون: {violation.vehicleColor}
            </div>
          )}
        </div>

        {/* Section 4: Seizure (if any) */}
        {violation.seizure?.has && (
          <div className="border border-black p-3 space-y-1 text-xs">
            <h2 className="font-bold border-b border-black pb-1 mb-1">رابعاً: المحجوزات المودعة بالمستودع البلدي</h2>
            <div className="grid grid-cols-3 gap-2">
              <p><strong>المادة المحجوزة:</strong> {violation.seizure.itemType}</p>
              <p><strong>الكمية:</strong> {violation.seizure.quantity} {violation.seizure.unit}</p>
              <p><strong>مكان الإيداع:</strong> {violation.seizure.storage}</p>
            </div>
            {violation.seizure.notes && <p><strong>ملاحظات الحجز:</strong> {violation.seizure.notes}</p>}
          </div>
        )}

        {/* Official Signatures Box */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center">
          <div className="border border-black p-4 h-32 flex flex-col justify-between">
            <p className="font-bold">توقيع العون المعاين للمخالفة</p>
            <p className="text-[11px] text-gray-700">{violation.agentName}</p>
          </div>

          <div className="border border-black p-4 h-32 flex flex-col justify-between">
            <p className="font-bold">توقيع وختم رئيس مركز الشرطة البلدية</p>
            <p className="text-[11px] text-gray-700">بلدية {violation.municipalityName || settings.municipalityName}</p>
          </div>
        </div>

        <p className="text-[10px] text-center text-gray-500 pt-4">
          تم استخراج هذا التقرير آلياً عبر منظومة المعاينة الميدانية لإدارة الشرطة البلدية بالجمهورية التونسية
        </p>
      </div>

      {/* Full-screen Lightbox Modal */}
      {activeModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setActiveModalImage(null)}
        >
          <button
            type="button"
            onClick={() => setActiveModalImage(null)}
            className="absolute top-5 left-5 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 touch-target"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="max-w-2xl max-h-[85vh] w-full flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeModalImage}
              alt="معاينة الصورة"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
