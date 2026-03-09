import { useState } from 'react';
import { ArrowLeft, Edit2, Save, MapPin, Phone, Mail, Building, Briefcase, Calendar } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import './CustomerDetail.css';

const MOCK_CUSTOMER = {
    id: 1,
    name: 'Taro Yamada',
    company: 'Tech Corp',
    role: 'CTO',
    email: 'taro@example.com',
    phone: '090-9876-5432',
    address: '1-1-1 Marunouchi, Chiyoda-ku, Tokyo',
    segment: 'Enterprise',
    addedAt: '2026-03-01',
    memo: 'Met at the Q1 tech conference. Very interested in our AI solutions. Follow up next month.'
};

const CustomerDetail = () => {
    useParams();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [customer, setCustomer] = useState(MOCK_CUSTOMER);

    const handleSave = () => {
        setIsEditing(false);
        // Add real API save logic here later
    };

    const handleBack = () => {
        navigate('/dashboard');
    };

    return (
        <div className="customer-detail-page animate-fade-in">
            <header className="page-header sticky-header">
                <div className="header-actions">
                    <button className="btn-secondary btn-icon" onClick={handleBack}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div className="header-titles">
                        <h2>Customer Details</h2>
                    </div>
                </div>
                <div>
                    {isEditing ? (
                        <button className="btn-primary" onClick={handleSave}>
                            <Save size={18} /> Save Changes
                        </button>
                    ) : (
                        <button className="btn-secondary" onClick={() => setIsEditing(true)}>
                            <Edit2 size={18} /> Edit Info
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
                            <Mail size={16} /> Email
                        </a>
                        <a href={`tel:${customer.phone}`} className="action-btn">
                            <Phone size={16} /> Call
                        </a>
                    </div>
                </div>

                <div className="profile-content">
                    <div className="card info-section">
                        <h4 className="section-title">Contact Information</h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label"><Building size={16} /> Company</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.company} onChange={e => setCustomer({ ...customer, company: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.company}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Briefcase size={16} /> Role</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.role} onChange={e => setCustomer({ ...customer, role: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.role}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Mail size={16} /> Email</span>
                                {isEditing ? (
                                    <input type="email" className="input-field" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.email}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Phone size={16} /> Phone</span>
                                {isEditing ? (
                                    <input type="tel" className="input-field" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.phone}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label"><MapPin size={16} /> Address</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.address}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card info-section">
                        <h4 className="section-title">Additional Details</h4>

                        <div className="info-grid single-col">
                            <div className="info-item">
                                <span className="info-label">Business Segment</span>
                                {isEditing ? (
                                    <select className="input-field" value={customer.segment} onChange={e => setCustomer({ ...customer, segment: e.target.value })}>
                                        <option value="Enterprise">Enterprise</option>
                                        <option value="SMB">SMB</option>
                                        <option value="Agency">Agency</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{customer.segment}</span>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label">Notes & Memos</span>
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
                                <span className="info-label"><Calendar size={16} /> Date Added</span>
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
