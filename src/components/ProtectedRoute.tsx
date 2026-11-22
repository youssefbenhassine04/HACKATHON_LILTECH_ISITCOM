import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">غير مصرح بالدخول</h2>
        <p className="text-slate-600 max-w-sm mb-6 text-sm">
          هذه الصفحة مخصصة فقط لرتبة{' '}
          {allowedRoles.map((r) => (r === 'admin' ? 'رئيس مركز' : 'رئيس فرقة')).join(' أو ')}.
          رتبتك الحالية: {user.role === 'agent' ? 'عون' : user.role === 'chef' ? 'رئيس فرقة' : 'رئيس مركز'}.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold shadow hover:opacity-90"
        >
          العودة للصفحة السابقة
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
