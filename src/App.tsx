import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { AddViolation } from './pages/AddViolation';
import { ViolatorsList } from './pages/ViolatorsList';
import { ViolatorProfile } from './pages/ViolatorProfile';
import { ViolationsRegister } from './pages/ViolationsRegister';
import { ViolationDetails } from './pages/ViolationDetails';
import { EditViolation } from './pages/EditViolation';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes wrapped in main Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/violations/new" element={<AddViolation />} />
            <Route path="/violators" element={<ViolatorsList />} />
            <Route path="/violators/:id" element={<ViolatorProfile />} />
            <Route path="/violations" element={<ViolationsRegister />} />
            <Route path="/violations/:id" element={<ViolationDetails />} />

            {/* Edit requires chef or admin */}
            <Route
              path="/violations/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['chef', 'admin']}>
                  <EditViolation />
                </ProtectedRoute>
              }
            />

            <Route path="/reports" element={<Reports />} />

            {/* Settings requires admin (رئيس مركز) */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
