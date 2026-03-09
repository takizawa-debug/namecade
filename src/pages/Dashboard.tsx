import { useState, useEffect } from 'react';
import { Search, Filter, Edit, Trash, Cloud, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

interface SyncLog {
    id: string;
    fileName: string;
    status: 'pending' | 'downloading' | 'parsing' | 'saving' | 'completed' | 'error';
    result?: any;
    errorMsg?: string;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync state
    const [syncing, setSyncing] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
    const [progressStats, setProgressStats] = useState({ total: 0, current: 0 });

    useEffect(() => {
        fetchCustomers();
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

    const updateLog = (id: string, updates: Partial<SyncLog>) => {
        setLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
    };

    const handleDriveSync = async () => {
        if (syncing) return;
        setSyncing(true);
        setShowSyncPanel(true);
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
            setLogs(initialLogs);
            setProgressStats({ total: files.length, current: 0 });

            let newCustomersFound = false;

            // 2. Process each file one by one
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProgressStats(prev => ({ ...prev, current: i + 1 }));

                try {
                    // Download
                    updateLog(file.id, { status: 'downloading' });
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
                    updateLog(file.id, { status: 'parsing' });
                    const promptText = `あなたはプロフェッショナルな名刺情報抽出・分析アシスタントです。提供された名刺画像（表裏両面が含まれている場合もあります）から、以下の情報を日本語を最優先して極めて高い精度で抽出し、指定されたJSON構造のみを出力してください。

抽出と同時に、取得した総合的な情報から、相手がどのような組織・業種に属しているか、どのような役立つ接点（ビジネスチャンスなど）が持てそうか等について「AI分析コメント（150文字程度）」を作成し、\`aiAnalysis\`フィールドに格納してください。裏面の情報も加味してください。WEBサイトのURLやQRコード等があればそれも抽出してください。

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

                    updateLog(file.id, { status: 'saving', result: extracted });

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

                    // Move file in Google Drive
                    const moveRes = await fetch('/api/drive/move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id })
                    });

                    if (!moveRes.ok) {
                        const moveErr = await moveRes.json();
                        throw new Error(`ドライブ移動エラー: ${moveErr.error || 'Unknown'}`);
                    }

                    updateLog(file.id, { status: 'completed' });
                    newCustomersFound = true;

                    if (extracted.company && !existingCompanies.includes(extracted.company)) {
                        setExistingCompanies([...existingCompanies, extracted.company]);
                    }

                } catch (err: any) {
                    console.error("File processing failed: ", file.name, err);
                    updateLog(file.id, { status: 'error', errorMsg: err.message || String(err) });
                }
            }

            if (newCustomersFound) {
                fetchCustomers(); // Refresh the list after all are done
            }

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

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="dashboard-page animate-fade-in">
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
                <button className="btn-secondary">
                    <Filter size={18} />
                    フィルター
                </button>
            </div>

            <div className="card table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>連絡先名</th>
                            <th>会社名 & 役職</th>
                            <th>事業区分</th>
                            <th>追加日</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><Loader size={24} className="spin text-muted" style={{ margin: '0 auto' }} /></td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><span className="text-muted">データが見つかりません。</span></td></tr>
                        ) : (
                            filteredCustomers.map((customer: any) => (
                                <tr key={customer.id} onClick={() => navigate(`/customer/${customer.id}`)} className="clickable-row">
                                    <td>
                                        <div className="contact-info">
                                            <div>
                                                <div className="font-medium">{customer.name || '不明'}</div>
                                                <div className="text-small text-muted">{customer.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="font-medium">{customer.company}</div>
                                        <div className="text-small text-muted">{customer.role}</div>
                                    </td>
                                    <td>
                                        <span className="badge">{customer.business_category || '未設定'}</span>
                                    </td>
                                    <td>{new Date(customer.addedAt || customer.added_at || Date.now()).toLocaleDateString()}</td>
                                    <td>
                                        <div className="row-actions" onClick={e => e.stopPropagation()}>
                                            <button className="icon-btn"><Edit size={16} /></button>
                                            <button className="icon-btn danger"><Trash size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
