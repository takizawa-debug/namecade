import { useState, useEffect } from 'react';
import { Search, Filter, Edit, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

// Mock Data
const MOCK_CUSTOMERS = [
    { id: 1, name: '山田 太郎', company: 'テック株式会社', role: 'CTO', email: 'taro@example.com', segment: '大企業', addedAt: '2026-03-01' },
];

const Dashboard = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/customers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setCustomers(data);
                } else {
                    setCustomers(data || []);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch customers, using mock data:', err);
                setCustomers(MOCK_CUSTOMERS);
                setLoading(false);
            });
    }, []);

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="dashboard-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h2>顧客一覧</h2>
                    <p className="subtitle">名刺と顧客情報を管理・整理します</p>
                </div>
                <button className="btn-primary" onClick={() => navigate('/scanner')}>
                    + 名刺を追加
                </button>
            </header>

            <div className="card dashboard-toolbar">
                <div className="search-bar">
                    <Search size={20} className="icon-muted" />
                    <input
                        type="text"
                        placeholder="名前、会社、メールアドレスで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="btn-secondary">
                    <Filter size={18} />
                    フィルター
                </button>
            </div>

            <div className="card table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>連絡先名</th>
                            <th>会社名 & 役職</th>
                            <th>セグメント</th>
                            <th>追加日</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center' }}>読み込み中...</td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center' }}>データが見つかりません。</td></tr>
                        ) : (
                            filteredCustomers.map((customer: any) => (
                                <tr key={customer.id} onClick={() => navigate(`/customer/${customer.id}`)} className="clickable-row">
                                    <td>
                                        <div className="contact-info">
                                            <div className="avatar">{(customer.name || 'U').charAt(0)}</div>
                                            <div>
                                                <div className="font-medium">{customer.name || '不明'}</div>
                                                <div className="text-small text-muted">{customer.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="font-medium">{customer.company}</div>
                                        <div className="text-small text-muted">{customer.role}</div>
                                    </td>
                                    <td>
                                        <span className="badge">{customer.segment || '未設定'}</span>
                                    </td>
                                    <td>{new Date(customer.addedAt || customer.added_at || Date.now()).toLocaleDateString()}</td>
                                    <td>
                                        <div className="row-actions" onClick={e => e.stopPropagation()}>
                                            <button className="icon-btn"><Edit size={16} /></button>
                                            <button className="icon-btn danger"><Trash size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
