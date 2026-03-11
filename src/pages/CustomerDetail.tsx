import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Edit2, Save, MapPin, Phone, Mail, Building, Briefcase, Calendar, Globe, Smartphone, Printer, Twitter, Facebook, Instagram, Linkedin, Link2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import './CustomerDetail.css';

const MOCK_CUSTOMER = {
    id: 0, name: '', company: '', role: '', email: '', phone: '', address: '', segment: '', addedAt: new Date().toISOString(), memo: ''
};

// ─── Reusable field components ─────────────────────────────────────────────
type FieldProps = {
    icon: ReactNode;
    label: string;
    field: string;
    customer: any;
    isEditing: boolean;
    setCustomer: (c: any) => void;
    type?: string;
    className?: string;
};

const InfoField = ({ icon, label, field, customer, isEditing, setCustomer, type = 'text', className = '' }: FieldProps) => (
    <div className={`info-item ${className}`}>
        <span className="info-label">{icon} {label}</span>
        {isEditing ? (
            <input type={type} className="input-field" value={customer[field] || ''} onChange={e => setCustomer({ ...customer, [field]: e.target.value })} />
        ) : (
            <span className="info-value">{customer[field] || ''}</span>
        )}
    </div>
);

type LinkFieldProps = FieldProps & {
    urlPrefix: string;
    displayPrefix?: string;
};

