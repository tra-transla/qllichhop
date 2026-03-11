import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leaders from './pages/admin/Leaders';
import Schedules from './pages/admin/Schedules';
import Users from './pages/admin/Users';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route element={<ProtectedRoute />}>
              <Route path="admin" element={<Navigate to="/admin/schedules" replace />} />
              <Route path="admin/leaders" element={<Leaders />} />
              <Route path="admin/schedules" element={<Schedules />} />
              <Route path="admin/users" element={<Users />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
