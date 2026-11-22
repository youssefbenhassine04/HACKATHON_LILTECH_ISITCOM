import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getViolationById, getViolatorById, getSettings, updateViolation } from '../lib/store';
import { PhotoUploader } from '../components/PhotoUploader';
import { LocationPicker } from '../components/LocationPicker';
import { ViolationPhotos, ViolationLocation, ViolationSeizure } from '../types';
import {
  Edit,
  Save,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Car,
  Package,
  FileCheck,
  MapPin,
  History,
} from 'lucide-react';

export const EditViolation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = getSettings();

  const [editReason, setEditReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editable fields state
  const [location, setLocation] = useState<ViolationLocation>({
    governorate: '',
    delegation: '',
    area: '',
    street: '',
    geo: { lat: 0, lng: 0 },
  });

  const [violationType, setViolationType] = useState('');
  const [activityType, setActivityType] = useState('');
  const [goodsType, setGoodsType] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');

  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  const [photos, setPhotos] = useState<ViolationPhotos>({
    violation: [],
    goods: [],
    vehicle: [],
    documents: [],
    place: [],
  });

  const [hasSeizure, setHasSeizure] = useState(false);
  const [seizureItemType, setSeizureItemType] = useState('');
  const [seizureQuantity, setSeizureQuantity] = useState<number | ''>('');
  const [seizureUnit, setSeizureUnit] = useState<string>('كغ');
  const [seizureStorage, setSeizureStorage] = useState('');
  const [seizureNotes, setSeizureNotes] = useState('');

  if (!id) return null;

  const existing = getViolationById(id);
  const violator = existing ? getViolatorById(existing.violatorId) : null;

  useEffect(() => {
    if (existing) {
      setLocation({
        governorate: existing.governorate,
        delegation: existing.delegation,
        area: existing.area,
        street: existing.street,
        geo: existing.geo || { lat: 0, lng: 0 },
      });
      setViolationType(existing.violationType);
      setActivityType(existing.activityType || '');
      setGoodsType(existing.goodsType || '');
      setDescription(existing.description || '');
      setAction(existing.action || '');
      setNotes(existing.notes || '');

      setHasVehicle(existing.hasVehicle || false);
      setVehicleType(existing.vehicleType || '');
      setVehiclePlate(existing.vehiclePlate || '');
      setVehicleColor(existing.vehicleColor || '');

      setPhotos(
        existing.photosByCategory || {
          violation: [],
          goods: [],
          vehicle: [],
          documents: [],
          place: [],
        }
      );

      setHasSeizure(existing.seizure?.has || false);
      setSeizureItemType(existing.seizure?.itemType || '');
      setSeizureQuantity(existing.seizure?.quantity || '');
      setSeizureUnit(existing.seizure?.unit || 'كغ');
      setSeizureStorage(existing.seizure?.storage || '');
      setSeizureNotes(existing.seizure?.notes || '');
    }
  }, [existing]);

  // Role Guard: Only chef or admin can access
  if (user?.role !== 'chef' && user?.role !== 'admin') {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-800">صلاحية غير كافية</h2>
        <p className="text-xs text-slate-600">
          تعديل المحاضر متاح فقط لرتبتي "رئيس فرقة" و "رئيس مركز".
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
        >
          رجوع
        </button>
      </div>
    );
  }

  if (!existing) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
        المحضر غير موجود
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Hard requirement: Mandatory edit reason!
    if (!editReason.trim()) {
      setError('يرجى تحديد سبب التعديل بدقة (مطلوب قانونياً لإدراجه في سجل التعديلات).');
      return;
    }

    if (!description.trim()) {
      setError('لا يمكن ترك وصف المخالفة فارغاً.');
      return;
    }

    setIsSubmitting(true);

    try {
      const seizureData: ViolationSeizure = {
        has: hasSeizure,
        itemType: hasSeizure ? seizureItemType.trim() : undefined,
        quantity: hasSeizure && seizureQuantity ? Number(seizureQuantity) : undefined,
        unit: hasSeizure ? seizureUnit : undefined,
        storage: hasSeizure ? seizureStorage.trim() : undefined,
        notes: hasSeizure ? seizureNotes.trim() : undefined,
      };

      updateViolation(
        existing.id,
        {
          governorate: location.governorate.trim(),
          delegation: location.delegation.trim(),
          area: location.area.trim(),
          street: location.street.trim(),
          geo: location.geo,
          violationType,
          activityType: activityType.trim(),
          goodsType: goodsType.trim(),
          description: description.trim(),
          action,
          notes: notes.trim(),
          hasVehicle,
          vehicleType: hasVehicle ? vehicleType.trim() : undefined,
          vehiclePlate: hasVehicle ? vehiclePlate.trim() : undefined,
          vehicleColor: hasVehicle ? vehicleColor.trim() : undefined,
          photosByCategory: photos,
          seizure: seizureData,
        },
        editReason.trim(),
        user
      );

      navigate(`/violations/${existing.id}`);
    } catch (err: any) {
      console.error('Error updating violation:', err);
      setError('حدث خطأ أثناء حفظ التعديل.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Edit className="w-5 h-5 text-amber-500" />
            <span>تعديل محضر المخالفة</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            المحضر رقم: <strong className="font-mono text-primary">{existing.reference}</strong>
          </p>
        </div>

        <button
          onClick={() => navigate(`/violations/${existing.id}`)}
          className="p-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300"
          title="إلغاء والعودة"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-shake">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Mandatory Reason Box */}
        <section className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2">
          <label className="block text-xs font-black text-amber-900 flex items-center gap-1.5">
            <History className="w-4 h-4 text-amber-700" />
            <span>سبب التعديل القانوني (إلزامي) <span className="text-red-600">*</span></span>
          </label>
          <textarea
            required
            rows={2}
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="مثال: تصحيح رقم اللوحة المنجمية بناءً على المعاينة الميدانية المدققة..."
            className="w-full px-3 py-2.5 rounded-xl border border-amber-300 bg-white text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          <p className="text-[10px] text-amber-800">
            سيتم تدوين هذا السبب مع اسمك ورتبتك وتاريخ التعديل في سجل التعديلات غير القابل للحذف.
          </p>
        </section>

        {/* Violator identity info (read-only here) */}
        {violator && (
          <div className="bg-slate-100/80 rounded-2xl p-3 text-xs flex items-center justify-between text-slate-700">
            <span>المخالف: <strong>{violator.firstName} {violator.lastName}</strong></span>
            <span className="font-mono">ب.ت.و: {violator.nationalId}</span>
          </div>
        )}

        {/* Location Section */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span>مكان المعاينة الميدانية</span>
          </h2>
          <LocationPicker location={location} onChange={setLocation} />
        </section>

        {/* Violation Details Section */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <span>بيانات وتصنيف المخالفة</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">صنف المخالفة</label>
              <select
                value={violationType}
                onChange={(e) => setViolationType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
              >
                {settings.violationTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الإجراء المتخذ</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
              >
                {settings.actionTypes.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع النشاط</label>
              <input
                type="text"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البضاعة المعروضة</label>
              <input
                type="text"
                value={goodsType}
                onChange={(e) => setGoodsType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">وصف المخالفة</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Vehicle Section */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              <span>وسيلة النقل</span>
            </h2>
            <button
              type="button"
              onClick={() => setHasVehicle(!hasVehicle)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                hasVehicle ? 'bg-primary' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  hasVehicle ? 'right-6' : 'right-0.5'
                }`}
              />
            </button>
          </div>

          {hasVehicle && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الوسيلة</label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اللوحة المنجمية</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اللون</label>
                <input
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>

        {/* Photos Section */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm">
          <PhotoUploader photos={photos} onChange={setPhotos} />
        </section>

        {/* Seizure Section */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span>الحجز الفعلي</span>
            </h2>
            <button
              type="button"
              onClick={() => setHasSeizure(!hasSeizure)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                hasSeizure ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  hasSeizure ? 'right-6' : 'right-0.5'
                }`}
              />
            </button>
          </div>

          {hasSeizure && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع المادة المحجوزة</label>
                <input
                  type="text"
                  value={seizureItemType}
                  onChange={(e) => setSeizureItemType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية</label>
                  <input
                    type="number"
                    value={seizureQuantity}
                    onChange={(e) => setSeizureQuantity(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                  <select
                    value={seizureUnit}
                    onChange={(e) => setSeizureUnit(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none"
                  >
                    <option value="كغ">كغ</option>
                    <option value="لتر">لتر</option>
                    <option value="قطعة">قطعة</option>
                    <option value="صندوق">صندوق</option>
                    <option value="كيس">كيس</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">مكان الإيداع</label>
                <input
                  type="text"
                  value={seizureStorage}
                  onChange={(e) => setSeizureStorage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 touch-target"
          >
            <Save className="w-5 h-5" />
            <span>حفظ التعديلات وتحديث سجل التدقيق</span>
          </button>
        </div>
      </form>
    </div>
  );
};
