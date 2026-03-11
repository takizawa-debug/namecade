import { createPortal } from 'react-dom';

interface BulkEditModalProps {
    selectedCount: number;
    bulkEditData: { business_category: string; tags: string; exchanger: string; added_at: string };
    setBulkEditData: (data: any) => void;
    exchangerOptions: string[];
    onSubmit: () => void;
    onClose: () => void;
}

const BulkEditModal = ({ selectedCount, bulkEditData, setBulkEditData, exchangerOptions, onSubmit, onClose }: BulkEditModalProps) => {
    return createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
            <div className="card animate-fade-in" style={{ width: '400px', padding: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>選択した {selectedCount} 件を一括編集</h3>
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
                    <select
                        className="input-field"
                        value={bulkEditData.exchanger}
                        onChange={e => setBulkEditData({ ...bulkEditData, exchanger: e.target.value })}
                        style={{ width: '100%', padding: '8px', cursor: 'pointer' }}
                    >
                        <option value="">-- 変更しない --</option>
                        {exchangerOptions.map((exchanger, idx) => (
                            <option key={idx} value={exchanger}>{exchanger}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>追加日</label>
                    <input type="date" className="input-field" value={bulkEditData.added_at} onChange={e => setBulkEditData({ ...bulkEditData, added_at: e.target.value })} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn-secondary" onClick={onClose}>キャンセル</button>
                    <button className="btn-primary" onClick={onSubmit}>一括更新</button>
                </div>
            </div>
        </div>, document.body
    );
};

export default BulkEditModal;
