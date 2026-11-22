import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, FileText, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || location.pathname === '/login') {
    return null;
  }

  const navItems = [
    { to: '/', label: 'الرئيسية', icon: Home, exact: true },
    { to: '/search', label: 'بحث', icon: Search },
    { to: '/violations/new', label: 'إضافة مخالفة', icon: PlusCircle, isAction: true },
    { to: '/violations', label: 'السجل', icon: FileText },
    { to: '/violators', label: 'المخالفين', icon: Users },
  ];

  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
      <div className="max-w-md mx-auto px-2 py-1 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to) &&
              (item.to !== '/' || location.pathname === '/');

          if (item.isAction) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center -mt-5 group"
              >
                <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-slate-50 group-active:scale-95 transition-transform">
                  <Icon className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold text-primary mt-0.5">
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] rounded-xl transition-colors ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[11px] leading-tight">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
