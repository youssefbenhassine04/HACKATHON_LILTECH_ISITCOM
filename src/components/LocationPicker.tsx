import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ViolationLocation } from '../types';

interface LocationPickerProps {
  location: ViolationLocation;
  onChange: (loc: ViolationLocation) => void;
  readOnly?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  onChange,
  readOnly = false,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const captureGPS = () => {
    if (!navigator.geolocation) {
      alert('خدمة تحديد الموقع الجغرافي (GPS) غير مدعومة في هذا الجهاز أو المتصفح');
      return;
    }

    setIsLocating(true);
    setGpsStatus('جاري التقاط إحداثيات GPS بدقة...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));

        setGpsStatus('تم التقاط الإحداثيات بنجاح، جاري جلب العنوان...');

        let resolvedAddress = `${lat}, ${lng}`;
        let gov = location.governorate;
        let del = location.delegation;
        let street = location.street;
        let area = location.area;

        try {
          // OpenStreetMap Nominatim reverse geocoding
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
            { headers: { 'User-Agent': 'TunisianMunicipalPoliceFieldApp/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            resolvedAddress = data.display_name || resolvedAddress;
            const addr = data.address || {};

            if (addr.state || addr.province) {
              gov = addr.state || addr.province || gov;
            }
            if (addr.county || addr.town || addr.city) {
              del = addr.county || addr.town || addr.city || del;
            }
            if (addr.suburb || addr.quarter || addr.neighbourhood) {
              area = addr.suburb || addr.quarter || addr.neighbourhood || area;
            }
            if (addr.road) {
              street = addr.road || street;
            }
          }
        } catch (err) {
          console.warn('Reverse geocoding error:', err);
        }

        onChange({
          governorate: gov,
          delegation: del,
          area: area,
          street: street,
          geo: {
            lat,
            lng,
            address: resolvedAddress,
          },
        });

        setIsLocating(false);
        setGpsStatus('تم تحديد الموقع الجغرافي وتحديث الحقول بنجاح');
        setTimeout(() => setGpsStatus(null), 4000);
      },
      (err) => {
        setIsLocating(false);
        console.error('GPS error:', err);
        let msg = 'تعذر التقاط الموقع الجغرافي. يرجى تفعيل الـ GPS في الهاتف والسماح بالوصول.';
        if (err.code === 1) msg = 'تم رفض الإذن بالوصول إلى الموقع الجغرافي.';
        if (err.code === 2) msg = 'الموقع غير متاح حالياً (ضعف إشارة GPS).';
        if (err.code === 3) msg = 'انتهت مهلة طلب تحديد الموقع.';
        alert(msg);
        setGpsStatus(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const hasCoordinates = location.geo && location.geo.lat !== 0 && location.geo.lng !== 0;

  const openGoogleMaps = () => {
    if (!hasCoordinates) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${location.geo.lat},${location.geo.lng}`;
    window.open(url, '_blank');
  };

  const embedUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.geo.lng - 0.005}%2C${
        location.geo.lat - 0.003
      }%2C${location.geo.lng + 0.005}%2C${location.geo.lat + 0.003}&layer=mapnik&marker=${
        location.geo.lat
      }%2C${location.geo.lng}`
    : null;

  return (
    <div className="space-y-3">
      {/* Location fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            الولاية <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={location.governorate}
            onChange={(e) => onChange({ ...location, governorate: e.target.value })}
            placeholder="مثال: سوسة"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            المعتمدية / البلدية <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={location.delegation}
            onChange={(e) => onChange({ ...location, delegation: e.target.value })}
            placeholder="مثال: سيدي بوعلي"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            المنطقة / الحي / العمادة
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={location.area}
            onChange={(e) => onChange({ ...location, area: e.target.value })}
            placeholder="مثال: وسط المدينة / حي الزهور"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            الشارع / النهج ومعالم المكان <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={location.street}
            onChange={(e) => onChange({ ...location, street: e.target.value })}
            placeholder="مثال: شارع الحبيب بورقيبة أمام البريد"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            required
          />
        </div>
      </div>

      {/* GPS Capture & Map Controls */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">الإحداثيات الجغرافية (GPS)</span>
              {hasCoordinates ? (
                <span className="text-[11px] text-slate-600 font-mono">
                  {location.geo.lat.toFixed(5)}, {location.geo.lng.toFixed(5)}
                </span>
              ) : (
                <span className="text-[11px] text-amber-600">لم يتم التقاط الإحداثيات بعد</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={captureGPS}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50 touch-target"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحديد...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    <span>التقاط موقعي (GPS)</span>
                  </>
                )}
              </button>
            )}

            {hasCoordinates && (
              <button
                type="button"
                onClick={openGoogleMaps}
                className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-300 active:scale-95 touch-target"
                title="معاينة على خرائط Google"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>خرائط Google</span>
              </button>
            )}
          </div>
        </div>

        {gpsStatus && (
          <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span>{gpsStatus}</span>
          </div>
        )}

        {/* Embedded Map Viewer */}
        {hasCoordinates && embedUrl && (
          <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-100 mt-2 shadow-inner">
            <iframe
              title="موقع المخالفة الميدانية"
              src={embedUrl}
              className="w-full h-44 sm:h-52 border-0"
              loading="lazy"
            />
            <div className="p-2 bg-white/95 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span className="truncate max-w-[80%]">
                📍 {location.geo.address || `${location.street}، ${location.delegation}`}
              </span>
              <button
                type="button"
                onClick={openGoogleMaps}
                className="text-primary hover:underline font-bold flex items-center gap-1 flex-shrink-0"
              >
                <span>تكبير</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
