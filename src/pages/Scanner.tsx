import React, { useState, useEffect } from 'react';
import { CheckCircle, Cloud, Loader, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Scanner.css';

interface SyncLog {
    id: string;
    fileName: string;
    mimeType: string;
    status: 'pending' | 'downloading' | 'parsing' | 'saving' | 'completed' | 'error';
    result?: any;
    errorMsg?: string;
}

const Scanner: React.FC = () => {
    const navigate = useNavigate();
    const [syncing, setSyncing] = useState(false);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
    const [progressStats, setProgressStats] = useState({ total: 0, current: 0 });

    useEffect(() => {
        fetchExistingCompanies();
    }, []);

    const fetchExistingCompanies = async () => {
        try {
            const res = await fetch('/api/customers');
            const data = await res.json();
            const companies = data.map((c: any) => c.company).filter((c: string) => c && c.trim() !== '');
            setExistingCompanies([...new Set(companies)] as string[]);
        } catch (e) {
            console.error(e);
        }
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
                alert("Googleドライブの未登録フォルダにファイルがありません。");
                setSyncing(false);
                return;
            }

            const initialLogs: SyncLog[] = files.map((f: any) => ({
                id: f.id,
                fileName: f.name,
                mimeType: f.mimeType,
                status: 'pending'
            }));
            setLogs(initialLogs);
            setProgressStats({ total: files.length, current: 0 });

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
                        // Error code handling
                        if (parseData.error && parseData.error.includes && parseData.error.includes("leaked")) {
                            throw new Error("Gemini APIキーが無効化されています。別のキーを使用してください。");
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
                    if (!saveRes.ok) throw new Error("Failed to save customer");

                    await fetch('/api/drive/move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id })
                    });

                    updateLog(file.id, { status: 'completed' });

                    if (extracted.company && !existingCompanies.includes(extracted.company)) {
                        setExistingCompanies([...existingCompanies, extracted.company]);
                    }

                } catch (err: any) {
                    console.error("File processing failed: ", file.name, err);
                    updateLog(file.id, { status: 'error', errorMsg: err.message || String(err) });
                }
            }

            alert("Google Driveの同期・解析が完了しました！");

        } catch (error) {
            console.error("Drive list failed", error);
            alert("同期中にエラーが発生しました。\n" + (error as Error).message);
        } finally {
            setSyncing(false);
        }
    };

    const getStatusBadge = (status: SyncLog['status']) => {
        switch (status) {
            case 'pending': return <span className="status-badge pending">待機中</span>;
            case 'downloading': return <span className="status-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}><Loader size={12} className="spin" style={{ marginRight: '4px' }} /> ダウンロード</span>;
            case 'parsing': return <span className="status-badge" style={{ background: '#fef08a', color: '#854d0e' }}><Loader size={12} className="spin" style={{ marginRight: '4px' }} /> 解析中</span>;
            case 'saving': return <span className="status-badge" style={{ background: '#dcfce7', color: '#166534' }}><Loader size={12} className="spin" style={{ marginRight: '4px' }} /> 保存中</span>;
            case 'completed': return <span className="status-badge completed"><CheckCircle size={12} style={{ marginRight: '4px' }} /> 完了</span>;
            case 'error': return <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b' }}><AlertCircle size={12} style={{ marginRight: '4px' }} /> エラー</span>;
        }
    };

    return (
        <div className="scanner-page animate-fade-in">
            <header className="page-header sticky-header">
                <div>
                    <h2>名刺自動解析ダッシュボード</h2>
                    <p className="subtitle">Googleドライブから名刺を同期し、全自動で解析・登録を行います。</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-primary" onClick={handleDriveSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {syncing ? <Loader size={18} className="spin" /> : <Cloud size={18} />}
                        {syncing ? `同期中 (${progressStats.current}/${progressStats.total})` : 'Googleドライブと同期'}
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/')} disabled={syncing}>
                        一覧に戻る
                    </button>
                </div>
            </header>

            <div className="library-content" style={{ marginTop: '20px' }}>
                {logs.length === 0 ? (
                    <div className="empty-state card">
                        <Cloud size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                        <p>ボタンを押すとGoogleドライブの解析を開始します。</p>
                    </div>
                ) : (
                    <div className="sync-logs-container card">
                        <h3>解析ログ</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 8px', color: '#64748b', fontSize: '13px' }}>ファイル名</th>
                                    <th style={{ padding: '12px 8px', color: '#64748b', fontSize: '13px', width: '120px' }}>ステータス</th>
                                    <th style={{ padding: '12px 8px', color: '#64748b', fontSize: '13px' }}>抽出結果</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 8px', fontSize: '14px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {log.fileName}
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>{getStatusBadge(log.status)}</td>
                                        <td style={{ padding: '12px 8px', fontSize: '14px', color: '#334155' }}>
                                            {log.status === 'error' ? (
                                                <span style={{ color: '#ef4444' }}>{log.errorMsg}</span>
                                            ) : log.result ? (
                                                <span>
                                                    <strong>{log.result.company}</strong> {log.result.name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#cbd5e1' }}>待機中</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Scanner;
