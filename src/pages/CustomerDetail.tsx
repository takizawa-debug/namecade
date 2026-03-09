import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Save, MapPin, Phone, Mail, Building, Briefcase, Calendar } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import './CustomerDetail.css';

const MOCK_CUSTOMER = {
    id: 0,
    name: '',
    company: '',
    role: '',
    email: '',
    phone: '',
    address: '',
    segment: '',
    addedAt: new Date().toISOString(),
    memo: ''
};

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [customer, setCustomer] = useState<any>(MOCK_CUSTOMER);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/customers/${id}`)
            .then(res => res.json())
            .then(data => {
                setCustomer(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load detail', err);
                setLoading(false);
            });
    }, [id]);

    const handleSave = async () => {
        try {
            await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer)
            });
            setIsEditing(false);
        } catch (e) {
            console.error('Save failed', e);
        }
    };

    const handleBack = () => {
        navigate('/dashboard');
    };

    if (loading) return <div className="customer-detail-page text-center"><p>読み込み中...</p></div>;

    return (
        <div className="customer-detail-page animate-fade-in">
            <header className="page-header sticky-header">
                <div className="header-actions">
                    <button className="btn-secondary btn-icon" onClick={handleBack}>
                        <ArrowLeft size={18} /> 戻る
                    </button>
                    <div className="header-titles">
                        <h2>顧客詳細</h2>
                    </div>
                </div>
                <div>
                    {isEditing ? (
                        <button className="btn-primary" onClick={handleSave}>
                            <Save size={18} /> 変更を保存
                        </button>
                    ) : (
                        <button className="btn-secondary" onClick={() => setIsEditing(true)}>
                            <Edit2 size={18} /> 情報を編集
                        </button>
                    )}
                </div>
            </header>

            <div className="profile-layout">
                <div className="card profile-sidebar">
                    <div className="profile-avatar-large">
                        {customer.name.charAt(0)}
                    </div>

                    <div className="profile-main-info">
                        {isEditing ? (
                            <input
                                type="text"
                                className="input-field text-center font-bold"
                                value={customer.name}
                                onChange={e => setCustomer({ ...customer, name: e.target.value })}
                            />
                        ) : (
                            <h3>{customer.name}</h3>
                        )}

                        <p className="profile-subtitle">{customer.role} at {customer.company}</p>
                        <span className="badge mt-2">{customer.segment}</span>
                    </div>

                    <div className="profile-quick-actions">
                        <a href={`mailto:${customer.email}`} className="action-btn">
                            <Mail size={16} /> メール
                        </a>
                        <a href={`tel:${customer.phone}`} className="action-btn">
                            <Phone size={16} /> 電話
                        </a>
                    </div>
                </div>

                <div className="profile-content">
                    <div className="card info-section">
                        <h4 className="section-title">連絡先情報</h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label"><Building size={16} /> 会社名</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.company} onChange={e => setCustomer({ ...customer, company: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.company}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Briefcase size={16} /> 役職</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.role} onChange={e => setCustomer({ ...customer, role: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.role}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Mail size={16} /> メールアドレス</span>
                                {isEditing ? (
                                    <input type="email" className="input-field" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.email}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Phone size={16} /> 電話番号</span>
                                {isEditing ? (
                                    <input type="tel" className="input-field" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.phone}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label"><MapPin size={16} /> 住所</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.address}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card info-section">
                        <h4 className="section-title">追加情報</h4>

                        <div className="info-grid single-col">
                            <div className="info-item">
                                <span className="info-label">事業セグメント</span>
                                {isEditing ? (
                                    <select className="input-field" value={customer.segment} onChange={e => setCustomer({ ...customer, segment: e.target.value })}>
                                        <option value="大企業">大企業</option>
                                        <option value="中小企業">中小企業</option>
                                        <option value="代理店">代理店</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{customer.segment}</span>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label">メモ・特記事項</span>
                                {isEditing ? (
                                    <textarea
                                        className="input-field"
                                        rows={4}
                                        value={customer.memo}
                                        onChange={e => setCustomer({ ...customer, memo: e.target.value })}
                                    />
                                ) : (
                                    <p className="info-value memo-text">{customer.memo}</p>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label"><Calendar size={16} /> 登録日</span>
                                <span className="info-value text-muted">{new Date(customer.addedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetail;
