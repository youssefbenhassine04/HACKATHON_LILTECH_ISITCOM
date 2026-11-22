import React, { useState } from 'react';
import { apiChangePassword } from '../lib/api';
import { KeyRound, X, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ChangePasswordModalProps {
  onClose: () => void;
}

/** Self-service password change; the server enforces policy and revokes other sessions. */
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z\u0600-\u06FF]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل وتجمع بين الحروف والأرقام');
      return;
    }

    setIsSaving(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 no-print" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 border border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">تغيير كلمة المرور</h2>
              <p className="text-[11px] text-slate-500">سيتم إنهاء الجلسات على الأجهزة الأخرى</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold">تم تغيير كلمة المرور بنجاح</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور الحالية</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 rounded-xl px-2.5 py-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>8 أحرف على الأقل، مع حروف وأرقام. تُخزَّن كلمة المرور مجزّأة بـ bcrypt.</span>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {isSaving ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
