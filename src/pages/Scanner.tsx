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
                            { text: "Extract the following details from this business card and return ONLY a valid JSON object matching this structure: { \"name\": \"\", \"company\": \"\", \"role\": \"\", \"email\": \"\", \"phone\": \"\", \"address\": \"\" }. If a field is not found, leave it as an empty string. DO NOT use markdown formatting like ```json in the output." },
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

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
                    <h2>Scan Business Card</h2>
                    <p className="subtitle">Upload a photo to automatically extract details using AI</p>
                </div>
            </header>

            <div className="scanner-layout">
                <div className="card upload-section">
                    <h3>Card Image</h3>

                    <div className={`upload-zone ${selectedImage ? 'has-image' : ''}`}>
                        {selectedImage ? (
                            <div className="image-preview">
                                <img src={selectedImage} alt="Business Card Preview" />
                                <button className="btn-secondary retake-btn" onClick={() => setSelectedImage(null)}>
                                    <RefreshCw size={16} /> Retake
                                </button>
                            </div>
                        ) : (
                            <label className="upload-label">
                                <UploadCloud size={48} className="upload-icon" />
                                <span className="upload-text">Drag & drop or click to upload</span>
                                <span className="upload-hint">Supports JPG, PNG (Max 5MB)</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                            </label>
                        )}
                    </div>
                </div>

                <div className="card result-section">
                    <h3>Extracted Information</h3>

                    {!selectedImage && !isScanning && (
                        <div className="empty-state">
                            <p>Upload a business card to see extracted details here.</p>
                        </div>
                    )}

                    {isScanning && (
                        <div className="scanning-state">
                            <div className="scan-loader"></div>
                            <p>Extracting details with AI...</p>
                        </div>
                    )}

                    {scanResult && !isScanning && (
                        <div className="extracted-data animate-fade-in">
                            <div className="success-banner">
                                <CheckCircle size={20} className="icon-success" />
                                <span>Successfully extracted information. Please review and adjust.</span>
                            </div>

                            <div className="form-grid">
                                <div className="input-group">
                                    <span className="input-label">Full Name</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.name} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">Company</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.company} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">Role / Title</span>
                                    <input type="text" className="input-field" defaultValue={scanResult.role} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">Email</span>
                                    <input type="email" className="input-field" defaultValue={scanResult.email} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">Phone</span>
                                    <input type="tel" className="input-field" defaultValue={scanResult.phone} />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">Business Segment</span>
                                    <select className="input-field">
                                        <option value="">Select segment...</option>
                                        <option value="enterprise">Enterprise</option>
                                        <option value="smb">SMB</option>
                                        <option value="agency">Agency</option>
                                    </select>
                                </div>
                            </div>

                            <div className="action-row">
                                <button className="btn-secondary" onClick={() => setSelectedImage(null)}>Cancel</button>
                                <button className="btn-primary" onClick={handleSave}>
                                    <Save size={18} /> Save Contact
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
