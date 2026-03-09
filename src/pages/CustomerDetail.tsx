import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Save, MapPin, Phone, Mail, Building, Briefcase, Calendar, Globe, Smartphone, Printer, Twitter, Facebook, Instagram, Linkedin, Link2 } from 'lucide-react';
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
                    <div className="profile-main-info">
                        {isEditing ? (
                            <>
                                <input
                                    type="text"
                                    className="input-field text-center font-bold"
                                    value={customer.name}
                                    placeholder="氏名"
                                    onChange={e => setCustomer({ ...customer, name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    className="input-field text-center mt-2"
                                    value={customer.name_romaji || ''}
                                    placeholder="ローマ字表記"
                                    onChange={e => setCustomer({ ...customer, name_romaji: e.target.value })}
                                    style={{ marginTop: '8px' }}
                                />
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
                                <span className="info-label"><Building size={16} /> 部署</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.department || ''} onChange={e => setCustomer({ ...customer, department: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.department || ''}</span>
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
                                <span className="info-label"><Phone size={16} /> 固定電話</span>
                                {isEditing ? (
                                    <input type="tel" className="input-field" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.phone}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Smartphone size={16} /> 携帯電話</span>
                                {isEditing ? (
                                    <input type="tel" className="input-field" value={customer.phone_mobile || ''} onChange={e => setCustomer({ ...customer, phone_mobile: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.phone_mobile || ''}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Printer size={16} /> FAX</span>
                                {isEditing ? (
                                    <input type="tel" className="input-field" value={customer.fax || ''} onChange={e => setCustomer({ ...customer, fax: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.fax || ''}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Globe size={16} /> WEBサイト</span>
                                {isEditing ? (
                                    <input type="url" className="input-field" value={customer.website || ''} onChange={e => setCustomer({ ...customer, website: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.website ? (
                                            <a href={customer.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>{customer.website}</a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Twitter size={16} /> X(Twitter)</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.sns_x || ''} onChange={e => setCustomer({ ...customer, sns_x: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.sns_x ? (
                                            <a href={customer.sns_x.startsWith('http') ? customer.sns_x : `https://x.com/${customer.sns_x}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
                                                {customer.sns_x.startsWith('http') ? 'リンクを開く' : `@${customer.sns_x}`}
                                            </a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Facebook size={16} /> Facebook</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.sns_facebook || ''} onChange={e => setCustomer({ ...customer, sns_facebook: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.sns_facebook ? (
                                            <a href={customer.sns_facebook.startsWith('http') ? customer.sns_facebook : `https://facebook.com/${customer.sns_facebook}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
                                                {customer.sns_facebook.startsWith('http') ? 'リンクを開く' : customer.sns_facebook}
                                            </a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Instagram size={16} /> Instagram</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.sns_instagram || ''} onChange={e => setCustomer({ ...customer, sns_instagram: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.sns_instagram ? (
                                            <a href={customer.sns_instagram.startsWith('http') ? customer.sns_instagram : `https://instagram.com/${customer.sns_instagram}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
                                                {customer.sns_instagram.startsWith('http') ? 'リンクを開く' : `@${customer.sns_instagram}`}
                                            </a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Linkedin size={16} /> LinkedIn</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.sns_linkedin || ''} onChange={e => setCustomer({ ...customer, sns_linkedin: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.sns_linkedin ? (
                                            <a href={customer.sns_linkedin.startsWith('http') ? customer.sns_linkedin : `https://linkedin.com/in/${customer.sns_linkedin}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
                                                {customer.sns_linkedin.startsWith('http') ? 'リンクを開く' : customer.sns_linkedin}
                                            </a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Link2 size={16} /> その他SNS等</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.sns_other || ''} onChange={e => setCustomer({ ...customer, sns_other: e.target.value })} />
                                ) : (
                                    <span className="info-value">
                                        {customer.sns_other ? (
                                            <a href={customer.sns_other.startsWith('http') ? customer.sns_other : `https://${customer.sns_other}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
                                                {customer.sns_other.startsWith('http') ? 'リンクを開く' : customer.sns_other}
                                            </a>
                                        ) : ''}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><MapPin size={16} /> 郵便番号</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.postal_code || ''} onChange={e => setCustomer({ ...customer, postal_code: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.postal_code || ''}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><MapPin size={16} /> 都道府県</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.prefecture || ''} onChange={e => setCustomer({ ...customer, prefecture: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.prefecture || ''}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label"><MapPin size={16} /> 市区町村</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.city || ''} onChange={e => setCustomer({ ...customer, city: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.city || ''}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label"><MapPin size={16} /> 番地</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.address_line1 || ''} onChange={e => setCustomer({ ...customer, address_line1: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.address_line1 || ''}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label"><MapPin size={16} /> 建物名・階層</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.address_line2 || ''} onChange={e => setCustomer({ ...customer, address_line2: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.address_line2 || ''}</span>
                                )}
                            </div>
                            {/* 結合した元の住所は閲覧用には出さず細分化したものを優先 または フォールバックとして表示 */}
                            {(customer.address && !customer.address_line1) && (
                                <div className="info-item full-width">
                                    <span className="info-label"><MapPin size={16} /> 旧住所データ</span>
                                    {isEditing ? (
                                        <input type="text" className="input-field" value={customer.address || ''} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
                                    ) : (
                                        <span className="info-value">{customer.address || ''}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card info-section">
                        <h4 className="section-title">追加情報</h4>

                        <div className="info-grid single-col">
                            <div className="info-item">
                                <span className="info-label">事業区分</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.business_category || ''} onChange={e => setCustomer({ ...customer, business_category: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.business_category || ''}</span>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label">タグ</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.tags || ''} onChange={e => setCustomer({ ...customer, tags: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.tags || ''}</span>
                                )}
                            </div>

                            <div className="info-item">
                                <span className="info-label">交換者</span>
                                {isEditing ? (
                                    <input type="text" className="input-field" value={customer.exchanger || ''} onChange={e => setCustomer({ ...customer, exchanger: e.target.value })} />
                                ) : (
                                    <span className="info-value">{customer.exchanger || ''}</span>
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
                                <span className="info-label">AI分析コメント</span>
                                {isEditing ? (
                                    <textarea
                                        className="input-field"
                                        rows={4}
                                        value={customer.ai_analysis || ''}
                                        onChange={e => setCustomer({ ...customer, ai_analysis: e.target.value })}
                                    />
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
                                    <embed src={`/api/image/${encodeURIComponent(customer.image_url)}`} type="application/pdf" width="100%" height="400px" style={{ border: 'none', borderRadius: '8px' }} />
                                ) : (
                                    <img src={`/api/image/${encodeURIComponent(customer.image_url)}`} alt="Business Card" style={{ width: '100%', borderRadius: '8px', objectFit: 'contain' }} />
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
