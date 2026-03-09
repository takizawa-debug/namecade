import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, Save, Camera, FileText, ArrowRight, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';
import './Scanner.css';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface ScanItem {
    id: number;
    file_name: string;
    image_url: string;
    status: 'pending' | 'completed' | 'error';
    customer_id?: number;
    created_at: string;
}

const Scanner: React.FC = () => {
    const navigate = useNavigate();
    const [scans, setScans] = useState<ScanItem[]>([]);
    const [loadingLibrary, setLoadingLibrary] = useState(true);
    const [mode, setMode] = useState<'library' | 'camera' | 'parsing'>('library');

    // Parsing state
    const [currentParseScan, setCurrentParseScan] = useState<ScanItem | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any | null>(null);
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchLibrary();
        fetchExistingCompanies();
    }, []);

    const fetchLibrary = async () => {
        try {
            const res = await fetch('/api/scans');
            const data = await res.json();
            setScans(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLibrary(false);
        }
    };

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

    const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                await uploadSingleFile(files[i]);
            }
            await fetchLibrary();
        } catch (error) {
            console.error("Batch upload failed", error);
            alert("複数ファイルのアップロード中にエラーが発生しました。");
        } finally {
            setUploading(false);
            e.target.value = ''; // reset
        }
    };

    const uploadSingleFile = async (file: File) => {
        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: file,
            headers: { 'Content-Type': file.type }
        });
        if (uploadRes.ok) {
            const { url, filename } = await uploadRes.json();
            await fetch('/api/scans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_name: filename, image_url: url, status: 'pending' })
            });
        }
    };

    const handleCameraCapture = async (file: File) => {
        setUploading(true);
        try {
            await uploadSingleFile(file);
            await fetchLibrary();
            setMode('library');
        } catch (error) {
            console.error("Upload failed", error);
            alert("アップロードに失敗しました。");
        } finally {
            setUploading(false);
        }
    };

    const startParsing = async (scan: ScanItem) => {
        setCurrentParseScan(scan);
        setMode('parsing');
        setIsScanning(true);
        setScanResult(null);

        try {
            if (!GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY is missing. Please set it in .env.local.");
            }

            // Fetch the image to get base64
            const imgRes = await fetch(scan.image_url);
            const blob = await imgRes.blob();
            const base64Data = await toBase64(blob);

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

            let mimeType = blob.type;
            const ext = scan.file_name.toLowerCase().split('.').pop();
            if (ext === 'pdf') mimeType = 'application/pdf';
            else if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'image/jpeg';

            const payload = {
                contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
                generationConfig: { temperature: 0.0 }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (textOutput) {
                const cleanedText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                const extractedJson = JSON.parse(cleanedText);
                setScanResult(extractedJson);
            } else {
                throw new Error("No data returned from AI.");
            }
        } catch (error) {
            console.error("Scanning failed", error);
            alert("Failed to extract data: " + (error as Error).message);
        } finally {
            setIsScanning(false);
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

    const handleSaveParsed = async () => {
        if (!scanResult || !currentParseScan) return;

        try {
            const customerData = {
                ...scanResult,
                imageUrl: currentParseScan.file_name // Save the file_name as imageUrl in customer db
            };

            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });

            if (response.ok) {
                const data = await response.json();

                // Update scan status to completed
                await fetch(`/api/scans/${currentParseScan.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'completed', customer_id: data.id })
                });

                setMode('library');
                fetchLibrary(); // refresh
            } else {
                alert('連絡先の保存に失敗しました。');
            }
        } catch (error) {
            console.error("Save failed", error);
            alert("エラーが発生しました。");
        }
    };

    const deleteScan = async (id: number) => {
        if (!window.confirm("このスキャンを削除してもよろしいですか？")) return;
        await fetch(`/api/scans/${id}`, { method: 'DELETE' });
        fetchLibrary();
    };


    if (mode === 'camera') {
        return <div className="scanner-page animate-fade-in"><CameraCapture onCaptureComplete={handleCameraCapture} onCancel={() => setMode('library')} /></div>;
    }

    if (mode === 'parsing' && currentParseScan) {
        return (
            <div className="scanner-page animate-fade-in">
                <header className="page-header sticky-header">
                    <div>
                        <h2>名刺解析</h2>
                        <p className="subtitle">AIが抽出した内容を確認・修正して保存してください</p>
                    </div>
                    <button className="btn-secondary" onClick={() => setMode('library')}>ライブラリに戻る</button>
                </header>

                <div className="scanner-layout">
                    <div className="card upload-section" style={{ alignSelf: 'start', position: 'sticky', top: '100px' }}>
                        <h3>元画像</h3>
                        <div className="image-preview" style={{ marginTop: '16px' }}>
                            {currentParseScan.image_url.endsWith('.pdf') ? (
                                <embed src={currentParseScan.image_url} type="application/pdf" width="100%" height="400px" style={{ borderRadius: '8px' }} />
                            ) : (
                                <img src={currentParseScan.image_url} alt="Scan preview" />
                            )}
                        </div>
                    </div>

                    <div className="card result-section">
                        <h3>抽出情報</h3>
                        {isScanning && (
                            <div className="scanning-state">
                                <div className="scan-loader"></div>
                                <p>AIで情報を抽出中...</p>
                            </div>
                        )}

                        {scanResult && !isScanning && (
                            <div className="extracted-data animate-fade-in">
                                <div className="success-banner">
                                    <CheckCircle size={20} className="icon-success" />
                                    <span>解析完了。内容を修正し保存してください。</span>
                                </div>

                                <div className="form-grid">
                                    <div className="input-group">
                                        <span className="input-label">氏名</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.name} onChange={(e) => setScanResult({ ...scanResult, name: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">氏名（ローマ字）</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.name_romaji || ''} onChange={(e) => setScanResult({ ...scanResult, name_romaji: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">会社名</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.company} onChange={(e) => setScanResult({ ...scanResult, company: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">部署</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.department || ''} onChange={(e) => setScanResult({ ...scanResult, department: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">役職</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.role} onChange={(e) => setScanResult({ ...scanResult, role: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">メールアドレス</span>
                                        <input type="email" className="input-field" defaultValue={scanResult.email} onChange={(e) => setScanResult({ ...scanResult, email: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">固定電話</span>
                                        <input type="tel" className="input-field" defaultValue={scanResult.phone} onChange={(e) => setScanResult({ ...scanResult, phone: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">携帯電話</span>
                                        <input type="tel" className="input-field" defaultValue={scanResult.phone_mobile || ''} onChange={(e) => setScanResult({ ...scanResult, phone_mobile: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">FAX</span>
                                        <input type="tel" className="input-field" defaultValue={scanResult.fax || ''} onChange={(e) => setScanResult({ ...scanResult, fax: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">郵便番号</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.postal_code || ''} onChange={(e) => setScanResult({ ...scanResult, postal_code: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">都道府県</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.prefecture || ''} onChange={(e) => setScanResult({ ...scanResult, prefecture: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">市区町村</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.city || ''} onChange={(e) => setScanResult({ ...scanResult, city: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">番地</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.address_line1 || ''} onChange={(e) => setScanResult({ ...scanResult, address_line1: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">建物名・階</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.address_line2 || ''} onChange={(e) => setScanResult({ ...scanResult, address_line2: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">WEBサイト</span>
                                        <input type="url" className="input-field" defaultValue={scanResult.website} onChange={(e) => setScanResult({ ...scanResult, website: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">X(Twitter)</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.sns_x || ''} onChange={(e) => setScanResult({ ...scanResult, sns_x: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">Facebook</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.sns_facebook || ''} onChange={(e) => setScanResult({ ...scanResult, sns_facebook: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">Instagram</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.sns_instagram || ''} onChange={(e) => setScanResult({ ...scanResult, sns_instagram: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">LinkedIn</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.sns_linkedin || ''} onChange={(e) => setScanResult({ ...scanResult, sns_linkedin: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <span className="input-label">その他のSNS</span>
                                        <input type="text" className="input-field" defaultValue={scanResult.sns_other || ''} onChange={(e) => setScanResult({ ...scanResult, sns_other: e.target.value })} />
                                    </div>
                                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                        <span className="input-label">AI分析コメント</span>
                                        <textarea
                                            className="input-field"
                                            rows={3}
                                            defaultValue={scanResult.aiAnalysis}
                                            onChange={(e) => setScanResult({ ...scanResult, aiAnalysis: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="action-row">
                                    <button className="btn-secondary" onClick={() => setMode('library')}>キャンセル</button>
                                    <button className="btn-primary" onClick={handleSaveParsed}>
                                        <Save size={18} /> 名刺リストに保存
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // mode === 'library'
    return (
        <div className="scanner-page animate-fade-in">
            <header className="page-header sticky-header">
                <div>
                    <h2>スキャンライブラリ</h2>
                    <p className="subtitle">撮影・アップロードした名刺の一括管理</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={() => setMode('camera')}>
                        <Camera size={18} /> その場で撮影
                    </button>
                    <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {uploading ? <Loader size={18} className="spin" /> : <UploadCloud size={18} />}
                        一括アップロード (JPG/PDF)
                        <input type="file" multiple accept="image/*,application/pdf" onChange={handleBatchUpload} hidden disabled={uploading} />
                    </label>
                </div>
            </header>

            <div className="library-content">
                {loadingLibrary ? (
                    <div className="empty-state">読み込み中...</div>
                ) : scans.length === 0 ? (
                    <div className="empty-state card">
                        <FileText size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                        <p>スキャンされた名刺がありません。画像を追加してください。</p>
                    </div>
                ) : (
                    <div className="scan-grid">
                        {scans.map(scan => (
                            <div key={scan.id} className={`scan-card ${scan.status}`}>
                                <div className="scan-thumbnail">
                                    {scan.image_url.endsWith('.pdf') ? (
                                        <div className="pdf-placeholder"><FileText size={32} /></div>
                                    ) : (
                                        <img src={scan.image_url} alt="Scan thumbnail" />
                                    )}
                                    <span className={`status-badge ${scan.status}`}>
                                        {scan.status === 'pending' ? '未解析' : '登録済み'}
                                    </span>
                                </div>
                                <div className="scan-actions">
                                    <span className="file-date">{new Date(scan.created_at).toLocaleDateString()}</span>
                                    {scan.status === 'pending' ? (
                                        <button className="btn-primary btn-sm" onClick={() => startParsing(scan)}>
                                            解析する <ArrowRight size={14} />
                                        </button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn-secondary btn-sm" onClick={() => navigate(`/customer/${scan.customer_id}`)}>
                                                詳細を開く
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="scan-delete">
                                    <button className="btn-icon text-muted" onClick={() => deleteScan(scan.id)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Scanner;
