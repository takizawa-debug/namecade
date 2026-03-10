import React, { createContext, useState, useEffect } from 'react';

export interface SyncLog {
    id: string;
    fileName: string;
    status: 'pending' | 'downloading' | 'parsing' | 'saving' | 'completed' | 'error';
    result?: any;
    errorMsg?: string;
}

interface SyncContextType {
    syncing: boolean;
    showSyncPanel: boolean;
    logs: SyncLog[];
    progressStats: { total: number; current: number };
    latestProcessedTime: number;
    handleDriveSync: () => void;
    setShowSyncPanel: (show: boolean) => void;
}

export const SyncContext = createContext<SyncContextType | null>(null);

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

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [syncing, setSyncing] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [progressStats, setProgressStats] = useState({ total: 0, current: 0 });
    const [latestProcessedTime, setLatestProcessedTime] = useState(Date.now());

    // We keep existingCompanies just like Dashboard did, to feed into AI
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);

    useEffect(() => {
        // Fetch existing companies once to initialize
        fetch('/api/customers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const companies = data.map((c: any) => c.company).filter((c: string) => c && c.trim() !== '');
                    setExistingCompanies([...new Set(companies)] as string[]);
                }
            })
            .catch(err => console.error(err));

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
                const listRes = await fetch('/api/drive/list');
                if (!listRes.ok) throw new Error(await listRes.text());
                const listData = await listRes.json();

                if (!listData.success) throw new Error(listData.error);

                const files = listData.files || [];
                if (files.length === 0) {
                    alert('Googleドライブの「未登録」フォルダに新しい名刺画像がありません。');
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
                console.error('Failed to fetch list', err);
                alert('リスト取得中にエラーが発生しました。');
                setSyncing(false);
                setShowSyncPanel(false);
                return;
            }
        }

        try {
            for (let i = currentState.currentIndex; i < currentState.files.length; i++) {
                currentState.currentIndex = i;
                localStorage.setItem('namecard_sync_state', JSON.stringify(currentState));

                const file = currentState.files[i];
                setProgressStats(prev => ({ ...prev, current: i + 1 }));

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
                    updateLogLocal('downloading');
                    const dlRes = await fetch('/api/drive/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id, fileName: file.name, mimeType: file.mimeType })
                    });
                    if (!dlRes.ok) throw new Error(await dlRes.text());
                    const dlData = await dlRes.json();
                    if (!dlData.success) throw new Error(dlData.error);

                    const imgRes = await fetch(dlData.url);
                    const blob = await imgRes.blob();
                    const base64Data = await toBase64(blob);

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

                    if (extracted.company) {
                        setExistingCompanies(prev => prev.includes(extracted.company) ? prev : [...prev, extracted.company]);
                    }

                    // 1枚完了するごとに、Dashboard側がテーブルを更新できるようタイムスタンプを更新する
                    setLatestProcessedTime(Date.now());

                } catch (err: any) {
                    console.error("File processing failed: ", file.name, err);
                    updateLogLocal('error', { errorMsg: err.message || String(err) });
                }
            }

            currentState.isRunning = false;
            currentState.currentIndex = currentState.files.length;
            localStorage.setItem('namecard_sync_state', JSON.stringify(currentState));

            setLatestProcessedTime(Date.now());
            localStorage.removeItem('namecard_sync_state');

            alert("Google Driveの同期・解析が完了しました！");

        } catch (error) {
            console.error("Drive sync failed", error);
            alert("同期中にエラーが発生しました。\n" + (error as Error).message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <SyncContext.Provider value={{ syncing, showSyncPanel, logs, progressStats, latestProcessedTime, handleDriveSync, setShowSyncPanel }}>
            {children}

            {showSyncPanel && (
                <div className="sync-overlay card animate-fade-in" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, width: 450, padding: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>クラウド同期・自動解析状況</h3>
                        {!syncing && (
                            <button className="btn-secondary btn-sm" onClick={() => setShowSyncPanel(false)}>
                                閉じる
                            </button>
                        )}
                    </div>
                    <div style={{ paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
                        <span style={{ fontSize: 14, fontWeight: 'bold' }}>処理中: {progressStats.current} / {progressStats.total} 枚</span>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '6px', fontSize: '12px', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.fileName}>
                                            {log.fileName}
                                        </td>
                                        <td style={{ padding: '6px', fontSize: '12px' }}>
                                            {log.status === 'pending' ? <span style={{ color: '#94a3b8' }}>待機中</span> :
                                                log.status === 'downloading' ? <span style={{ color: '#0369a1' }}>取得中</span> :
                                                    log.status === 'parsing' ? <span style={{ color: '#854d0e' }}>解析中</span> :
                                                        log.status === 'saving' ? <span style={{ color: '#166534' }}>保存中</span> :
                                                            log.status === 'completed' ? <span style={{ color: '#10b981' }}>完了</span> :
                                                                log.status === 'error' ? <span style={{ color: '#ef4444' }}>エラー</span> : ''}
                                        </td>
                                        <td style={{ padding: '6px', fontSize: '12px', color: '#334155', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.status === 'error' ? (
                                                <span style={{ color: '#ef4444' }} title={log.errorMsg}>{log.errorMsg}</span>
                                            ) : log.result ? (
                                                <span title={`${log.result.company} ${log.result.name}`}>
                                                    <strong>{log.result.company}</strong> {log.result.name}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </SyncContext.Provider>
    );
};
