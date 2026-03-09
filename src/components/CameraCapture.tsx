import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { jsPDF } from 'jspdf';
import { Camera, RefreshCw, CheckCircle, FilePlus, ArrowLeft, Save } from 'lucide-react';
import './CameraCapture.css';

interface CameraCaptureProps {
    onCaptureComplete: (file: File) => void;
    onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCaptureComplete, onCancel }) => {
    const webcamRef = useRef<Webcam>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [images, setImages] = useState<string[]>([]);
    const [currentCapture, setCurrentCapture] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        // Default crop: center, 90% of width, somewhat a business card aspect ratio (e.g. 16:9 or 9:5)
        const crop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 90,
                },
                1.6, // typical business card ratio ~91/55
                width,
                height
            ),
            width,
            height
        );
        setCrop(crop);
    };

    const getCroppedImg = async (imageSrc: string, pixelCrop: PixelCrop): Promise<string> => {
        const image = new Image();
        image.src = imageSrc;
        await new Promise(r => image.onload = r);

        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return imageSrc;

        ctx.drawImage(
            image,
            pixelCrop.x * scaleX,
            pixelCrop.y * scaleY,
            pixelCrop.width * scaleX,
            pixelCrop.height * scaleY,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return canvas.toDataURL('image/jpeg', 0.9);
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCurrentCapture(imageSrc);
        }
    }, [webcamRef]);

    const handleConfirmCrop = async () => {
        if (!currentCapture) return;

        let finalImage = currentCapture;
        try {
            if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
                finalImage = await getCroppedImg(currentCapture, completedCrop);
            }
        } catch (e) {
            console.error('Failed to crop image', e);
        }

        setImages([...images, finalImage]);
        setCurrentCapture(null);
        setCrop(undefined);
        setCompletedCrop(undefined);
    };

    const retake = () => {
        setCurrentCapture(null);
        setCrop(undefined);
        setCompletedCrop(undefined);
    };

    const finishAndCreatePDF = async () => {
        if (images.length === 0) return;

        if (images.length === 1) {
            // Just return a jpeg
            const res = await fetch(images[0]);
            const blob = await res.blob();
            const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCaptureComplete(file);
        } else {
            // Create PDF for front & back
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            for (let i = 0; i < images.length; i++) {
                if (i > 0) doc.addPage();

                const imgProps = doc.getImageProperties(images[i]);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                doc.addImage(images[i], 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
            onCaptureComplete(file);
        }
    };

    return (
        <div className="camera-capture-container">
            <div className="camera-header">
                <button className="btn-secondary" onClick={onCancel}><ArrowLeft size={16} /> キャンセル</button>
                <h3>名刺を撮影 ({images.length}枚撮影済み)</h3>
            </div>

            {!currentCapture ? (
                <div className="webcam-wrapper">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "environment" }}
                        className="webcam-view"
                    />
                    <div className="camera-overlay">
                        {/* CSS Guides for business card */}
                        <div className="card-guide"></div>
                    </div>
                    <div className="camera-controls">
                        <button className="btn-capture" onClick={capture}>
                            <Camera size={24} /> 撮影
                        </button>
                    </div>
                </div>
            ) : (
                <div className="crop-wrapper">
                    <p className="subtitle text-center mt-2">切り抜く範囲を調整して、名刺部分だけを囲んでください</p>
                    <div className="react-crop-container mt-4 mb-4" style={{ display: 'flex', justifyContent: 'center' }}>
                        <ReactCrop
                            crop={crop}
                            onChange={(c) => setCrop(c)}
                            onComplete={(c) => setCompletedCrop(c)}
                        >
                            <img
                                ref={imgRef}
                                src={currentCapture}
                                alt="captured"
                                className="preview-image"
                                onLoad={onImageLoad}
                            />
                        </ReactCrop>
                    </div>

                    <div className="camera-controls">
                        <button className="btn-secondary" onClick={retake}>
                            <RefreshCw size={18} /> 撮り直し
                        </button>
                        <button className="btn-primary" onClick={handleConfirmCrop}>
                            <CheckCircle size={18} /> 確認・次へ
                        </button>
                    </div>
                </div>
            )}

            {images.length > 0 && !currentCapture && (
                <div className="finish-controls">
                    <button className="btn-secondary mt-2 w-full" onClick={() => setCurrentCapture(null)}>
                        <FilePlus size={18} /> 裏面を追加撮影
                    </button>
                    <button className="btn-primary mt-2 w-full" onClick={finishAndCreatePDF}>
                        <Save size={18} /> 保存してアップロード({images.length === 1 ? '表面のみ' : 'PDF化'})
                    </button>
                </div>
            )}
        </div>
    );
};

export default CameraCapture;
