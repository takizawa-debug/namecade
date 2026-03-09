import { useState, useEffect } from 'react';
import { Search, Trash, Cloud, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import './Dashboard.css';

interface SyncLog {
    id: string;
    fileName: string;
    status: 'pending' | 'downloading' | 'parsing' | 'saving' | 'completed' | 'error';
    result?: any;
    errorMsg?: string;
}

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
    // Sync state
    const [syncing, setSyncing] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
    const [progressStats, setProgressStats] = useState({ total: 0, current: 0 });

    useEffect(() => {
        fetchCustomers();

        // Resume sync if there's a pending state
        const savedSync = localStorage.getItem('namecard_sync_state');
        if (savedSync) {
            try {
                const state = JSON.parse(savedSync);
                if (state && state.isRunning && state.files && state.currentIndex < state.files.length) {
                    startOrResumeSync(true, state);
                } else {
                    localStorage.removeItem('namecard_sync_state');
                }
            } catch (e) {
                localStorage.removeItem('namecard_sync_state');
            }
        }
    }, []);

    const fetchCustomers = () => {
        fetch('/api/customers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setCustomers(data);
                    const companies = data.map((c: any) => c.company).filter((c: string) => c && c.trim() !== '');
                    setExistingCompanies([...new Set(companies)] as string[]);
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

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });
    };

    // updateLog was removed.

    const handleDriveSync = () => startOrResumeSync(false, null);

    const startOrResumeSync = async (isResume = false, savedState: any = null) => {
        if (syncing) return;
        setSyncing(true);
        setShowSyncPanel(true);

        let currentState: any;
        if (isResume && savedState) {
            currentState = savedState;
            setLogs(currentState.logs);
            setProgressStats({ total: currentState.files.length, current: currentState.currentIndex });
        } else {
            setLogs([]);
            setProgressStats({ total: 0, current: 0 });

            try {
                // 1. Get List of files
                const listRes = await fetch('/api/drive/list');
                if (!listRes.ok) throw new Error(await listRes.text());
                const listData = await listRes.json();

                if (!listData.success) throw new Error(listData.error);

                const files = listData.files || [];
                if (files.length === 0) {
                    alert("Googleドライブの「未登録」フォルダに新しい名刺画像がありません。");
                    setSyncing(false);
                    setTimeout(() => setShowSyncPanel(false), 3000);
                    return;
                }

                const initialLogs: SyncLog[] = files.map((f: any) => ({
                    id: f.id,
                    fileName: f.name,
                    status: 'pending'
                }));

                currentState = { isRunning: true, files, logs: initialLogs, currentIndex: 0, newCustomersFound: false };
                setLogs(initialLogs);
                setProgressStats({ total: files.length, current: 0 });
                localStorage.setItem('namecard_sync_state', JSON.stringify(currentState));
            } catch (err: any) {
                console.error("Failed to fetch list", err);
                alert("リスト取得中にエラーが発生しました。");
                setSyncing(false);
                setShowSyncPanel(false);
                return;
            }
        }

        try {
            // Process files from current index
            for (let i = currentState.currentIndex; i < currentState.files.length; i++) {
                currentState.currentIndex = i;
                localStorage.setItem('namecard_sync_state', JSON.stringify(currentState));

                const file = currentState.files[i];
                setProgressStats(prev => ({ ...prev, current: i + 1 }));

                // Ensure we use the latest logs array reference
                let currentLogs = [...currentState.logs];
                const updateLogLocal = (status: any, extra = {}) => {
                    const idx = currentLogs.findIndex((l: any) => l.id === file.id);
                    if (idx > -1) {
                        currentLogs[idx] = { ...currentLogs[idx], status, ...extra };
                        setLogs([...currentLogs]);
                        currentState.logs = currentLogs;
                        localStorage.setItem('namecard_sync_state', JSON.stringify(currentState));
                    }
                };

                try {
                    // Download
                    updateLogLocal('downloading');
                    const dlRes = await fetch('/api/drive/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id, fileName: file.name, mimeType: file.mimeType })
                    });
                    if (!dlRes.ok) throw new Error(await dlRes.text());
                    const dlData = await dlRes.json();
                    if (!dlData.success) throw new Error(dlData.error);

                    // Fetch blob and convert to base64
                    const imgRes = await fetch(dlData.url);
                    const blob = await imgRes.blob();
                    const base64Data = await toBase64(blob);

                    // Parse
                    updateLogLocal('parsing');
                    const promptText = `あなたはプロフェッショナルな名刺情報抽出・分析アシスタントです。提供された名刺画像（表裏両面が含まれている場合もあります）から、以下の情報を日本語を最優先して極めて高い精度で抽出し、指定されたJSON構造のみを出力してください。

抽出と同時に、取得した総合的な情報から、相手がどのような組織・業種に属しているか、どのような役立つ接点（ビジネスチャンスなど）が持てそうか等について「AI分析コメント（150文字程度）」を作成し、\`aiAnalysis\`フィールドに格納してください。裏面の情報も加味してください。WEBサイトのURLやQRコード等があればそれも抽出してください。

【重要】自社情報について：
自社は「株式会社みみずや (https://mimizuya.co.jp/)」です。
AI分析コメントを作成する際は、必ずこの「みみずや」と、読み取った名刺の人物・企業がどのようなビジネスの接点・シナジーがありそうか、どのような営業アプローチが有効かを推測し、相手の業種と役職に合わせてコメントとして記述してください。

【重要】会社名について：
以下はこれまでに登録された会社名のリストです。
${existingCompanies.length > 0 ? existingCompanies.map(c => `- ${c}`).join('\n') : '(まだ登録企業はありません)'}
もし今回読み取った名刺の企業がこのリスト内の企業と同一であると判断できる場合（例: 株式会社の有無や配置違い、略称など）、必ず**上記リストにある正式名称と完全一致する文字列**を出力してください。
リストにない新しい企業の場合や、リストが存在しない場合、名刺上の「(株)」や「㈱」といった略称は、必ず「株式会社」という正式名称に変換して出力してください。同様に「(有)」「㈲」は「有限会社」に、「(財)」「㈶」は「財団法人」に変換するなど、正式名称（完全な表記）として出力してください。

構造:
{ 
  "name": "氏名", 
  "name_romaji": "氏名のローマ字読み（名刺に明記されている場合のみ。ない場合は空文字）",
  "company": "会社名", 
  "department": "部署（ない場合は空文字）", 
  "role": "役職（ない場合は空文字）", 
  "email": "メールアドレス", 
  "phone": "固定電話", 
  "phone_mobile": "携帯電話", 
  "fax": "FAX", 
  "postal_code": "郵便番号", 
  "prefecture": "都道府県", 
  "city": "市区町村", 
  "address_line1": "番地", 
  "address_line2": "建物名や階層（ない場合は空文字）", 
  "website": "WEBサイトURL（名刺に明記されている場合のみ）", 
  "sns_x": "X(Twitter)アカウント（名刺に明記されている場合のみ）",
  "sns_facebook": "Facebookアカウント（名刺に明記されている場合のみ）",
  "sns_instagram": "Instagramアカウント（名刺に明記されている場合のみ）",
  "sns_linkedin": "LinkedInアカウント（名刺に明記されている場合のみ）",
  "sns_other": "その他のSNS等のURL",
  "aiAnalysis": "AI分析コメント" 
}

条件（超重要🚨）:
- 日本語の氏名、会社名、住所などは「名刺に書かれている文字の通り」正確に読み取ってください。
- ローマ字での名前表記（フリガナ代わり）が名刺にある場合は、'name_romaji'として必ず抽出してください。
- 住所、部署、役職、電話番号などは細かく適切に分割してください。
- 企業名等のゆらぎについて：「(株)」や「㈱」といった略称が記載されている場合でも、**必ず「株式会社」という正式名称に変換して出力**してください。「(有)」は「有限会社」に統一してください。ここは絶対に守ってください。
- **名刺に直接書かれていない情報の推測・検索補完は一切行わないでください。**存在しないSNSアカウント、適当なURL、検索結果などで空欄を埋める行為は厳禁です。該当の記載がなければ必ず「空文字("")」にしてください。
- AI分析コメントは、名刺から得られた「客観的な事実（業種・部署・役職など）」のみから推測される、どのようなビジネスの接点になり得るかという簡潔なコメントを100文字程度で記述してください。
- JSONフォーマット以外（説明テキストや\`\`\`jsonなどのマークダウン）は一切出力しないでください。`;

                    const parseRes = await fetch('/api/parse', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: promptText, base64Data, mimeType: dlData.mimeType })
                    });

                    if (!parseRes.ok) throw new Error(await parseRes.text());
                    const parseData = await parseRes.json();
                    if (!parseData.success) {
                        if (parseData.error && parseData.error.includes && parseData.error.includes("leaked")) {
                            throw new Error("Gemini APIキーが無効化されています。");
                        }
                        throw new Error(parseData.error);
                    }
                    const extracted = parseData.data;

                    if (file.folderName) {
                        extracted.exchanger = file.folderName;
                    }

                    updateLogLocal('saving', { result: extracted });

                    const customerData = {
                        ...extracted,
                        imageUrl: dlData.url
                    };
                    const saveRes = await fetch('/api/customers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(customerData)
                    });
                    if (!saveRes.ok) throw new Error("データベースへの保存に失敗しました");

                    const safeName = (extracted.name || '名前不明').replace(/[\/\\?%*:|"<>]/g, '');
                    const safeCompany = (extracted.company || '会社不明').replace(/[\/\\?%*:|"<>]/g, '');
                    const safeExchanger = (extracted.exchanger || '交換者不明').replace(/[\/\\?%*:|"<>]/g, '');
                    const ext = (file.name || '').split('.').pop() || 'pdf';
                    const newFileName = `${safeExchanger}_${safeName}_${safeCompany}.${ext}`;

                    // Move file in Google Drive
                    const moveRes = await fetch('/api/drive/move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id, newName: newFileName })
                    });

                    if (!moveRes.ok) {
                        const moveErr = await moveRes.json();
                        throw new Error(`ドライブ移動エラー: ${moveErr.error || 'Unknown'}`);
                    }

                    updateLogLocal('completed');
                    currentState.newCustomersFound = true;

                    // If existingCompanies array is used (though closure might be stale, we use state setter cautiously)
                    if (extracted.company) {
                        setExistingCompanies(prev => prev.includes(extracted.company) ? prev : [...prev, extracted.company]);
                    }

                } catch (err: any) {
                    console.error("File processing failed: ", file.name, err);
                    updateLogLocal('error', { errorMsg: err.message || String(err) });
                }
            }

            currentState.isRunning = false;
            currentState.currentIndex = currentState.files.length;
            localStorage.setItem('namecard_sync_state', JSON.stringify(currentState));

            if (currentState.newCustomersFound) {
                fetchCustomers(); // Refresh the list after all are done
            }
            localStorage.removeItem('namecard_sync_state');

            setTimeout(() => {
                alert("Google Driveの同期・解析が完了しました！");
            }, 500);

        } catch (error) {
            console.error("Drive sync failed", error);
            alert("同期中にエラーが発生しました。\n" + (error as Error).message);
        } finally {
            setSyncing(false);
        }
    };

    const getStatusBadge = (status: SyncLog['status']) => {
        switch (status) {
            case 'pending': return <span className="status-badge pending">待機中</span>;
            case 'downloading': return <span className="status-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}><Loader size={12} className="spin" style={{ marginRight: '4px' }} /> 取得中</span>;
            case 'parsing': return <span className="status-badge" style={{ background: '#fef08a', color: '#854d0e' }}><Loader size={12} className="spin" style={{ marginRight: '4px' }} /> AI解析中</span>;
            case 'saving': return <span className="status-badge" style={{ background: '#dcfce7', color: '#166534' }}><Loader size={12} className="spin" style={{ marginRight: '4px' }} /> 保存中</span>;
            case 'completed': return <span className="status-badge completed"><CheckCircle size={12} style={{ marginRight: '4px' }} /> 完了</span>;
            case 'error': return <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b' }}><AlertCircle size={12} style={{ marginRight: '4px' }} /> エラー</span>;
        }
    };

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
                <button className="btn-primary" onClick={handleDriveSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {syncing ? <Loader size={18} className="spin" /> : <Cloud size={18} />}
                    {syncing ? `同期中 (${progressStats.current}/${progressStats.total})` : 'Googleドライブと同期'}
                </button>
            </header>

            {showSyncPanel && (
                <div className="sync-logs-container card animate-fade-in" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>クラウド同期・自動解析状況</h3>
                        {!syncing && (
                            <button className="btn-secondary btn-sm" onClick={() => setShowSyncPanel(false)}>
                                閉じる
                            </button>
                        )}
                    </div>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff' }}>
                                    <th style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>ファイル名</th>
                                    <th style={{ padding: '8px', color: '#64748b', fontSize: '13px', width: '110px' }}>ステータス</th>
                                    <th style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>結果</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '8px', fontSize: '13px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {log.fileName}
                                        </td>
                                        <td style={{ padding: '8px' }}>{getStatusBadge(log.status)}</td>
                                        <td style={{ padding: '8px', fontSize: '13px', color: '#334155' }}>
                                            {log.status === 'error' ? (
                                                <span style={{ color: '#ef4444' }}>{log.errorMsg}</span>
                                            ) : log.result ? (
                                                <span>
                                                    <strong>{log.result.company}</strong> {log.result.name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#cbd5e1' }}>-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                {selectedIds.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" style={{ color: '#0ea5e9', borderColor: '#e0f2fe', backgroundColor: '#f0f9ff' }} onClick={() => setShowBulkEdit(true)}>
                            一括編集
                        </button>
                        <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }} onClick={handleDeleteSelected}>
                            <Trash size={18} />
                            {selectedIds.length}件を削除
                        </button>
                    </div>
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

            <div className="card table-container" style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
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
                                            value={filters[col.key] || ''}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setFilters({ ...filters, [col.key]: e.target.value })}
                                            className="input-field"
                                            style={{ width: '100%', padding: '4px 6px', fontSize: '11px', height: 'auto', minHeight: '24px' }}
                                        />
                                    </th>
                                );
                            })}
                            <th style={{ position: 'sticky', top: 0, right: 0, background: '#f8fafc', zIndex: 30, width: '40px', borderBottom: '1px solid #e2e8f0' }}></th>
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
                                                val = <a href={customer.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0ea5e9' }}>{customer.website}</a>;
                                            } else if (col.key === 'sns_x' && customer.sns_x) {
                                                val = <a href={customer.sns_x.startsWith('http') ? customer.sns_x : `https://x.com/${customer.sns_x}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0ea5e9' }}>{customer.sns_x}</a>;
                                            } else if (col.key === 'exchanger' && customer.exchanger && customer.exchanger !== '-') {
                                                val = <span style={{ ...getChipStyleForExchanger(customer.exchanger), padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>{customer.exchanger}</span>;
                                            }

                                            const isStickyX = col.key === 'exchanger' || col.key === 'name';
                                            const left = col.key === 'exchanger' ? '60px' : col.key === 'name' ? '200px' : undefined;

                                            return (
                                                <td key={col.key} style={{ minWidth: col.width, maxWidth: col.width, position: isStickyX ? 'sticky' : undefined, left: left, background: isStickyX ? rowBg : undefined, zIndex: isStickyX ? 20 : undefined, boxShadow: isStickyX && col.key === 'name' ? '4px 0 6px -2px rgba(0,0,0,0.05)' : undefined }}>
                                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: col.width }} title={String(customer[col.key] || '')}>
                                                        {val}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td style={{ position: 'sticky', right: 0, background: rowBg, zIndex: 10, paddingRight: '1rem' }} onClick={e => e.stopPropagation()}>
                                            <button className="icon-btn danger" onClick={async () => {
                                                if (window.confirm('この連絡先を削除しますか？')) {
                                                    await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
                                                    fetchCustomers();
                                                }
                                            }}><Trash size={16} /></button>
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
