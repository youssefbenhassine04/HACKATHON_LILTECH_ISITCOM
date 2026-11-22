import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 pt-3 pb-24 sm:pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
