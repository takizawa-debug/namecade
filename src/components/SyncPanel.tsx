import type { SyncLog } from '../contexts/SyncContext';

interface SyncPanelProps {
    syncing: boolean;
    progressStats: { total: number; current: number };
    logs: SyncLog[];
    onStop: () => void;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
    pending:     { text: '待機中',   color: '#94a3b8' },
    skipped:     { text: 'スキップ', color: '#cbd5e1' },
    downloading: { text: '取得中',   color: '#0369a1' },
    parsing:     { text: '解析中',   color: '#854d0e' },
    saving:      { text: '保存中',   color: '#166534' },
    completed:   { text: '完了',     color: '#10b981' },
    error:       { text: 'エラー',   color: '#ef4444' },
};

const SyncPanel = ({ syncing, progressStats, logs, onStop }: SyncPanelProps) => {
    return (
        <div className="sync-overlay card animate-fade-in" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, width: 450, padding: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>クラウド同期・自動解析状況</h3>
                <button className="btn-secondary btn-sm" onClick={onStop}>
                    {syncing ? '停止・閉じる' : '閉じる'}
                </button>
            </div>
            <div style={{ paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
                <span style={{ fontSize: 14, fontWeight: 'bold' }}>処理中: {progressStats.current} / {progressStats.total} 枚</span>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <tbody>
                        {logs.map(log => {
                            const statusInfo = STATUS_LABELS[log.status] || { text: '', color: '#333' };
                            return (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '6px', fontSize: '12px', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.fileName}>
                                        {log.fileName}
                                    </td>
                                    <td style={{ padding: '6px', fontSize: '12px' }}>
                                        <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>
                                    </td>
                                    <td style={{ padding: '6px', fontSize: '12px', color: '#334155', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {(log.status === 'error' || log.status === 'skipped') ? (
                                            <span style={{ color: log.status === 'error' ? '#ef4444' : '#94a3b8' }} title={log.errorMsg}>{log.errorMsg}</span>
                                        ) : log.result ? (
                                            <span title={`${log.result.company} ${log.result.name}`}>
                                                <strong>{log.result.company}</strong> {log.result.name}
                                            </span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SyncPanel;
