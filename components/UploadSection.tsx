import React, { useCallback, useState } from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';
import { ImageFile } from '../types';
import { Button } from './Button';

interface UploadSectionProps {
  onFileSelect: (file: ImageFile) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh (JPEG, PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const base64String = (e.target.result as string).split(',')[1];
        onFileSelect({
          data: base64String,
          mimeType: file.type,
        });
      }
    };
    reader.readAsDataURL(file);
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`relative w-full border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all duration-300 ease-in-out cursor-pointer
        ${isDragging 
          ? 'border-sky-400 bg-gray-800 scale-[1.02]' 
          : 'border-gray-600 hover:border-sky-400 hover:bg-gray-800/50 bg-gray-900'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`p-4 rounded-full ${isDragging ? 'bg-sky-500/20' : 'bg-gray-800'}`}>
          <UploadCloud className={`w-12 h-12 ${isDragging ? 'text-sky-400' : 'text-gray-400'}`} />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-200">
            Kéo và thả hoặc nhấp để tải ảnh lên
          </h3>
          <p className="text-gray-400">
            Hỗ trợ định dạng JPEG, PNG
          </p>
        </div>

        <input 
          type="file" 
          id="fileInput" 
          className="hidden" 
          accept="image/jpeg, image/png"
          onChange={handleFileInput}
        />

        <Button className="mt-4 pointer-events-none" variant="primary" icon={<ImageIcon className="w-4 h-4" />}>
          Chọn ảnh từ thiết bị
        </Button>
      </div>
    </div>
  );
};
