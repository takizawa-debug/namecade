import { Loader, Edit2, Save, X, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COLUMNS } from '../constants/columns';
import { getRowStyleForExchanger, getChipStyleForExchanger } from '../utils/exchanger-colors';

interface CustomerTableProps {
    filteredCustomers: any[];
    loading: boolean;
    selectedIds: number[];
    setSelectedIds: (ids: number[]) => void;
    lastSelectedIndex: number | null;
    setLastSelectedIndex: (idx: number | null) => void;
    editingId: number | null;
    setEditingId: (id: number | null) => void;
    editData: any;
    setEditData: (data: any) => void;
    saveInlineEdit: (id: number) => void;
    fetchCustomers: () => void;
    filters: Record<string, string>;
    setFilters: (f: Record<string, string>) => void;
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    handleSort: (key: string) => void;
    exchangerOptions: string[];
}

const CustomerTable = ({
    filteredCustomers, loading, selectedIds, setSelectedIds,
    lastSelectedIndex, setLastSelectedIndex,
    editingId, setEditingId, editData, setEditData,
    saveInlineEdit, fetchCustomers,
    filters, setFilters, sortConfig, handleSort, exchangerOptions
}: CustomerTableProps) => {
    const navigate = useNavigate();

    const handleCheckboxChange = (e: any, customer: any) => {
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
    };

    const renderCellValue = (customer: any, col: typeof COLUMNS[number]) => {
        if (col.key === 'added_at') {
            return new Date(customer.addedAt || customer.added_at || Date.now()).toLocaleDateString();
        }
        if (col.key === 'website' && customer.website) {
            const url = customer.website.startsWith('http') ? customer.website : `https://${customer.website}`;
            return <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0ea5e9' }}>{customer.website}</a>;
        }
        if (col.key === 'sns_x' && customer.sns_x) {
            return <a href={customer.sns_x.startsWith('http') ? customer.sns_x : `https://x.com/${customer.sns_x}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0ea5e9' }}>{customer.sns_x}</a>;
        }
        if (col.key === 'exchanger' && customer.exchanger && customer.exchanger !== '-') {
            return <span style={{ ...getChipStyleForExchanger(customer.exchanger), padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>{customer.exchanger}</span>;
        }
        return customer[col.key] || '-';
    };

    const stickyLeft = (key: string) => key === 'exchanger' ? '60px' : key === 'name' ? '200px' : undefined;
    const isStickyCol = (key: string) => key === 'exchanger' || key === 'name';

    return (
        <div className="card table-container" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 220px)', paddingBottom: '1rem' }}>
            <datalist id="exchanger-list">
                {exchangerOptions.map((exchanger, idx) => (
                    <option key={idx} value={exchanger} />
                ))}
            </datalist>

            <table className="data-table" style={{ minWidth: '2500px' }}>
                <thead>
                    <tr>
                        <th style={{ minWidth: '60px', width: '60px', textAlign: 'center', padding: '1rem', position: 'sticky', top: 0, left: 0, background: '#f8fafc', zIndex: 40, borderBottom: '1px solid #e2e8f0' }}>
                            <input
                                type="checkbox"
                                checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                                onChange={(e) => setSelectedIds(e.target.checked ? filteredCustomers.map(c => c.id) : [])}
                            />
                        </th>
                        {COLUMNS.map(col => (
                            <th key={col.key} style={{
                                minWidth: col.width, maxWidth: col.width,
                                position: 'sticky', top: 0, left: stickyLeft(col.key),
                                zIndex: isStickyCol(col.key) ? 40 : 30,
                                background: '#f8fafc', verticalAlign: 'top', paddingTop: '12px',
                                borderBottom: '1px solid #e2e8f0',
                                boxShadow: col.key === 'name' ? '4px 0 6px -2px rgba(0,0,0,0.05)' : undefined
                            }}>
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
                        ))}
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
                                            onChange={(e) => handleCheckboxChange(e, customer)}
                                        />
                                    </td>
                                    {COLUMNS.map(col => (
                                        <td key={col.key} style={{
                                            minWidth: col.width, maxWidth: col.width,
                                            position: isStickyCol(col.key) ? 'sticky' : undefined,
                                            left: stickyLeft(col.key),
                                            background: isStickyCol(col.key) ? rowBg : undefined,
                                            zIndex: isStickyCol(col.key) ? 20 : undefined,
                                            boxShadow: col.key === 'name' ? '4px 0 6px -2px rgba(0,0,0,0.05)' : undefined
                                        }}>
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
                                                    {renderCellValue(customer, col)}
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                    <td style={{ position: 'sticky', right: 0, background: rowBg, zIndex: 10, minWidth: '90px', paddingRight: '1rem' }} onClick={e => e.stopPropagation()}>
                                        {editingId === customer.id ? (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="icon-btn" onClick={() => saveInlineEdit(customer.id)} style={{ color: '#10b981' }} title="保存"><Save size={16} /></button>
                                                <button className="icon-btn" onClick={() => setEditingId(null)} style={{ color: '#64748b' }} title="キャンセル"><X size={16} /></button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="icon-btn" onClick={() => {
                                                    setEditingId(customer.id);
                                                    setEditData({ ...customer, added_at: customer.addedAt || customer.added_at });
                                                }} style={{ color: '#0ea5e9' }} title="編集"><Edit2 size={16} /></button>
                                                <button className="icon-btn danger" onClick={async () => {
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
    );
};

export default CustomerTable;
