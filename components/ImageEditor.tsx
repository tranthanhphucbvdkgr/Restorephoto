import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Check, RotateCw, Crop, Sun, Contrast, Palette, 
  Undo, Wand2, Loader2, MousePointer2, Send, Sparkles,
  RefreshCw, Eraser, Move, Layers, Image as ImageIcon,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';
import { editImage } from '../services/geminiService';

interface ImageEditorProps {
  imageData: string;
  onSave: (newImageData: string) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EditPoint {
  x: number; // Percentage 0-100 relative to visual image
  y: number; // Percentage 0-100 relative to visual image
}

const AI_PRESETS = [
  { label: 'Loại bỏ nền', prompt: 'Remove the background and make it white', icon: <Eraser className="w-4 h-4" /> },
  { label: 'Làm sáng mặt', prompt: 'Brighten the faces and enhance portraits', icon: <Sun className="w-4 h-4" /> },
  { label: 'Phong cách cổ điển', prompt: 'Make it look like a vintage 70s photo', icon: <Palette className="w-4 h-4" /> },
  { label: 'Thêm mây trời', prompt: 'Add a beautiful blue sky with fluffy white clouds', icon: <Layers className="w-4 h-4" /> },
];

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageData, onSave, onCancel }) => {
  // --- States ---
  const [currentImageData, setCurrentImageData] = useState(imageData);
  const [history, setHistory] = useState<string[]>([imageData]);
  
  // Filter States
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(0); // 0 to 100
  
  // Transform States
  const [rotation, setRotation] = useState(0);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'traditional' | 'ai' | 'crop'>('traditional');
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  
  // AI States
  const [isMagicMode, setIsMagicMode] = useState(false);
  const [magicPoint, setMagicPoint] = useState<EditPoint | null>(null);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Refs
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingHandle = useRef<string | null>(null);

  // --- Helpers ---
  const addToHistory = (newData: string) => {
    setHistory(prev => [...prev, newData]);
    setCurrentImageData(newData);
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      setHistory(newHistory);
      setCurrentImageData(newHistory[newHistory.length - 1]);
      handleReset(false); // Reset sliders but keep the image status
    }
  };

  const handleReset = (resetImage = true) => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSharpness(0);
    setRotation(0);
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
    setMagicPoint(null);
    setMagicPrompt('');
    setAiError(null);
    if (resetImage) {
      setCurrentImageData(history[0]);
      setHistory([history[0]]);
    }
  };

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // --- Sharpness Kernel ---
  const sharpenAmount = sharpness / 75;
  const s = sharpenAmount;
  const k = -s;
  const c = 1 + 4 * s;
  const kernelString = [0, k, 0, k, c, k, 0, k, 0].join(' ');

  // --- Crop Logic ---
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    draggingHandle.current = handle;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingHandle.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - containerRect.left) / containerRect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - containerRect.top) / containerRect.height) * 100));
    
    setCrop(prev => {
      let newCrop = { ...prev };
      const h = draggingHandle.current!;

      if (h.includes('l')) {
        const rightEdge = prev.x + prev.width;
        newCrop.x = Math.min(xPct, rightEdge - 5);
        newCrop.width = rightEdge - newCrop.x;
      }
      if (h.includes('r')) {
        newCrop.width = Math.max(5, xPct - prev.x);
      }
      if (h.includes('t')) {
        const bottomEdge = prev.y + prev.height;
        newCrop.y = Math.min(yPct, bottomEdge - 5);
        newCrop.height = bottomEdge - newCrop.y;
      }
      if (h.includes('b')) {
        newCrop.height = Math.max(5, yPct - prev.y);
      }
      return newCrop;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    draggingHandle.current = null;
  }, []);

  useEffect(() => {
    if (activeTab === 'crop') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [activeTab, handleMouseMove, handleMouseUp]);

  // --- Processing ---
  const getProcessedImage = useCallback(async (): Promise<string | null> => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    const isVertical = rotation === 90 || rotation === 270;
    tempCanvas.width = isVertical ? img.naturalHeight : img.naturalWidth;
    tempCanvas.height = isVertical ? img.naturalWidth : img.naturalHeight;

    tempCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    tempCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return null;

    const sourceWidth = tempCanvas.width;
    const sourceHeight = tempCanvas.height;
    const cropX = (crop.x / 100) * sourceWidth;
    const cropY = (crop.y / 100) * sourceHeight;
    const cropW = (crop.width / 100) * sourceWidth;
    const cropH = (crop.height / 100) * sourceHeight;

    finalCanvas.width = cropW;
    finalCanvas.height = cropH;
    ctx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    return finalCanvas.toDataURL('image/png').split(',')[1];
  }, [brightness, contrast, saturation, rotation, crop]);

  const handleSave = async () => {
    const processedData = await getProcessedImage();
    if (processedData) {
      onSave(processedData);
    }
  };

  // --- AI Handlers ---
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isMagicMode || !imageRef.current || isGeneratingEdit) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    setMagicPoint({ x: rawX, y: rawY });
  };

  const handleAiEdit = async (prompt?: string) => {
    const finalPrompt = prompt || magicPrompt;
    if (!finalPrompt.trim()) return;

    setIsGeneratingEdit(true);
    setAiError(null);
    
    try {
      const base64Image = await getProcessedImage();
      if (!base64Image) throw new Error("Không thể chuẩn bị ảnh.");

      let point = undefined;
      if (magicPoint) {
         // Normalize to 0-1000 for Gemini
         point = { 
           x: Math.round(magicPoint.x * 10), 
           y: Math.round(magicPoint.y * 10) 
         };
      }

      const editedData = await editImage(base64Image, 'image/png', finalPrompt, point);
      addToHistory(editedData);
      
      // Reset temporary states
      setMagicPoint(null);
      setMagicPrompt('');
      if (!prompt) {
        setIsMagicMode(false);
      }
    } catch (error: any) {
      setAiError(error.message || "AI gặp lỗi khi xử lý ảnh.");
    } finally {
      setIsGeneratingEdit(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col md:flex-row overflow-hidden font-sans"
    >
      {/* SVG filter for preview */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="preview-sharpen">
            <feConvolveMatrix order="3" kernelMatrix={kernelString} preserveAlpha="true" edgeMode="duplicate"/>
          </filter>
        </defs>
      </svg>

      {/* Left Sidebar - Controls */}
      <div className="w-full md:w-80 bg-[#16161a] border-r border-gray-800 flex flex-col z-20">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wand2 className="text-sky-400 w-5 h-5" /> 
            Chỉnh sửa
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Main Navigation Tabs */}
          <div className="flex bg-[#0f1115] p-1 rounded-xl gap-1">
            <button 
              onClick={() => setActiveTab('traditional')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${activeTab === 'traditional' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Cơ bản
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${activeTab === 'ai' ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30' : 'text-gray-400 hover:text-gray-200'}`}
            >
              AI Magic
            </button>
            <button 
              onClick={() => setActiveTab('crop')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${activeTab === 'crop' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Cắt ảnh
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'traditional' && (
              <motion.div 
                key="traditional"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Sliders */}
                <div className="space-y-4">
                   <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-gray-400 flex items-center gap-2"><Sun className="w-3 h-3" /> Độ sáng</span>
                        <span className="text-sky-400">{brightness}%</span>
                      </div>
                      <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-gray-400 flex items-center gap-2"><Contrast className="w-3 h-3" /> Độ tương phản</span>
                        <span className="text-sky-400">{contrast}%</span>
                      </div>
                      <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-gray-400 flex items-center gap-2"><Palette className="w-3 h-3" /> Độ bão hòa</span>
                        <span className="text-sky-400">{saturation}%</span>
                      </div>
                      <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-gray-400 flex items-center gap-2"><Activity className="w-3 h-3" /> Độ sắc nét</span>
                        <span className="text-sky-400">{sharpness}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={sharpness} onChange={(e) => setSharpness(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                   </div>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <Button variant="secondary" onClick={rotateRight} className="w-full justify-center">
                    <RotateCw className="w-4 h-4 mr-2" /> Xoay 90°
                  </Button>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl">
                  <p className="text-xs text-sky-200/70 leading-relaxed">
                    Sử dụng trí tuệ nhân tạo để thay đổi nội dung ảnh theo yêu cầu của bạn.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Gợi ý AI</span>
                  <div className="grid grid-cols-1 gap-2">
                    {AI_PRESETS.map((preset, i) => (
                      <button 
                        key={i}
                        onClick={() => handleAiEdit(preset.prompt)}
                        disabled={isGeneratingEdit}
                        className="flex items-center gap-3 p-3 text-left text-sm text-gray-300 bg-[#0f1115] hover:bg-gray-800 border border-gray-800 rounded-xl transition group"
                      >
                        <div className="p-2 bg-gray-800 group-hover:bg-sky-500 transition rounded-lg text-gray-400 group-hover:text-white">
                          {preset.icon}
                        </div>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-800 space-y-4">
                  <button 
                    onClick={() => {
                      setIsMagicMode(!isMagicMode);
                      setMagicPoint(null);
                    }}
                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition font-semibold ${isMagicMode ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)]' : 'bg-[#0f1115] border-gray-800 text-gray-300 hover:border-sky-500/50 hover:text-sky-400'}`}
                  >
                    <MousePointer2 className="w-5 h-5" />
                    {isMagicMode ? 'Đang chọn vùng...' : 'Chế độ chọn vùng (Magic)'}
                  </button>
                  {isMagicMode && (
                    <p className="text-[10px] text-center text-gray-500 italic px-4">
                      Nhấp vào bất kỳ điểm nào trên ảnh để AI tập trung chỉnh sửa vùng đó.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'crop' && (
              <motion.div 
                key="crop"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                 <p className="text-sm text-gray-400">
                   Kéo các góc để cắt ảnh theo vùng mong muốn.
                 </p>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setCrop({ x: 0, y: 0, width: 100, height: 100 })} className="text-xs justify-center">Toàn bộ</Button>
                    <Button variant="secondary" onClick={() => setCrop({ x: 10, y: 10, width: 80, height: 80 })} className="text-xs justify-center">Trung tâm</Button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History / Actions */}
        <div className="p-6 bg-[#0f1115] border-t border-gray-800 flex gap-2">
          <Button 
            variant="secondary" 
            onClick={handleUndo} 
            disabled={history.length <= 1}
            className="flex-1 justify-center py-3"
          >
            <Undo className="w-4 h-4 mr-2" /> Hoàn tác
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
            className="flex-1 justify-center py-3 bg-gradient-to-r from-sky-500 to-indigo-600 border-none"
          >
            Lưu lại
          </Button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-12 z-10">
        
        {/* Loading / Error Overlays */}
        <AnimatePresence>
          {isGeneratingEdit && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center"
            >
              <div className="relative">
                <div className="loader w-16 h-16 border-4 border-sky-400/20 border-t-sky-400 rounded-full animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-sky-400 animate-pulse" />
              </div>
              <h3 className="mt-8 text-2xl font-bold text-white tracking-tight">AI đang làm phép màu...</h3>
              <p className="mt-2 text-gray-400 max-w-xs">Quá trình chỉnh sửa bằng generative AI có thể mất vài giây.</p>
            </motion.div>
          )}

          {aiError && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
               className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-red-900/80 border border-red-500/50 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl"
             >
               <span className="text-white text-sm font-medium">{aiError}</span>
               <button onClick={() => setAiError(null)} className="text-white hover:text-gray-300">
                 <X className="w-4 h-4" />
               </button>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Image Container */}
        <div 
          ref={containerRef}
          className="relative max-w-full max-h-full flex items-center justify-center group"
          style={{ 
            aspectRatio: rotation % 180 !== 0 && imageRef.current 
              ? `${imageRef.current.naturalHeight}/${imageRef.current.naturalWidth}` 
              : undefined
          }}
        >
          <img
            ref={imageRef}
            src={`data:image/jpeg;base64,${currentImageData}`} 
            alt="Editing"
            className={`max-w-full max-h-[80vh] shadow-2xl object-contain transition-all duration-300 rounded-lg ${isMagicMode ? 'cursor-crosshair' : 'cursor-default'}`}
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${sharpness > 0 ? 'url(#preview-sharpen)' : ''}`,
              transform: `rotate(${rotation}deg)`,
            }}
            draggable={false}
            onClick={handleImageClick}
          />

          {/* Crop Overlay */}
          {activeTab === 'crop' && (
            <div className="absolute inset-0 border-2 border-sky-400/50 rounded-lg overflow-hidden pointer-events-none">
              <div 
                className="absolute border-2 border-white shadow-[0_0_0_1000px_rgba(0,0,0,0.7)] pointer-events-auto"
                style={{
                  left: `${crop.x}%`, top: `${crop.y}%`, 
                  width: `${crop.width}%`, height: `${crop.height}%`,
                }}
              >
                {['tl', 'tr', 'bl', 'br'].map(pos => (
                  <div
                    key={pos}
                    onMouseDown={(e) => handleMouseDown(e, pos)}
                    className="absolute w-6 h-6 bg-white rounded-sm -m-3 z-10 shadow-lg cursor-pointer flex items-center justify-center"
                    style={{
                      top: pos.includes('t') ? '0' : '100%',
                      left: pos.includes('l') ? '0' : '100%',
                    }}
                  >
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Magic Point UI */}
          {isMagicMode && magicPoint && (
             <div 
               className="absolute z-40 animate-in zoom-in duration-200"
               style={{ left: `${magicPoint.x}%`, top: `${magicPoint.y}%` }}
             >
                <div className="relative">
                  <div className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-4 border-white/30 bg-sky-500/50 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                  </div>
                </div>
             </div>
          )}
        </div>

        {/* Global AI Command Bar */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleAiEdit(); }}
            className="relative flex items-center shadow-2xl"
          >
            <div className="absolute left-6 text-sky-400">
              {isMagicMode ? <MousePointer2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <input 
              type="text"
              value={magicPrompt}
              onChange={(e) => setMagicPrompt(e.target.value)}
              placeholder={isMagicMode ? "AI sẽ tập trung chỉnh sửa vùng đã chọn... (ví dụ: Biến vùng này thành khuôn mặt cười)" : "Nhập câu lệnh AI (ví dụ: Thay đổi nền thành bãi biển, làm ảnh nét hơn...)"}
              className="w-full bg-[#1c1c21]/90 backdrop-blur-xl border border-gray-700/50 rounded-full py-5 pl-14 pr-32 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all text-sm md:text-base focus:border-sky-500"
            />
            <div className="absolute right-2 px-1">
              <button 
                type="submit"
                disabled={!magicPrompt.trim() || isGeneratingEdit}
                className="bg-sky-500 hover:bg-sky-400 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-full font-bold transition flex items-center gap-2 shadow-lg"
              >
                {isGeneratingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">Gửi AI</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #313136; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #414146; }
      `}</style>
    </motion.div>
  );
};
