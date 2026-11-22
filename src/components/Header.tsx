import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings, subscribeToStore } from '../lib/store';
import { ArrowRight, Shield, LogOut, Settings as SettingsIcon } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [settings, setSettings] = useState(getSettings());

  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setSettings(getSettings());
    });
    return unsub;
  }, []);

  const isHome = location.pathname === '/';
  const isLogin = location.pathname === '/login';

  if (isLogin) return null;

  return (
    <header className="no-print sticky top-0 z-40 bg-primary text-white shadow-md border-b border-primary-light safe-top">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -mr-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white touch-target flex items-center justify-center"
              title="رجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer active:opacity-90"
          >
            <div className="w-9 h-9 rounded-lg bg-white/10 p-1 flex items-center justify-center border border-white/20 shadow-inner">
              <img src="/badge.svg" alt="شعار الشرطة البلدية" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-wide leading-tight">
                  {settings.appName || 'الشرطة البلدية'}
                </span>
                <span className="text-[10px] bg-red-600/80 text-white px-1.5 py-0.2 rounded font-semibold">
                  تونس
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium leading-none mt-0.5">
                بلدية {settings.municipalityName}
              </div>
            </div>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-1.5">
            {user.role === 'admin' && (
              <button
                onClick={() => navigate('/settings')}
                className={`p-2 rounded-xl transition-all touch-target flex items-center justify-center ${
                  location.pathname === '/settings'
                    ? 'bg-white text-primary shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="الإعدادات"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => {
                if (window.confirm('هل تريد فعلاً تسجيل الخروج من التطبيق؟')) {
                  logout();
                  navigate('/login');
                }
              }}
              className="p-2 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30 hover:text-white transition-all touch-target flex items-center justify-center"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
