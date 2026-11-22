import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getSettings,
  getViolators,
  getViolatorByNationalId,
  getViolatorById,
  saveViolator,
  createViolation,
} from '../lib/store';
import { PhotoUploader } from '../components/PhotoUploader';
import { LocationPicker } from '../components/LocationPicker';
import { ViolationPhotos, ViolationLocation, ViolationSeizure } from '../types';
import {
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Car,
  Package,
  FileCheck,
  Camera,
  Trash2,
  Save,
  Plus,
} from 'lucide-react';

export const AddViolation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedViolatorId = searchParams.get('violatorId');

  const settings = getSettings();

  // --- Violator Section State ---
  const [nationalIdSearch, setNationalIdSearch] = useState('');
  const [violatorFound, setViolatorFound] = useState<boolean | null>(null);
  const [violatorId, setViolatorId] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [violatorPhoto, setViolatorPhoto] = useState<string | undefined>(undefined);
  const violatorPhotoInputRef = useRef<HTMLInputElement>(null);

  // --- Location Section State ---
  const [location, setLocation] = useState<ViolationLocation>({
    governorate: 'سوسة',
    delegation: settings.municipalityName || 'سيدي بوعلي',
    area: 'وسط المدينة',
    street: '',
    geo: {
      lat: 35.9575,
      lng: 10.4722,
      address: `سيدي بوعلي، ولاية سوسة`,
    },
  });

  // --- Violation Details State ---
  const [violationType, setViolationType] = useState(settings.violationTypes[0] || 'انتصاب عشوائي');
  const [activityType, setActivityType] = useState('');
  const [goodsType, setGoodsType] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState(settings.actionTypes[0] || 'تنبيه شفوي');
  const [notes, setNotes] = useState('');

  // --- Vehicle State ---
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleType, setVehicleType] = useState('شاحنة خفيفة');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  // --- 5 Categorized Photos State ---
  const [photos, setPhotos] = useState<ViolationPhotos>({
    violation: [],
    goods: [],
    vehicle: [],
    documents: [],
    place: [],
  });

  // --- Seizure (الحجز) State ---
  const [hasSeizure, setHasSeizure] = useState(false);
  const [seizureItemType, setSeizureItemType] = useState('');
  const [seizureQuantity, setSeizureQuantity] = useState<number | ''>('');
  const [seizureUnit, setSeizureUnit] = useState<string>('كغ');
  const [seizureStorage, setSeizureStorage] = useState('المستودع البلدي');
  const [seizureNotes, setSeizureNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // If preselected violator from query param
  useEffect(() => {
    if (preselectedViolatorId) {
      const v = getViolatorById(preselectedViolatorId);
      if (v) {
        setViolatorId(v.id);
        setFirstName(v.firstName);
        setLastName(v.lastName);
        setNationalId(v.nationalId);
        setNationalIdSearch(v.nationalId);
        setPhone(v.phone);
        setAddress(v.address);
        setViolatorPhoto(v.photo);
        setViolatorFound(true);
      }
    }
  }, [preselectedViolatorId]);

  // Handle CIN lookup
  const handleCinLookup = () => {
    const clean = nationalIdSearch.trim();
    if (!clean) return;

    const existing = getViolatorByNationalId(clean);
    if (existing) {
      setViolatorId(existing.id);
      setFirstName(existing.firstName);
      setLastName(existing.lastName);
      setNationalId(existing.nationalId);
      setPhone(existing.phone);
      setAddress(existing.address);
      setViolatorPhoto(existing.photo);
      setViolatorFound(true);
    } else {
      setViolatorFound(false);
      setViolatorId('');
      setNationalId(clean);
      setFirstName('');
      setLastName('');
      setPhone('');
      setAddress('');
      setViolatorPhoto(undefined);
    }
  };

  const handleViolatorPhotoUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setViolatorPhoto(e.target?.result as string);
    };
    reader.readAsDataURL(files[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validations
    if (!firstName.trim() || !lastName.trim() || !nationalId.trim()) {
      setFormError('يرجى ملء بيانات المخالف (الاسم واللقب ورقم بطاقة التعريف الوطنية).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!location.governorate.trim() || !location.delegation.trim() || !location.street.trim()) {
      setFormError('يرجى تحديد مكان المخالفة (الولاية، المعتمدية والشارع / النهج).');
      return;
    }

    if (!description.trim()) {
      setFormError('يرجى إدخال وصف ملخص لوضعية المخالفة الميدانية.');
      return;
    }

    if (hasSeizure && (!seizureItemType.trim() || !seizureQuantity)) {
      setFormError('في حالة تفعيل الحجز، يجب تحديد نوع المحجوز والكمية بدقة.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Ensure violator is saved
      const savedViolator = saveViolator({
        id: violatorId || `violator-${Date.now()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim() || 'غير متوفر',
        address: address.trim() || `${location.street}، ${location.delegation}`,
        photo: violatorPhoto,
        createdAt: new Date().toISOString(),
      });

      // 2. Prepare seizure
      const seizureData: ViolationSeizure = {
        has: hasSeizure,
        itemType: hasSeizure ? seizureItemType.trim() : undefined,
        quantity: hasSeizure && seizureQuantity ? Number(seizureQuantity) : undefined,
        unit: hasSeizure ? seizureUnit : undefined,
        storage: hasSeizure ? seizureStorage.trim() : undefined,
        notes: hasSeizure ? seizureNotes.trim() : undefined,
      };

      // 3. Create violation record
      const created = createViolation({
        violatorId: savedViolator.id,
        agentUsername: user?.username || 'agent',
        agentName: user?.fullName || 'عون المعاينة',
        date: new Date().toISOString(),
        governorate: location.governorate.trim(),
        delegation: location.delegation.trim(),
        area: location.area.trim(),
        street: location.street.trim(),
        geo: location.geo,
        violationType,
        activityType: activityType.trim() || 'غير محدد',
        goodsType: goodsType.trim() || 'غير محدد',
        description: description.trim(),
        action,
        notes: notes.trim() || undefined,
        hasVehicle,
        vehicleType: hasVehicle ? vehicleType : undefined,
        vehiclePlate: hasVehicle ? vehiclePlate.trim() : undefined,
        vehicleColor: hasVehicle ? vehicleColor.trim() : undefined,
        photosByCategory: photos,
        seizure: seizureData,
      });

      // Navigate to the newly created violation details screen
      navigate(`/violations/${created.id}`);
    } catch (err: any) {
      console.error('Error creating violation:', err);
      setFormError('حدث خطأ أثناء حفظ المخالفة. يرجى المحاولة مجدداً.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 rounded-full bg-primary" />
          <h1 className="text-xl font-black text-slate-900">تسجيل مخالفة بلدية جديدة</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          إعداد محضر معاينة ميداني فوري مدعم بالصور والإحداثيات الجغرافية
        </p>
      </div>

      {formError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span className="font-semibold">{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* SECTION 1: VIOLATOR (المخالف) */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span>1. هوية المخالف</span>
            </h2>
            <span className="text-[11px] text-slate-400">تحقق فوري برقم ب.ت.و</span>
          </div>

          {/* National ID lookup bar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              البحث برقم بطاقة التعريف الوطنية (CIN)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={8}
                value={nationalIdSearch}
                onChange={(e) => setNationalIdSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCinLookup();
                  }
                }}
                placeholder="أدخل 8 أرقام للبحث التلقائي"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCinLookup}
                className="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-slate-900 active:scale-95 flex items-center gap-1.5 touch-target"
              >
                <Search className="w-4 h-4" />
                <span>تحقق</span>
              </button>
            </div>

            {/* Lookup result feedback */}
            {violatorFound === true && (
              <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>تم العثور على ملف المخالف مسجلاً مسبقاً، وتم استرجاع البيانات تلقائياً.</span>
              </div>
            )}
            {violatorFound === false && (
              <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>مخالف غير مسجل بعد. يرجى إدخال البيانات لإنشاء ملف جديد له في المنظومة.</span>
              </div>
            )}
          </div>

          {/* Inline Violator Details Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="الاسم الشخصي"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اللقب <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="اللقب العائلي"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم ب.ت.و (CIN) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="8 أرقام"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 98 123 456"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">العنوان الكامل للمخالف</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الشارع، الحي، المدينة"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Optional Violator Photo */}
            <div className="sm:col-span-2 pt-1">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                صورة المخالف الشخصية (اختيارية)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {violatorPhoto ? (
                    <img src={violatorPhoto} alt="صورة المخالف" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    ref={violatorPhotoInputRef}
                    onChange={(e) => handleViolatorPhotoUpload(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => violatorPhotoInputRef.current?.click()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 touch-target"
                  >
                    <Camera className="w-4 h-4 text-primary" />
                    <span>التقاط / رفع صورة</span>
                  </button>

                  {violatorPhoto && (
                    <button
                      type="button"
                      onClick={() => setViolatorPhoto(undefined)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl"
                      title="حذف الصورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: LOCATION & GPS (المكان) */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>2. مكان المعاينة الميدانية وإحداثيات GPS</span>
            </h2>
            <span className="text-[11px] text-slate-400">تحديد جغرافي دقيق</span>
          </div>

          <LocationPicker location={location} onChange={setLocation} />
        </section>

        {/* SECTION 3: VIOLATION DETAILS (تفاصيل المخالفة) */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>3. نوع المخالفة والإجراء القانوني</span>
            </h2>
            <span className="text-[11px] text-slate-400">تصنيف قانوني</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                صنف المخالفة <span className="text-red-500">*</span>
              </label>
              <select
                value={violationType}
                onChange={(e) => setViolationType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {settings.violationTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الإجراء المتخذ <span className="text-red-500">*</span>
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {settings.actionTypes.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع النشاط الممارس</label>
              <input
                type="text"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                placeholder="مثال: بيع خضر وغلال عشوائي / مقهى"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع البضاعة المعروضة</label>
              <input
                type="text"
                value={goodsType}
                onChange={(e) => setGoodsType(e.target.value)}
                placeholder="مثال: ملابس، أواني، كراسي، غلال"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الوصف الدقيق للوضعية الميدانية <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="صف حيثيات المخالفة، كيفية الانتصاب أو الإشغال، وتعطيل المرور أو الإخلال بالصحة..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات العون المحرر</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توجيهات، تنبيهات سابقة، ردة فعل المخالف..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* SECTION 4: VEHICLE (الوسيلة / السيارة) */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              <span>4. وسيلة النقل أو الشاحنة المستعملة</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">هل توجد وسيلة؟</span>
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
          </div>

          {hasVehicle && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الوسيلة</label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  placeholder="مثال: شاحنة إيسوزو / دراجة ثلاثية"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اللوحة المنجمية</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="مثال: 195 تونس 4321"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">لون الوسيلة</label>
                <input
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  placeholder="مثال: أبيض / أزرق"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>

        {/* SECTION 5: PHOTOS (الصور - 5 أصناف) */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm">
          <PhotoUploader photos={photos} onChange={setPhotos} />
        </section>

        {/* SECTION 6: SEIZURE (الحجز الفعلي) */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span>6. إجراءات الحجز الفعلي (إن وجد)</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">هل تم حجز بضائع؟</span>
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
          </div>

          {hasSeizure && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 animate-fadeIn">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع المادة أو البضاعة المحجوزة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required={hasSeizure}
                  value={seizureItemType}
                  onChange={(e) => setSeizureItemType(e.target.value)}
                  placeholder="مثال: صناديق تفاح، طاولات بلاستيك، كراسي"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الكمية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required={hasSeizure}
                    value={seizureQuantity}
                    onChange={(e) => setSeizureQuantity(e.target.value ? Number(e.target.value) : '')}
                    placeholder="العدد"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                  <select
                    value={seizureUnit}
                    onChange={(e) => setSeizureUnit(e.target.value)}
                    className="w-full px-2 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مكان الإيداع والحفظ (المستودع)
                </label>
                <input
                  type="text"
                  value={seizureStorage}
                  onChange={(e) => setSeizureStorage(e.target.value)}
                  placeholder="المستودع البلدي بسيدي بوعلي"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الحجز</label>
                <input
                  type="text"
                  value={seizureNotes}
                  onChange={(e) => setSeizureNotes(e.target.value)}
                  placeholder="رقم وصل الإيداع أو أسماء الأعوان المشرفين على الحجز..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>

        {/* Submit Actions */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-primary text-white rounded-2xl font-black text-base shadow-xl shadow-primary/30 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 touch-target"
          >
            {isSubmitting ? (
              <span>جاري الحفظ والتسجيل وتوليد المرجع...</span>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>حفظ وتوليد مرجع المخالفة الرسمي</span>
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-slate-400 mt-2">
            سيتم توليد المرجع الفني والرقم بالأحرف العربية تلقائياً وفقاً للتشريع التونسي
          </p>
        </div>
      </form>
    </div>
  );
};
