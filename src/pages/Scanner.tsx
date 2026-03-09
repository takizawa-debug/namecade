import React, { useState } from 'react';
import { UploadCloud, CheckCircle, RefreshCw, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Scanner.css';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const Scanner: React.FC = () => {
    const navigate = useNavigate();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any | null>(null);
    const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    React.useEffect(() => {
        // Fetch existing customers to build a unique list of companies
        fetch('/api/customers')
            .then(res => res.json())
            .then(data => {
                const companies = data
                    .map((c: any) => c.company)
                    .filter((c: string) => c && c.trim() !== '');
                setExistingCompanies([...new Set(companies)] as string[]);
            })
            .catch(err => console.error('Failed to load companies for auto-complete', err));
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const imageUrl = URL.createObjectURL(file);
            setSelectedImage(imageUrl);
            performRealScan(file);
        }
    };

    const toBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });
    };

    const performRealScan = async (file: File) => {
        setIsScanning(true);
        setScanResult(null);

        try {
            if (!GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY is missing. Please set it in .env.local.");
            }

            const base64Data = await toBase64(file);

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

            const payload = {
                contents: [
                    {
                        parts: [
                            { text: promptText },
                            {
                                inline_data: {
                                    mime_type: file.type,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.0,
                }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
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

    const handleSave = async () => {
        if (!scanResult) return;

        try {
            let uploadedFilename = '';

            // Upload the image first if it exists
            if (selectedFile) {
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: selectedFile, // send raw file
                    headers: {
                        'Content-Type': selectedFile.type
                    }
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    uploadedFilename = uploadData.filename;
                }
            }

            // Save the customer data including the image URL
            const customerData = {
                ...scanResult,
                imageUrl: uploadedFilename
            };

            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });

            if (response.ok) {
                navigate('/dashboard');
            } else {
                alert('連絡先の保存に失敗しました。');
            }
        } catch (error) {
            console.error("Save failed", error);
            alert("エラーが発生しました。");
        }
    };

    return (
        <div className="scanner-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h2>名刺をスキャン</h2>
                    <p className="subtitle">写真をアップロードして、AIで自動的に詳細を抽出します</p>
                </div>
            </header>

            <div className="scanner-layout">
                <div className="card upload-section">
                    <h3>名刺画像</h3>

                    <div className={`upload-zone ${selectedImage ? 'has-image' : ''}`}>
                        {selectedImage ? (
                            <div className="image-preview">
                                <img src={selectedImage} alt="Business Card Preview" />
                                <button className="btn-secondary retake-btn" onClick={() => setSelectedImage(null)}>
                                    <RefreshCw size={16} /> 撮り直す
                                </button>
                            </div>
                        ) : (
                            <label className="upload-label">
                                <UploadCloud size={48} className="upload-icon" />
                                <span className="upload-text">ドラッグ＆ドロップ、またはクリックしてアップロード</span>
                                <span className="upload-hint">対応形式: JPG, PNG (最大5MB)</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                            </label>
                        )}
                    </div>
                </div>

                <div className="card result-section">
                    <h3>抽出情報</h3>

                    {!selectedImage && !isScanning && (
                        <div className="empty-state">
                            <p>名刺をアップロードすると、ここに抽出された詳細が表示されます。</p>
                        </div>
                    )}

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
                                <span>情報の抽出に成功しました。内容を確認して適宜修正してください。</span>
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
                                <div className="input-group">
                                    <span className="input-label">事業区分</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.business_category || ''} onChange={(e) => setScanResult({ ...scanResult, business_category: e.target.value })} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">タグ</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.tags || ''} onChange={(e) => setScanResult({ ...scanResult, tags: e.target.value })} />
                                </div>
                                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                    <span className="input-label">交換者</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.exchanger || ''} onChange={(e) => setScanResult({ ...scanResult, exchanger: e.target.value })} />
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
                                <button className="btn-secondary" onClick={() => setSelectedImage(null)}>キャンセル</button>
                                <button className="btn-primary" onClick={handleSave}>
                                    <Save size={18} /> 連絡先を保存
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Scanner;
