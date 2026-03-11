import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leaders from './pages/admin/Leaders';
import Schedules from './pages/admin/Schedules';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="admin" element={<Navigate to="/admin/schedules" replace />} />
          <Route path="admin/leaders" element={<Leaders />} />
          <Route path="admin/schedules" element={<Schedules />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
