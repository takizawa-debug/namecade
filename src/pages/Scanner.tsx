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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
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
                // Strip the data:image prefix to get raw base64
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

            const payload = {
                contents: [
                    {
                        parts: [
                            { text: "Extract the following details from this business card and return ONLY a valid JSON object matching this structure: { \"name\": \"\", \"company\": \"\", \"role\": \"\", \"email\": \"\", \"phone\": \"\", \"address\": \"\" }. For Japanese cards, properly extract Japanese text. If a field is not found, leave it as an empty string. DO NOT use markdown formatting like ```json in the output." },
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
                    temperature: 0.1, // Low temperature for factual extraction
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
                // Parse the JSON. We might need to clean it if the model adds markdown
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

    const handleSave = () => {
        // In a real app, send to Cloudflare D1
        navigate('/dashboard');
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
                                    <input type="text" className="input-field" defaultValue={scanResult.name} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">会社名</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.company} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">役職</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.role} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">メールアドレス</span>
                                    <input type="email" className="input-field" defaultValue={scanResult.email} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">電話番号</span>
                                    <input type="tel" className="input-field" defaultValue={scanResult.phone} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">事業セグメント</span>
                                    <select className="input-field">
                                        <option value="">セグメントを選択...</option>
                                        <option value="大企業">大企業</option>
                                        <option value="中小企業">中小企業</option>
                                        <option value="代理店">代理店</option>
                                    </select>
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
