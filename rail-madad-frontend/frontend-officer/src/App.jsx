import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Layout from './pages/Layout';
import Overview from './pages/Overview';
import ReviewQueue from './pages/ReviewQueue';
import Flagged from './pages/Flagged';
import Clusters from './pages/Clusters';
import MultiDept from './pages/MultiDept';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Trains from './pages/Trains';
import StaffApproval from './pages/StaffApproval';
import Hotspots from './pages/Hotspots';

const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined;

export default function App() {
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="review" element={<ReviewQueue />} />
          <Route path="flagged" element={<Flagged />} />
          <Route path="clusters" element={<Clusters />} />
          <Route path="multi-department" element={<MultiDept />} />
          <Route path="staff-approval" element={<StaffApproval />} />
          <Route path="hotspots" element={<Hotspots />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="trains" element={<Trains />} />
        </Route>
      </Routes>
    </Router>
  );
}
