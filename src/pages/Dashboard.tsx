import React, { useState } from 'react';
import { Search, Filter, Edit, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

// Mock Data
const MOCK_CUSTOMERS = [
    { id: 1, name: 'Taro Yamada', company: 'Tech Corp', role: 'CTO', email: 'taro@example.com', segment: 'Enterprise', addedAt: '2026-03-01' },
    { id: 2, name: 'Hanako Suzuki', company: 'Design Studio', role: 'Art Director', email: 'hanako@example.com', segment: 'Agency', addedAt: '2026-03-05' },
    { id: 3, name: 'Kenji Sato', company: 'Sato Logistics', role: 'Manager', email: 'kenji@example.com', segment: 'SMB', addedAt: '2026-03-08' },
];

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="dashboard-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h2>Customer Directory</h2>
                    <p className="subtitle">Manage and organize your business cards</p>
                </div>
                <button className="btn-primary" onClick={() => navigate('/scanner')}>
                    + Add New Card
                </button>
            </header>

            <div className="card dashboard-toolbar">
                <div className="search-bar">
                    <Search size={20} className="icon-muted" />
                    <input
                        type="text"
                        placeholder="Search by name, company, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="btn-secondary">
                    <Filter size={18} />
                    Filter
                </button>
            </div>

            <div className="card table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Contact Name</th>
                            <th>Company & Role</th>
                            <th>Segment</th>
                            <th>Date Added</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_CUSTOMERS.map(customer => (
                            <tr key={customer.id} onClick={() => navigate(`/customer/${customer.id}`)} className="clickable-row">
                                <td>
                                    <div className="contact-info">
                                        <div className="avatar">{customer.name.charAt(0)}</div>
                                        <div>
                                            <div className="font-medium">{customer.name}</div>
                                            <div className="text-small text-muted">{customer.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className="font-medium">{customer.company}</div>
                                    <div className="text-small text-muted">{customer.role}</div>
                                </td>
                                <td>
                                    <span className="badge">{customer.segment}</span>
                                </td>
                                <td>{new Date(customer.addedAt).toLocaleDateString()}</td>
                                <td>
                                    <div className="row-actions" onClick={e => e.stopPropagation()}>
                                        <button className="icon-btn"><Edit size={16} /></button>
                                        <button className="icon-btn danger"><Trash size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
