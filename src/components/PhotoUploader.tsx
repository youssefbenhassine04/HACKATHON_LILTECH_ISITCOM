import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, ZoomIn, X, Plus } from 'lucide-react';
import { PhotoCategory, ViolationPhotos } from '../types';

interface PhotoUploaderProps {
  photos: ViolationPhotos;
  onChange: (photos: ViolationPhotos) => void;
  readOnly?: boolean;
}

const CATEGORIES: { key: PhotoCategory; title: string; desc: string; icon: string }[] = [
  { key: 'violation', title: 'صور المخالفة', desc: 'معاينة وضعية المخالفة الميدانية', icon: '🚨' },
  { key: 'goods', title: 'صور البضاعة', desc: 'البضائع المعروضة أو المحجوزة', icon: '📦' },
  { key: 'vehicle', title: 'صور السيارة / الوسيلة', desc: 'الشاحنة أو العربة واللوحة المنجمية', icon: '🚚' },
  { key: 'documents', title: 'صور الوثائق', desc: 'بطاقة التعريف، التنبيهات، الرخص والمحاضر', icon: '📄' },
  { key: 'place', title: 'صور مكان الانتصاب', desc: 'الرصيف، الشارع العام، معالم المكان', icon: '📍' },
];

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ photos, onChange, readOnly = false }) => {
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PhotoCategory>('violation');

  const cameraInputRefs = {
    violation: useRef<HTMLInputElement>(null),
    goods: useRef<HTMLInputElement>(null),
    vehicle: useRef<HTMLInputElement>(null),
    documents: useRef<HTMLInputElement>(null),
    place: useRef<HTMLInputElement>(null),
  };

  const galleryInputRefs = {
    violation: useRef<HTMLInputElement>(null),
    goods: useRef<HTMLInputElement>(null),
    vehicle: useRef<HTMLInputElement>(null),
    documents: useRef<HTMLInputElement>(null),
    place: useRef<HTMLInputElement>(null),
  };

  const handleFiles = (category: PhotoCategory, files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          onChange({
            ...photos,
            [category]: [...(photos[category] || []), dataUrl],
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (category: PhotoCategory, index: number) => {
    const list = [...(photos[category] || [])];
    list.splice(index, 1);
    onChange({
      ...photos,
      [category]: list,
    });
  };

  const totalPhotosCount = Object.values(photos).reduce(
    (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-slate-800">
          الصور والمرفقات الميدانية ({totalPhotosCount} صور)
        </label>
        <span className="text-xs text-slate-500 font-medium">مقسمة حسب 5 أصناف قانونية</span>
      </div>

      {/* Tabs on mobile */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const count = photos[cat.key]?.length || 0;
          const isSelected = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all touch-target ${
                isSelected
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.title}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-white text-primary' : 'bg-primary text-white'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Category Panel */}
      {CATEGORIES.map((cat) => {
        if (cat.key !== activeCategory) return null;
        const currentList = photos[cat.key] || [];

        return (
          <div key={cat.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>{cat.icon}</span> {cat.title}
                </h4>
                <p className="text-[11px] text-slate-500">{cat.desc}</p>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2">
                  {/* Camera input with capture="environment" for phone camera */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRefs[cat.key]}
                    onChange={(e) => handleFiles(cat.key, e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRefs[cat.key].current?.click()}
                    className="flex items-center gap-1 px-3 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 active:scale-95 touch-target"
                  >
                    <Camera className="w-4 h-4" />
                    <span>الكاميرا</span>
                  </button>

                  {/* Gallery input */}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={galleryInputRefs[cat.key]}
                    onChange={(e) => handleFiles(cat.key, e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => galleryInputRefs[cat.key].current?.click()}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-300 active:scale-95 touch-target"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>المعرض</span>
                  </button>
                </div>
              )}
            </div>

            {/* Photo thumbnails grid */}
            {currentList.length === 0 ? (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400">
                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">لا توجد صور مضافة في هذا الصنف</p>
                {!readOnly && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    اضغط على "الكاميرا" لالتقاط صورة فورية أو "المعرض" للاختيار
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {currentList.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shadow-sm"
                  >
                    <img
                      src={imgUrl}
                      alt={`${cat.title} ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setActiveModalImage(imgUrl)}
                    />

                    {/* Preview button */}
                    <button
                      type="button"
                      onClick={() => setActiveModalImage(imgUrl)}
                      className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    >
                      <ZoomIn className="w-6 h-6 drop-shadow" />
                    </button>

                    {/* Delete button */}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removePhoto(cat.key, idx)}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700 active:scale-90"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Full-screen Image Preview Lightbox */}
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
          <span className="text-white text-xs mt-2 bg-black/50 px-3 py-1 rounded-full">
            اضغط في أي مكان للإغلاق
          </span>
        </div>
      )}
    </div>
  );
};
