import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import CustomerDetail from './pages/CustomerDetail';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/customer/:id" element={<CustomerDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
