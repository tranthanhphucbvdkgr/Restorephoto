import React, { useState, useCallback } from 'react';
import { RefreshCw, ImagePlus, AlertCircle } from 'lucide-react';
import { UploadSection } from './components/UploadSection';
import { ResultCard } from './components/ResultCard';
import { Button } from './components/Button';
import { ImageEditor } from './components/ImageEditor';
import { restoreImage } from './services/geminiService';
import { ImageFile, AppStatus, ProcessingResult } from './types';

interface EditingState {
  data: string;
  variant: 'vibrant' | 'natural';
}

function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [results, setResults] = useState<ProcessingResult>({ vibrant: null, natural: null });
  const [error, setError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<EditingState | null>(null);

  const handleFileSelect = useCallback((file: ImageFile) => {
    setOriginalImage(file);
    processImages(file);
  }, []);

  const processImages = async (file: ImageFile) => {
    setStatus(AppStatus.PROCESSING);
    setError(null);
    setResults({ vibrant: null, natural: null });

    try {
      // Execute both requests in parallel for better UX
      const [vibrantData, naturalData] = await Promise.all([
        restoreImage(file, 'vibrant').catch(e => {
            console.error("Vibrant generation failed", e);
            return null;
        }),
        restoreImage(file, 'natural').catch(e => {
            console.error("Natural generation failed", e);
            return null;
        })
      ]);

      if (!vibrantData && !naturalData) {
        throw new Error("Không thể phục hồi ảnh. Vui lòng thử lại sau.");
      }

      setResults({
        vibrant: vibrantData,
        natural: naturalData
      });
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi không mong muốn.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setResults({ vibrant: null, natural: null });
    setStatus(AppStatus.IDLE);
    setError(null);
  };

  const handleRegenerate = () => {
    if (originalImage) {
      processImages(originalImage);
    }
  };

  // --- Editing Handlers ---

  const openEditor = (variant: 'vibrant' | 'natural') => {
    const data = results[variant];
    if (data) {
      setEditingImage({ data, variant });
    }
  };

  const handleSaveEdit = (newImageData: string) => {
    if (editingImage) {
      setResults(prev => ({
        ...prev,
        [editingImage.variant]: newImageData
      }));
      setEditingImage(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#111827] text-gray-100 font-sans">
      
      {/* Header */}
      <header className="text-center mb-12 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400">
            Phục Hồi Ảnh Cũ
          </span>
        </h1>
        <p className="text-lg text-gray-400 leading-relaxed">
          Tải lên ảnh cũ, mờ, hoặc hư hỏng để AI tự động tái tạo chi tiết, khử nhiễu, 
          tăng độ nét, và phục hồi màu sắc.
        </p>
      </header>

      <main className="w-full max-w-5xl">
        
        {/* Upload View */}
        {status === AppStatus.IDLE && (
          <div className="fade-in">
             <UploadSection onFileSelect={handleFileSelect} />
          </div>
        )}

        {/* Loading View */}
        {status === AppStatus.PROCESSING && (
          <div className="text-center py-20 fade-in">
            <div className="loader mx-auto mb-8"></div>
            <h3 className="text-2xl font-semibold text-gray-200 animate-pulse mb-2">
              AI đang phân tích và phục hồi ảnh của bạn...
            </h3>
            <p className="text-gray-400">
              Quá trình này có thể mất một vài phút. Vui lòng không đóng trình duyệt.
            </p>
          </div>
        )}

        {/* Results View */}
        {(status === AppStatus.SUCCESS || (status === AppStatus.ERROR && results.vibrant)) && (
          <div className="space-y-8 fade-in">
            
            {originalImage && (
              <div className="flex justify-center mb-8">
                <div className="bg-gray-800 p-2 rounded-lg inline-block border border-gray-700">
                  <p className="text-center text-sm text-gray-400 mb-2">Ảnh gốc</p>
                  <img 
                    src={`data:${originalImage.mimeType};base64,${originalImage.data}`} 
                    alt="Original" 
                    className="h-48 object-contain rounded"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ResultCard 
                imageData={results.vibrant} 
                mimeType={originalImage?.mimeType || 'image/jpeg'} 
                title="Phiên bản màu tươi sống động"
                variant="vibrant"
                filename="phuc-hoi-mau-tuoi.png"
                onEdit={() => openEditor('vibrant')}
              />
              <ResultCard 
                imageData={results.natural} 
                mimeType={originalImage?.mimeType || 'image/jpeg'} 
                title="Phiên bản màu chân thực"
                variant="natural"
                filename="phuc-hoi-chan-thuc.png"
                onEdit={() => openEditor('natural')}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
              <Button onClick={handleRegenerate} variant="primary" icon={<RefreshCw className="w-4 h-4" />}>
                Tạo lại
              </Button>
              <Button onClick={handleReset} variant="secondary" icon={<ImagePlus className="w-4 h-4" />}>
                Tải ảnh khác
              </Button>
            </div>
          </div>
        )}

        {/* Error View */}
        {status === AppStatus.ERROR && !results.vibrant && !results.natural && (
          <div className="max-w-md mx-auto mt-8 bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center fade-in">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Đã xảy ra lỗi</h3>
            <p className="text-red-200 mb-6">{error}</p>
            <Button onClick={handleReset} variant="primary">
              Thử lại với ảnh khác
            </Button>
          </div>
        )}

      </main>

      {/* Editor Modal */}
      {editingImage && (
        <ImageEditor 
          imageData={editingImage.data}
          onSave={handleSaveEdit}
          onCancel={() => setEditingImage(null)}
        />
      )}

      <footer className="text-center mt-8 text-gray-500">
        <p>Một Sản Phẩm AI của <a href="https://www.tiktok.com/@tranthanhphucttytgr" target="_blank" className="font-semibold text-sky-400 hover:text-sky-300 transition-colors">Trần Thanh Phúc</a> - Trung tâm Y tế Giồng Riềng</p>
      </footer>

    </div>
  );
}

export default App;