const LinkField = ({ icon, label, field, customer, isEditing, setCustomer, urlPrefix, displayPrefix = '' }: LinkFieldProps) => (
    <div className="info-item">
        <span className="info-label">{icon} {label}</span>
        {isEditing ? (
            <input type="text" className="input-field" value={customer[field] || ''} onChange={e => setCustomer({ ...customer, [field]: e.target.value })} />
        ) : (
            <span className="info-value">
                {customer[field] ? (
                    <a
                        href={customer[field].startsWith('http') ? customer[field] : `${urlPrefix}${customer[field]}`}
                        target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}
                    >
                        {customer[field].startsWith('http') ? 'リンクを開く' : `${displayPrefix}${customer[field]}`}
                    </a>
                ) : ''}
            </span>
        )}
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────
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
            .then(data => { setCustomer(data); setLoading(false); })
            .catch(err => { console.error('Failed to load detail', err); setLoading(false); });
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

    if (loading) return <div className="customer-detail-page text-center"><p>読み込み中...</p></div>;

    // Shared props passed to every field component
    const fp = { customer, isEditing, setCustomer };

    return (
        <div className="customer-detail-page animate-fade-in">
            <header className="page-header sticky-header">
                <div className="header-actions">
                    <button className="btn-secondary btn-icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={18} /> 戻る
                    </button>
                    <div className="header-titles"><h2>顧客詳細</h2></div>
                </div>
                <div>
                    {isEditing ? (
                        <button className="btn-primary" onClick={handleSave}><Save size={18} /> 変更を保存</button>
                    ) : (
                        <button className="btn-secondary" onClick={() => setIsEditing(true)}><Edit2 size={18} /> 情報を編集</button>
                    )}
                </div>
            </header>

            <div className="profile-layout">
                {/* ── Sidebar ── */}
                <div className="card profile-sidebar">
                    <div className="profile-main-info">
                        {isEditing ? (
                            <>
                                <input type="text" className="input-field text-center font-bold" value={customer.name} placeholder="氏名" onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                                <input type="text" className="input-field text-center mt-2" value={customer.name_romaji || ''} placeholder="ローマ字表記" onChange={e => setCustomer({ ...customer, name_romaji: e.target.value })} style={{ marginTop: '8px' }} />
                            </>
                        ) : (
                            <>
                                <h3>{customer.name}</h3>
                                {customer.name_romaji && <p className="text-muted text-sm">{customer.name_romaji}</p>}
                            </>
                        )}
                        <p className="profile-subtitle" style={{ marginTop: '8px' }}>{customer.role} at {customer.company}</p>
                        <span className="badge mt-2">{customer.segment}</span>
                    </div>
                    <div className="profile-quick-actions">
                        <a href={`mailto:${customer.email}`} className="action-btn"><Mail size={16} /> メール</a>
                        <a href={`tel:${customer.phone}`} className="action-btn"><Phone size={16} /> 電話</a>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="profile-content">
                    <div className="card info-section">
                        <h4 className="section-title">連絡先情報</h4>
                        <div className="info-grid">
                            <InfoField icon={<Building size={16} />} label="会社名" field="company" {...fp} />
                            <InfoField icon={<Building size={16} />} label="部署" field="department" {...fp} />
                            <InfoField icon={<Briefcase size={16} />} label="役職" field="role" {...fp} />
                            <InfoField icon={<Mail size={16} />} label="メールアドレス" field="email" {...fp} type="email" />
                            <InfoField icon={<Phone size={16} />} label="固定電話" field="phone" {...fp} type="tel" />
                            <InfoField icon={<Smartphone size={16} />} label="携帯電話" field="phone_mobile" {...fp} type="tel" />
                            <InfoField icon={<Printer size={16} />} label="FAX" field="fax" {...fp} type="tel" />

                            {/* Website (special: clickable link in view mode) */}
                            <div className="info-item">
                                <span className="info-label"><Globe size={16} /> WEBサイト</span>
                                {isEditing ? (
                                    <input type="url" className="input-field" value={customer.website || ''} onChange={e => setCustomer({ ...customer, website: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.website ? (
                                            <a href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>{customer.website}</a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>

                            <LinkField icon={<Twitter size={16} />} label="X(Twitter)" field="sns_x" urlPrefix="https://x.com/" displayPrefix="@" {...fp} />
                            <LinkField icon={<Facebook size={16} />} label="Facebook" field="sns_facebook" urlPrefix="https://facebook.com/" {...fp} />
                            <LinkField icon={<Instagram size={16} />} label="Instagram" field="sns_instagram" urlPrefix="https://instagram.com/" displayPrefix="@" {...fp} />
                            <LinkField icon={<Linkedin size={16} />} label="LinkedIn" field="sns_linkedin" urlPrefix="https://linkedin.com/in/" {...fp} />
                            <LinkField icon={<Link2 size={16} />} label="その他SNS等" field="sns_other" urlPrefix="https://" {...fp} />

                            <InfoField icon={<MapPin size={16} />} label="郵便番号" field="postal_code" {...fp} />
                            <InfoField icon={<MapPin size={16} />} label="都道府県" field="prefecture" {...fp} />
                            <InfoField icon={<MapPin size={16} />} label="市区町村" field="city" {...fp} />
                            <InfoField icon={<MapPin size={16} />} label="番地" field="address_line1" {...fp} className="full-width" />
                            <InfoField icon={<MapPin size={16} />} label="建物名・階層" field="address_line2" {...fp} className="full-width" />

                            {(customer.address && !customer.address_line1) && (
                                <InfoField icon={<MapPin size={16} />} label="旧住所データ" field="address" {...fp} className="full-width" />
                            )}
                        </div>
                    </div>

                    <div className="card info-section">
                        <h4 className="section-title">追加情報</h4>
                        <div className="info-grid single-col">
                            <InfoField icon={null} label="事業区分" field="business_category" {...fp} />
                            <InfoField icon={null} label="タグ" field="tags" {...fp} />
                            <InfoField icon={null} label="交換者" field="exchanger" {...fp} />

                            <div className="info-item">
                                <span className="info-label">メモ・特記事項</span>
                                {isEditing ? (
                                    <textarea className="input-field" rows={4} value={customer.memo} onChange={e => setCustomer({ ...customer, memo: e.target.value })} />
                                ) : (
                                    <p className="info-value memo-text">{customer.memo}</p>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label">AI分析コメント</span>
                                {isEditing ? (
                                    <textarea className="input-field" rows={4} value={customer.ai_analysis || ''} onChange={e => setCustomer({ ...customer, ai_analysis: e.target.value })} />
                                ) : (
                                    <p className="info-value memo-text" style={{ fontStyle: 'italic', backgroundColor: 'var(--surface-color-subtle)', padding: '10px', borderRadius: '8px' }}>
                                        {customer.ai_analysis || '分析コメントはありません'}
                                    </p>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label"><Calendar size={16} /> 登録日</span>
                                <span className="info-value text-muted">{new Date(customer.addedAt || customer.added_at || Date.now()).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card info-section mt-4" style={{ marginTop: '20px' }}>
                        <h4 className="section-title">名刺プレビュー</h4>
                        <div className="card-preview" style={{ backgroundColor: 'var(--surface-color-2)', padding: '10px', borderRadius: '12px' }}>
                            {customer.image_url ? (
                                customer.image_url.toLowerCase().endsWith('.pdf') ? (
                                    <embed src={`${customer.image_url}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" width="100%" height="400px" style={{ border: 'none', borderRadius: '8px', overflow: 'hidden' }} />
                                ) : (
                                    <img src={customer.image_url} alt="Business Card" style={{ width: '100%', borderRadius: '8px', objectFit: 'contain' }} />
                                )
                            ) : (
                                <div className="text-muted text-center" style={{ padding: '2rem' }}>画像がありません</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetail;
