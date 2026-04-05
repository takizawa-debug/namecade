import React, { createContext, useState, useEffect, useRef } from 'react';
import SyncPanel from '../components/SyncPanel';
import { buildParsePrompt } from '../constants/ai-prompt';
import { customersApi, driveApi, parseApi } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface SyncLog {
    id: string;
    fileName: string;
    status: 'pending' | 'downloading' | 'parsing' | 'saving' | 'completed' | 'skipped' | 'error';
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
    handleForceReset: () => void;
    setShowSyncPanel: (show: boolean) => void;
}

export const SyncContext = createContext<SyncContextType | null>(null);

// ─── Helpers ────────────────────────────────────────────────────────────────
const toBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
    });

const SYNC_STATE_KEY = 'namecard_sync_state';

// ─── Provider ───────────────────────────────────────────────────────────────
export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [syncing, setSyncing] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [progressStats, setProgressStats] = useState({ total: 0, current: 0 });
    const [latestProcessedTime, setLatestProcessedTime] = useState(Date.now());
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
    const wakeLockRef = useRef<any>(null);
    const isSyncingRef = useRef(false);

    // ── Wake Lock management ──────────────────────────────────────────
    useEffect(() => {
        const requestWakeLock = async () => {
            if (syncing && 'wakeLock' in navigator) {
                try {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                } catch (err) {
                    console.error('Wake Lock error:', err);
                }
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current) {
                try { await wakeLockRef.current.release(); } catch (_) {}
                wakeLockRef.current = null;
            }
        };

        if (syncing) { requestWakeLock(); } else { releaseWakeLock(); }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && syncing) requestWakeLock();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => { releaseWakeLock(); document.removeEventListener('visibilitychange', handleVisibility); };
    }, [syncing]);

    // ── Initial load + resume ─────────────────────────────────────────
    useEffect(() => {
        customersApi.getAll()
            .then(data => {
                if (Array.isArray(data)) {
                    setExistingCompanies([...new Set(data.map(c => c.company).filter(Boolean))]);
                }
            })
            .catch(console.error);

        const saved = sessionStorage.getItem(SYNC_STATE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (state?.isRunning && state.files && state.currentIndex < state.files.length) {
                    startOrResumeSync(true, state);
                } else {
                    sessionStorage.removeItem(SYNC_STATE_KEY);
                }
            } catch { sessionStorage.removeItem(SYNC_STATE_KEY); }
        }
    }, []);

    // ── Public actions ────────────────────────────────────────────────
    const handleDriveSync = () => startOrResumeSync(false, null);

    const handleForceReset = async () => {
        if (!confirm('実行中のすべての同期を強制キャンセルし、システムロックを解除します。よろしいですか？')) return;
        isSyncingRef.current = false;
        setSyncing(false);
        setShowSyncPanel(false);
        sessionStorage.removeItem(SYNC_STATE_KEY);
        setLogs([]);
        setProgressStats({ total: 0, current: 0 });
        try {
            await driveApi.releaseAllClaims();
            alert('すべてのシステムロックと処理中の状態を強制リセットしました。');
        } catch (err) {
            console.error("Lock reset failed", err);
            alert('リセット中にエラーが発生しました。');
        }
    };

    const handleStop = () => {
        isSyncingRef.current = false;
        setSyncing(false);
        setShowSyncPanel(false);
        sessionStorage.removeItem(SYNC_STATE_KEY);
    };

    // ── Core sync loop ────────────────────────────────────────────────
    const startOrResumeSync = async (isResume = false, savedState: any = null) => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        setSyncing(true);
        setShowSyncPanel(true);

        let totalProcessedInSession = 0;
        let hasCheckedAtLeastOnce = false;

        try {
            while (isSyncingRef.current) {
                let currentState: any;

                if (isResume && savedState) {
                    currentState = savedState;
                    setLogs(currentState.logs);
                    setProgressStats({ total: currentState.files.length, current: currentState.currentIndex });
                    isResume = false;
                } else {
                    setLogs([]);
                    setProgressStats({ total: 0, current: totalProcessedInSession });

                    const listData = await driveApi.list();
                    if (!listData.success) throw new Error(listData.error);

                    const files = listData.files || [];
                    if (files.length === 0) {
                        if (totalProcessedInSession === 0 && !hasCheckedAtLeastOnce) {
                            alert('Googleドライブの「未登録」フォルダに新しい名刺画像がありません。');
                        } else if (totalProcessedInSession > 0) {
                            alert(`全ての同期・解析が完了しました！\n(処理/スキップ合計: ${totalProcessedInSession}枚)`);
                        }
                        setShowSyncPanel(false);
                        break;
                    }

                    hasCheckedAtLeastOnce = true;
                    const initialLogs: SyncLog[] = files.map((f: any) => ({ id: f.id, fileName: f.name, status: 'pending' as const }));
                    currentState = { isRunning: true, files, logs: initialLogs, currentIndex: 0, newCustomersFound: false };
                    setLogs(initialLogs);
                    setProgressStats({ total: files.length, current: 0 });
                    sessionStorage.setItem(SYNC_STATE_KEY, JSON.stringify(currentState));
                }

                // Process each file
                for (let i = currentState.currentIndex; i < currentState.files.length; i++) {
                    if (!isSyncingRef.current) break;

                    currentState.currentIndex = i;
                    sessionStorage.setItem(SYNC_STATE_KEY, JSON.stringify(currentState));

                    const file = currentState.files[i];
                    setProgressStats(prev => ({ ...prev, current: i + 1 }));
                    totalProcessedInSession++;

                    let currentLogs = [...currentState.logs];
                    const updateLog = (status: SyncLog['status'], extra: Partial<SyncLog> = {}) => {
                        const idx = currentLogs.findIndex(l => l.id === file.id);
                        if (idx > -1) {
                            currentLogs[idx] = { ...currentLogs[idx], status, ...extra };
                            setLogs([...currentLogs]);
                            currentState.logs = currentLogs;
                            sessionStorage.setItem(SYNC_STATE_KEY, JSON.stringify(currentState));
                        }
                    };

                    try {
                        // Claim lock
                        let claimed = false;
                        try {
                            const claimData = await driveApi.claim(file.id);
                            if (claimData.success && claimData.claimed) claimed = true;
                        } catch (err) { console.error("Lock error", err); }

                        if (!claimed) { updateLog('skipped', { errorMsg: '別プロセスで処理中' }); continue; }
                        if (!isSyncingRef.current) break;

                        // Download
                        updateLog('downloading');
                        const dlData = await driveApi.download(file.id, file.name, file.mimeType);
                        if (!dlData.success) throw new Error(dlData.error);

                        const imgRes = await fetch(dlData.url);
                        const blob = await imgRes.blob();
                        const base64Data = await toBase64(blob);

                        // Parse with AI
                        updateLog('parsing');
                        const parseData = await parseApi.parse(buildParsePrompt(existingCompanies), base64Data, dlData.mimeType);
                        if (!parseData.success) {
                            if (parseData.error?.includes?.("leaked")) throw new Error("Gemini APIキーが無効化されています。");
                            throw new Error(parseData.error);
                        }
                        const extracted = parseData.data;
                        if (!extracted) throw new Error('AI解析結果が空です');
                        if (file.folderName) extracted.exchanger = file.folderName;

                        // Save
                        updateLog('saving', { result: extracted });
                        const saveData = await customersApi.create({ ...extracted, imageUrl: dlData.url, drive_file_id: file.id });
                        if (!saveData.success) throw new Error('データベースへの保存に失敗しました');

                        // Move file in Drive
                        const safeName = (extracted.name || '名前不明').replace(/[\/\\?%*:|"<>]/g, '');
                        const safeCompany = (extracted.company || '会社不明').replace(/[\/\\?%*:|"<>]/g, '');
                        const safeExchanger = (extracted.exchanger || '交換者不明').replace(/[\/\\?%*:|"<>]/g, '');
                        const ext = (file.name || '').split('.').pop() || 'pdf';
                        const duplicateTag = saveData.duplicate ? '【重複】' : '';
                        const newFileName = `${safeExchanger}_${safeName}_${safeCompany}${duplicateTag}.${ext}`;

                        const moveResult = await driveApi.move(file.id, newFileName);
                        if (!moveResult.success) {
                            throw new Error(`ドライブ移動エラー: ${moveResult.error || 'Unknown'}`);
                        }

                        if (saveData.duplicate) {
                            updateLog('skipped', { errorMsg: '内容重複（取込スキップ）' });
                        } else {
                            updateLog('completed');
                            currentState.newCustomersFound = true;
                            if (extracted.company) {
                                setExistingCompanies(prev => prev.includes(extracted.company) ? prev : [...prev, extracted.company]);
                            }
                        }
                        setLatestProcessedTime(Date.now());

                    } catch (err: any) {
                        console.error("File processing failed:", file.name, err);
                        updateLog('error', { errorMsg: err.message || String(err) });
                    } finally {
                        driveApi.releaseClaim(file.id).catch(console.error);
                    }
                }

                currentState.isRunning = false;
                currentState.currentIndex = currentState.files.length;
                sessionStorage.setItem(SYNC_STATE_KEY, JSON.stringify(currentState));
                setLatestProcessedTime(Date.now());
                sessionStorage.removeItem(SYNC_STATE_KEY);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        } catch (error) {
            console.error("Drive sync failed", error);
            alert("同期中にエラーが発生しました。\n" + (error as Error).message);
        } finally {
            isSyncingRef.current = false;
            setSyncing(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <SyncContext.Provider value={{ syncing, showSyncPanel, logs, progressStats, latestProcessedTime, handleDriveSync, handleForceReset, setShowSyncPanel }}>
            {children}
            {showSyncPanel && (
                <SyncPanel syncing={syncing} progressStats={progressStats} logs={logs} onStop={handleStop} />
            )}
        </SyncContext.Provider>
    );
};
