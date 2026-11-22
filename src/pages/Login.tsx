import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings } from '../lib/store';
import { ShieldCheck, UserCheck, AlertTriangle, ArrowLeft, Lock, User as UserIcon } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = getSettings();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول، يرجى المحاولة مجدداً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary via-slate-900 to-slate-950 flex flex-col justify-center items-center px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200/50">
        {/* Emblem & Title */}
        <div className="text-center mb-6">
          <div className="inline-block relative mb-3">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-white p-1 border-2 border-primary/20 shadow-md overflow-hidden">
              <img src="/logo-192.png" alt="شعار الشرطة البلدية" className="w-full h-full object-contain" />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
              الجمهورية التونسية
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {settings.appName || 'الشرطة البلدية'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {settings.appSubtitle || `منظومة معاينة وتسجيل المخالفات - بلدية ${settings.municipalityName}`}
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>تسجيل الدخول الميداني المعتمد</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-shake">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم المستخدم (المعرف المهني)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full pr-10 pl-3 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full pr-10 pl-3 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 touch-target"
          >
            {isLoading ? (
              <span>جاري التحقق...</span>
            ) : (
              <>
                <span>دخول إلى المنظومة</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Fill Section */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              حسابات تجريبية للاختبار السريع:
            </span>
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('agent', 'agent')}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-center transition-all border border-slate-200/80"
            >
              <span className="block text-xs font-bold text-slate-800">عون</span>
              <span className="block text-[10px] text-slate-500">agent</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('chef', 'chef')}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-center transition-all border border-slate-200/80"
            >
              <span className="block text-xs font-bold text-slate-800">رئيس فرقة</span>
              <span className="block text-[10px] text-slate-500">chef</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('admin', 'admin')}
              className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 active:scale-95 text-center transition-all border border-primary/20"
            >
              <span className="block text-xs font-bold text-primary">رئيس مركز</span>
              <span className="block text-[10px] text-primary/80">admin</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-slate-400 text-[11px] mt-6">
        الجمهورية التونسية • وزارة الداخلية • بلدية {settings.municipalityName}
      </p>
    </div>
  );
};
