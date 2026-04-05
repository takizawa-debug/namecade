import { useState } from 'react';
import { Search, Trash, Cloud, Loader } from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { useCustomers, useFilteredCustomers } from '../hooks/useCustomers';
import { customersApi } from '../lib/api';
import CustomerTable from '../components/CustomerTable';
import BulkEditModal from '../components/BulkEditModal';
import type { Customer, SortConfig, FilterState } from '../types/customer';
import './Dashboard.css';

const Dashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [filters, setFilters] = useState<FilterState>({});
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulkEditData, setBulkEditData] = useState({ business_category: '', tags: '', exchanger: '', added_at: '' });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<Partial<Customer>>({});
    const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

    const { syncing, progressStats, latestProcessedTime, handleDriveSync, handleForceReset } = useSync();
    const { customers, loading, setLoading, fetchCustomers, exchangerOptions } = useCustomers({ refreshTrigger: latestProcessedTime });
    const filteredCustomers = useFilteredCustomers(customers, searchTerm, filters, showDuplicatesOnly, sortConfig);

    // ─── Actions ────────────────────────────────────────────────────
    const handleMergeDuplicates = async () => {
        if (!confirm('交換者、会社名、氏名（またはローマ字）が一致する重複データを統合し、古いデータをメインにして新しいデータを削除します。よろしいですか？')) return;
        setLoading(true);
        try {
            const data = await customersApi.mergeDuplicates();
            if (data.success) {
                alert(`処理が完了しました。${data.mergedCount}件の重複グループを統合し、${data.deletedCount}件の不要なデータを削除しました。`);
                fetchCustomers();
            } else {
                throw new Error(data.error || '不明なエラー');
            }
        } catch (err: unknown) {
            alert(`エラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
        } finally { setLoading(false); }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`${selectedIds.length}件の連絡先を削除しますか？`)) return;
        setLoading(true);
        try {
            for (const id of selectedIds) await customersApi.delete(id);
            setSelectedIds([]); fetchCustomers();
        } catch (error) {
            console.error("Delete failed", error); alert("削除中にエラーが発生しました。"); setLoading(false);
        }
    };

    const handleBulkEditSubmit = async () => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        try {
            const dataToUpdate: Record<string, string> = {};
            if (bulkEditData.business_category.trim()) dataToUpdate.business_category = bulkEditData.business_category.trim();
            if (bulkEditData.tags.trim()) dataToUpdate.tags = bulkEditData.tags.trim();
            if (bulkEditData.exchanger.trim()) dataToUpdate.exchanger = bulkEditData.exchanger.trim();
            if (bulkEditData.added_at.trim()) dataToUpdate.added_at = bulkEditData.added_at.trim();
            if (Object.keys(dataToUpdate).length === 0) { alert("編集する項目を入力してください。"); setLoading(false); return; }

            await customersApi.bulkUpdate({ ids: selectedIds, data: dataToUpdate });
            setShowBulkEdit(false);
            setBulkEditData({ business_category: '', tags: '', exchanger: '', added_at: '' });
            setSelectedIds([]); fetchCustomers();
        } catch (error) {
            console.error("Bulk edit failed", error); alert("一括編集に失敗しました。"); setLoading(false);
        }
    };

    const saveInlineEdit = async (id: number) => {
        setLoading(true);
        try {
            await customersApi.update(id, editData);
            setEditingId(null); fetchCustomers();
        } catch (error) {
            console.error("Edit failed", error); alert("編集の保存に失敗しました。"); setLoading(false);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key: key as keyof Customer, direction });
    };

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="dashboard-page animate-fade-in" style={{ maxWidth: '100%', padding: '2.5rem' }}>
            <header className="page-header">
                <div>
                    <h2>ダッシュボード</h2>
                    <p className="subtitle">名刺と顧客情報を管理・整理します</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" onClick={handleMergeDuplicates} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', borderColor: '#fde68a', backgroundColor: '#fef3c7' }} title="重複している名刺の情報を統合し、不要なデータを削除します">重複統合</button>
                    <button className="btn-secondary" onClick={handleForceReset} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} title="同期が止まらない場合やロックを強制解除します">強制リセット</button>
                    <button className="btn-primary" onClick={handleDriveSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {syncing ? <Loader size={18} className="spin" /> : <Cloud size={18} />}
                        {syncing ? `同期中 (${progressStats.current}/${progressStats.total})` : 'Googleドライブと同期'}
                    </button>
                </div>
            </header>

            <div className="card dashboard-toolbar">
                <div className="search-bar">
                    <Search size={20} className="icon-muted" />
                    <input type="text" placeholder="名前、会社、メールアドレスで検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {selectedIds.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" style={{ color: '#0ea5e9', borderColor: '#e0f2fe', backgroundColor: '#f0f9ff' }} onClick={() => setShowBulkEdit(true)}>一括編集</button>
                        <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={handleDeleteSelected}>
                            <Trash size={18} />{selectedIds.length}件を削除
                        </button>
                    </div>
                ) : (
                    <button
                        className="btn-secondary"
                        style={{ color: showDuplicatesOnly ? '#b45309' : '#64748b', borderColor: showDuplicatesOnly ? '#fde68a' : '#e2e8f0', backgroundColor: showDuplicatesOnly ? '#fef3c7' : 'transparent', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                        title="氏名または氏名(ローマ字)が一致し、かつ会社名が一致している名刺を抽出します"
                    >フィルター: 重複疑いのみ</button>
                )}
            </div>

            {showBulkEdit && (
                <BulkEditModal
                    selectedCount={selectedIds.length}
                    bulkEditData={bulkEditData}
                    setBulkEditData={setBulkEditData}
                    exchangerOptions={exchangerOptions}
                    onSubmit={handleBulkEditSubmit}
                    onClose={() => setShowBulkEdit(false)}
                />
            )}

            <CustomerTable
                filteredCustomers={filteredCustomers}
                loading={loading}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                lastSelectedIndex={lastSelectedIndex}
                setLastSelectedIndex={setLastSelectedIndex}
                editingId={editingId}
                setEditingId={setEditingId}
                editData={editData}
                setEditData={setEditData}
                saveInlineEdit={saveInlineEdit}
                fetchCustomers={fetchCustomers}
                filters={filters}
                setFilters={setFilters}
                sortConfig={sortConfig}
                handleSort={handleSort}
                exchangerOptions={exchangerOptions}
            />
        </div>
    );
};

export default Dashboard;
