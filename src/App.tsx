import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CustomerDetail from './pages/CustomerDetail';
import { SyncProvider } from './contexts/SyncContext';

function App() {
  return (
    <SyncProvider>
      <Router>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customer/:id" element={<CustomerDetail />} />
            </Routes>
          </main>
        </div>
      </Router>
    </SyncProvider>
  );
}

export default App;
