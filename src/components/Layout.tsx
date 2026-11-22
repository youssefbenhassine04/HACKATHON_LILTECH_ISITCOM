import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { getSyncError, subscribeToStore } from '../lib/store';

/** Surfaces failed writes so data never silently diverges from the server. */
const SyncBanner: React.FC = () => {
  const [error, setError] = useState<string | null>(getSyncError());

  useEffect(() => subscribeToStore(() => setError(getSyncError())), []);

  if (!error) return null;

  return (
    <div className="max-w-3xl w-full mx-auto px-3 sm:px-4 pt-2 no-print">
      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span className="font-semibold">تعذرت مزامنة التغيير مع الخادم: {error}. سيُعاد تحميل البيانات عند استقرار الاتصال.</span>
      </div>
    </div>
  );
};

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      <Header />
      <SyncBanner />
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 pt-3 pb-24 sm:pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
