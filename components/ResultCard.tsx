import React from 'react';
import { Download, Edit } from 'lucide-react';
import { Button } from './Button';

interface ResultCardProps {
  imageData: string | null;
  mimeType: string;
  title: string;
  variant: 'vibrant' | 'natural';
  filename: string;
  onEdit: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ 
  imageData, 
  mimeType, 
  title, 
  variant,
  filename,
  onEdit
}) => {
  const handleDownload = () => {
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${imageData}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const borderColor = variant === 'vibrant' ? 'border-sky-500/30' : 'border-emerald-500/30';
  const glowColor = variant === 'vibrant' ? 'hover:shadow-sky-500/20' : 'hover:shadow-emerald-500/20';

  return (
    <div className={`bg-gray-800 rounded-xl overflow-hidden border ${borderColor} shadow-xl transition-all duration-300 ${glowColor} flex flex-col h-full fade-in`}>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-900 group">
        {imageData ? (
          <img 
            src={`data:${mimeType};base64,${imageData}`} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
           <div className="w-full h-full flex items-center justify-center bg-gray-800 animate-pulse">
             <span className="text-gray-500 font-medium">Đang xử lý...</span>
           </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
      </div>
      
      <div className="p-4 mt-auto flex gap-3">
        <Button 
          onClick={onEdit} 
          disabled={!imageData}
          variant="secondary"
          className="flex-1"
          icon={<Edit className="w-4 h-4" />}
        >
          Sửa
        </Button>
        <Button 
          onClick={handleDownload} 
          disabled={!imageData}
          variant={variant === 'vibrant' ? 'info' : 'success'}
          className="flex-1"
          icon={<Download className="w-4 h-4" />}
        >
          Tải về
        </Button>
      </div>
    </div>
  );
};
