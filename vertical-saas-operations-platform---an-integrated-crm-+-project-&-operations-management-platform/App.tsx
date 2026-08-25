import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CustomerCRM } from './components/CustomerCRM';
import { QuoteNexus } from './components/QuoteNexus';
import { ProjectNexus } from './components/ProjectNexus';
import { DailyChecklist } from './components/DailyChecklist';
import { DeliveryBoard } from './components/DeliveryBoard';
import { PurchasingBoard } from './components/PurchasingBoard';
import { QuoteIntakeDock } from './components/QuoteIntakeDock';
import { ForgeStoreProvider } from './store';

const App: React.FC = () => {
  return (
    <ForgeStoreProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/crm" element={<CustomerCRM />} />
            <Route path="/quotes" element={<QuoteNexus />} />
            <Route path="/projects" element={<ProjectNexus />} />
            <Route path="/purchasing" element={<PurchasingBoard />} />
            <Route path="/deliveries" element={<DeliveryBoard />} />
            <Route path="/checklist" element={<DailyChecklist />} />
          </Routes>
        </Layout>
        <QuoteIntakeDock />
      </HashRouter>
    </ForgeStoreProvider>
  );
};

export default App;
