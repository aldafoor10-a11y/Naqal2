import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PricingReview from './pages/PricingReview';
import PricingSettings from './pages/PricingSettings';
import Dispatch from './pages/Dispatch';
import Drivers from './pages/Drivers';
import Orders from './pages/Orders';
import SupportInbox from './pages/SupportInbox';
import TicketChat from './pages/TicketChat';
import { getToken } from './api';

function Private({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dispatch" element={<Dispatch />} />
        <Route path="pricing" element={<PricingReview />} />
        <Route path="pricing-settings" element={<PricingSettings />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="orders" element={<Orders />} />
        <Route path="support" element={<SupportInbox />} />
        <Route path="support/:id" element={<TicketChat />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
