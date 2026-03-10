import { useState, useEffect, useContext } from 'react';
import { Search, Trash, Cloud, Loader, Edit2, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { SyncContext } from '../contexts/SyncContext';
import './Dashboard.css';

const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
};

const getRowStyleForExchanger = (exchanger?: string) => {
    if (!exchanger || exchanger === '-') return '#ffffff';
    const h = getHash(exchanger) % 360;
    return `hsl(${h}, 60%, 95%)`;
};

const getChipStyleForExchanger = (exchanger?: string) => {
    if (!exchanger || exchanger === '-') return { background: '#f1f5f9', color: '#64748b' };
    const h = getHash(exchanger) % 360;
    return {
        background: `hsl(${h}, 70%, 85%)`,
        color: `hsl(${h}, 80%, 25%)`
    };
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

    // sorting, filtering, and bulk editing state
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulkEditData, setBulkEditData] = useState({ business_category: '', tags: '', exchanger: '', added_at: '' });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>({});
    const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
    const syncContextObj = useContext(SyncContext);
    const { syncing, progressStats, latestProcessedTime, handleDriveSync, handleForceReset } = syncContextObj || {
        syncing: false,
        progressStats: { total: 0, current: 0 },
        latestProcessedTime: Date.now(),
        handleDriveSync: () => { },
        handleForceReset: () => { }
    };

    useEffect(() => {
        fetchCustomers();
    }, [latestProcessedTime]);

    const fetchCustomers = () => {
        fetch('/api/customers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setCustomers(data);
                } else {
                    setCustomers([]);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch customers:', err);
                setLoading(false);
            });
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`${selectedIds.length}件の連絡先を削除しますか？`)) return;

        setLoading(true);
        try {
            for (const id of selectedIds) {
                await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            }
            setSelectedIds([]);
            fetchCustomers();
        } catch (error) {
            console.error("Delete failed", error);
            alert("削除中にエラーが発生しました。");
            setLoading(false);
        }
    };

    const handleBulkEditSubmit = async () => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        try {
            const dataToUpdate: any = {};
            if (bulkEditData.business_category.trim()) dataToUpdate.business_category = bulkEditData.business_category.trim();
            if (bulkEditData.tags.trim()) dataToUpdate.tags = bulkEditData.tags.trim();
            if (bulkEditData.exchanger.trim()) dataToUpdate.exchanger = bulkEditData.exchanger.trim();
            if (bulkEditData.added_at.trim()) dataToUpdate.added_at = bulkEditData.added_at.trim();

            if (Object.keys(dataToUpdate).length === 0) {
                alert("編集する項目を入力してください。");
                setLoading(false);
                return;
            }

            const res = await fetch('/api/customers/bulk', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, data: dataToUpdate })
            });

            if (!res.ok) throw new Error("Bulk edit failed");
            setShowBulkEdit(false);
            setBulkEditData({ business_category: '', tags: '', exchanger: '', added_at: '' });
            setSelectedIds([]);
            fetchCustomers();
        } catch (error) {
            console.error("Bulk edit failed", error);
            alert("一括編集に失敗しました。");
            setLoading(false);
        }
    };

    const saveInlineEdit = async (id: number) => {
        setLoading(true);
        try {
            const dataToUpdate = { ...editData };
            const res = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate)
            });
            if (!res.ok) throw new Error("Save failed");
            setEditingId(null);
            fetchCustomers();
        } catch (error) {
            console.error("Edit failed", error);
            alert("編集の保存に失敗しました。");
            setLoading(false);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Sync logic has been moved to SyncContext

    let resultCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    Object.keys(filters).forEach(key => {
        if (filters[key]) {
            resultCustomers = resultCustomers.filter(c =>
                (c[key] || '').toString().toLowerCase().includes(filters[key].toLowerCase())
            );
        }
    });

    if (showDuplicatesOnly) {
        const dups = new Set<number>();
        for (let i = 0; i < resultCustomers.length; i++) {
            for (let j = i + 1; j < resultCustomers.length; j++) {
                const a = resultCustomers[i];
                const b = resultCustomers[j];

                const isNameMatch = a.name && b.name && a.name === b.name;
                const isRomajiMatch = a.name_romaji && b.name_romaji && a.name_romaji === b.name_romaji;
                const isCompanyMatch = a.company && b.company && a.company === b.company;

                if ((isNameMatch || isRomajiMatch) && isCompanyMatch) {
                    dups.add(a.id);
                    dups.add(b.id);
                }
            }
        }
        resultCustomers = resultCustomers.filter(c => dups.has(c.id));
    }

    if (sortConfig) {
        resultCustomers.sort((a, b) => {
            const valA = (a[sortConfig.key] || '').toString().toLowerCase();
            const valB = (b[sortConfig.key] || '').toString().toLowerCase();
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const filteredCustomers = resultCustomers;

    const COLUMNS = [
        { key: 'exchanger', label: '交換者', width: '140px' },
        { key: 'name', label: '氏名', width: '140px' },
        { key: 'name_romaji', label: '氏名(ローマ字)', width: '120px' },
        { key: 'company', label: '会社名', width: '200px' },
        { key: 'department', label: '部署', width: '150px' },
        { key: 'role', label: '役職', width: '120px' },
        { key: 'email', label: 'メールアドレス', width: '200px' },
        { key: 'phone', label: '固定電話', width: '130px' },
        { key: 'phone_mobile', label: '携帯電話', width: '130px' },
        { key: 'fax', label: 'FAX', width: '130px' },
        { key: 'postal_code', label: '郵便番号', width: '100px' },
        { key: 'prefecture', label: '都道府県', width: '100px' },
        { key: 'city', label: '市区町村', width: '120px' },
        { key: 'address_line1', label: '番地', width: '150px' },
        { key: 'address_line2', label: '建物名・階層', width: '150px' },
        { key: 'website', label: 'WEBサイト', width: '180px' },
        { key: 'sns_x', label: 'X(Twitter)', width: '120px' },
        { key: 'sns_facebook', label: 'Facebook', width: '130px' },
        { key: 'sns_instagram', label: 'Instagram', width: '130px' },
        { key: 'sns_linkedin', label: 'LinkedIn', width: '130px' },
        { key: 'sns_other', label: 'その他SNS', width: '150px' },
        { key: 'business_category', label: '事業区分', width: '150px' },
        { key: 'tags', label: 'タグ', width: '150px' },
        { key: 'memo', label: 'メモ', width: '250px' },
        { key: 'ai_analysis', label: 'AI分析', width: '300px' },
        { key: 'added_at', label: '追加日', width: '120px' }
    ];

    return (
        <div className="dashboard-page animate-fade-in" style={{ maxWidth: '100%', padding: '2.5rem' }}>
            <header className="page-header">
                <div>
                    <h2>ダッシュボード</h2>
                    <p className="subtitle">名刺と顧客情報を管理・整理します</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" onClick={handleForceReset} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} title="同期が止まらない場合やロックを強制解除します">
                        強制リセット
                    </button>
                    <button className="btn-primary" onClick={handleDriveSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {syncing ? <Loader size={18} className="spin" /> : <Cloud size={18} />}
                        {syncing ? `同期中 (${progressStats.current}/${progressStats.total})` : 'Googleドライブと同期'}
                    </button>
                </div>
            </header>

            {/* Sync Overlay logic moved to SyncContext */}
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
                {selectedIds.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" style={{ color: '#0ea5e9', borderColor: '#e0f2fe', backgroundColor: '#f0f9ff' }} onClick={() => setShowBulkEdit(true)}>
                            一括編集
                        </button>
                        <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={handleDeleteSelected}>
                            <Trash size={18} />
                            {selectedIds.length}件を削除
                        </button>
                    </div>
                ) : (
                    <button
                        className="btn-secondary"
                        style={{
                            color: showDuplicatesOnly ? '#b45309' : '#64748b',
                            borderColor: showDuplicatesOnly ? '#fde68a' : '#e2e8f0',
                            backgroundColor: showDuplicatesOnly ? '#fef3c7' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                        onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                        title="氏名または氏名(ローマ字)が一致し、かつ会社名が一致している名刺を抽出します"
                    >
                        フィルター: 重複疑いのみ
                    </button>
                )}
            </div>

            {showBulkEdit && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                    <div className="card animate-fade-in" style={{ width: '400px', padding: '24px' }}>
                        <h3 style={{ marginBottom: '16px' }}>選択した {selectedIds.length} 件を一括編集</h3>
                        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>空白のままの項目は変更されません。</p>

                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>事業区分</label>
                            <input type="text" className="input-field" value={bulkEditData.business_category} onChange={e => setBulkEditData({ ...bulkEditData, business_category: e.target.value })} placeholder="変更後の事業区分" />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>タグ</label>
                            <input type="text" className="input-field" value={bulkEditData.tags} onChange={e => setBulkEditData({ ...bulkEditData, tags: e.target.value })} placeholder="変更後のタグ" />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>交換者</label>
                            <input type="text" className="input-field" value={bulkEditData.exchanger} onChange={e => setBulkEditData({ ...bulkEditData, exchanger: e.target.value })} placeholder="変更後の交換者" />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>追加日</label>
                            <input type="date" className="input-field" value={bulkEditData.added_at} onChange={e => setBulkEditData({ ...bulkEditData, added_at: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn-secondary" onClick={() => setShowBulkEdit(false)}>キャンセル</button>
                            <button className="btn-primary" onClick={handleBulkEditSubmit}>一括更新</button>
                        </div>
                    </div>
                </div>, document.body
            )}

            <datalist id="exchanger-list">
                {Array.from(new Set(customers.map((c: any) => c.exchanger).filter(Boolean))).map((exchanger: any, idx) => (
                    <option key={idx} value={exchanger} />
                ))}
            </datalist>

            <div className="card table-container" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 220px)', paddingBottom: '1rem' }}>
                <table className="data-table" style={{ minWidth: '2500px' }}>
                    <thead>
                        <tr>
                            <th style={{ minWidth: '60px', width: '60px', textAlign: 'center', padding: '1rem', position: 'sticky', top: 0, left: 0, background: '#f8fafc', zIndex: 40, borderBottom: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedIds(filteredCustomers.map(c => c.id));
                                        } else {
                                            setSelectedIds([]);
                                        }
                                    }}
                                />
                            </th>
                            {COLUMNS.map(col => {
                                const isStickyX = col.key === 'exchanger' || col.key === 'name';
                                const left = col.key === 'exchanger' ? '60px' : col.key === 'name' ? '200px' : undefined;
                                const zIndex = isStickyX ? 40 : 30;

                                return (
                                    <th key={col.key} style={{ minWidth: col.width, maxWidth: col.width, position: 'sticky', top: 0, left: left, zIndex: zIndex, background: '#f8fafc', verticalAlign: 'top', paddingTop: '12px', borderBottom: '1px solid #e2e8f0', boxShadow: isStickyX && col.key === 'name' ? '4px 0 6px -2px rgba(0,0,0,0.05)' : undefined }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', cursor: 'pointer' }} onClick={() => handleSort(col.key)}>
                                            {col.label}
                                            {sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="絞り込み..."
                                            list={col.key === 'exchanger' ? "exchanger-list" : undefined}
                                            value={filters[col.key] || ''}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setFilters({ ...filters, [col.key]: e.target.value })}
                                            className="input-field"
                                            style={{ width: '100%', padding: '4px 6px', fontSize: '11px', height: 'auto', minHeight: '24px' }}
                                        />
                                    </th>
                                );
                            })}
                            <th style={{ position: 'sticky', top: 0, right: 0, background: '#f8fafc', zIndex: 40, width: '90px', borderBottom: '1px solid #e2e8f0' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={COLUMNS.length + 2} style={{ textAlign: 'center', padding: '40px' }}><Loader size={24} className="spin text-muted" style={{ margin: '0 auto' }} /></td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={COLUMNS.length + 2} style={{ textAlign: 'center', padding: '40px' }}><span className="text-muted">データが見つかりません。</span></td></tr>
                        ) : (
                            filteredCustomers.map((customer: any) => {
                                const rowBg = getRowStyleForExchanger(customer.exchanger);
                                return (
                                    <tr key={customer.id} onClick={() => navigate(`/customer/${customer.id}`)} className="clickable-row" style={{ backgroundColor: rowBg }}>
                                        <td onClick={e => e.stopPropagation()} style={{ minWidth: '60px', width: '60px', textAlign: 'center', padding: '1rem', position: 'sticky', left: 0, background: rowBg, zIndex: 20 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(customer.id)}
                                                onChange={(e: any) => {
                                                    let newSelectedIds = [...selectedIds];
                                                    const index = filteredCustomers.findIndex(c => c.id === customer.id);

                                                    if (e.nativeEvent.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== -1) {
                                                        const start = Math.min(lastSelectedIndex, index);
                                                        const end = Math.max(lastSelectedIndex, index);
                                                        const idsInRange = filteredCustomers.slice(start, end + 1).map(c => c.id);

                                                        if (e.target.checked) {
                                                            newSelectedIds = [...new Set([...newSelectedIds, ...idsInRange])];
                                                        } else {
                                                            newSelectedIds = newSelectedIds.filter(id => !idsInRange.includes(id));
                                                        }
                                                    } else {
                                                        if (e.target.checked) {
                                                            newSelectedIds.push(customer.id);
                                                        } else {
                                                            newSelectedIds = newSelectedIds.filter(id => id !== customer.id);
                                                        }
                                                    }

                                                    setSelectedIds(newSelectedIds);
                                                    setLastSelectedIndex(index);
                                                }}
                                            />
                                        </td>
                                        {COLUMNS.map(col => {
                                            let val = customer[col.key] || '-';
                                            if (col.key === 'added_at') {
                                                val = new Date(customer.addedAt || customer.added_at || Date.now()).toLocaleDateString();
                                            } else if (col.key === 'website' && customer.website) {
                                                const url = customer.website.startsWith('http') ? customer.website : `https://${customer.website}`;
                                                val = <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0ea5e9' }}>{customer.website}</a>;
                                            } else if (col.key === 'sns_x' && customer.sns_x) {
                                                val = <a href={customer.sns_x.startsWith('http') ? customer.sns_x : `https://x.com/${customer.sns_x}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0ea5e9' }}>{customer.sns_x}</a>;
                                            } else if (col.key === 'exchanger' && customer.exchanger && customer.exchanger !== '-') {
                                                val = <span style={{ ...getChipStyleForExchanger(customer.exchanger), padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>{customer.exchanger}</span>;
                                            }

                                            const isStickyX = col.key === 'exchanger' || col.key === 'name';
                                            const left = col.key === 'exchanger' ? '60px' : col.key === 'name' ? '200px' : undefined;

                                            return (
                                                <td key={col.key} style={{ minWidth: col.width, maxWidth: col.width, position: isStickyX ? 'sticky' : undefined, left: left, background: isStickyX ? rowBg : undefined, zIndex: isStickyX ? 20 : undefined, boxShadow: isStickyX && col.key === 'name' ? '4px 0 6px -2px rgba(0,0,0,0.05)' : undefined }}>
                                                    {editingId === customer.id ? (
                                                        <input
                                                            type={col.key === 'added_at' ? 'date' : 'text'}
                                                            className="input-field"
                                                            style={{ width: '100%', padding: '4px', fontSize: '12px', height: '28px' }}
                                                            value={col.key === 'added_at' ? (editData[col.key] ? new Date(editData[col.key]).toISOString().split('T')[0] : '') : (editData[col.key] || '')}
                                                            onChange={e => setEditData({ ...editData, [col.key]: e.target.value })}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: col.width }} title={String(customer[col.key] || '')}>
                                                            {val}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ position: 'sticky', right: 0, background: rowBg, zIndex: 10, minWidth: '90px', paddingRight: '1rem' }} onClick={e => e.stopPropagation()}>
                                            {editingId === customer.id ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); saveInlineEdit(customer.id); }} style={{ color: '#10b981' }} title="保存"><Save size={16} /></button>
                                                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setEditingId(null); }} style={{ color: '#64748b' }} title="キャンセル"><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="icon-btn" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingId(customer.id);
                                                        setEditData({ ...customer, added_at: customer.addedAt || customer.added_at });
                                                    }} style={{ color: '#0ea5e9' }} title="編集"><Edit2 size={16} /></button>
                                                    <button className="icon-btn danger" onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('この連絡先を削除しますか？')) {
                                                            await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
                                                            fetchCustomers();
                                                        }
                                                    }} title="削除"><Trash size={16} /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
