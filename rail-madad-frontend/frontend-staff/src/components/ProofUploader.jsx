import React, { useState } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon } from 'lucide-react';

const mockResolutionImages = [
  "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&q=80", // cleaned floor
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&q=80", // tools / repaired
  "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=500&q=80", // rewired/charging
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80", // catering tray
];

export default function ProofUploader({ onImageSelected, currentImage }) {
  const [preview, setPreview] = useState(currentImage || null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setUploading(false);
      if (onImageSelected) {
        onImageSelected(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSimulateCapture = () => {
    setUploading(true);
    setTimeout(() => {
      // Pick a random mock image from the list
      const randomImg = mockResolutionImages[Math.floor(Math.random() * mockResolutionImages.length)];
      setPreview(randomImg);
      setUploading(false);
      if (onImageSelected) {
        onImageSelected(randomImg);
      }
    }, 450);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setPreview(null);
    if (onImageSelected) {
      onImageSelected(null);
    }
  };

  return (
    <div className="bg-white border border-app-border rounded-2xl p-4 select-none">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Upload Resolution Proof</h4>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 group">
          <img 
            src={preview} 
            alt="Resolution proof preview" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
            <button
              type="button"
              onClick={handleClear}
              className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition active:scale-95 cursor-pointer"
              title="Remove image"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-2 left-2 bg-success-green text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center space-x-1 shadow">
            <Check className="w-3 h-3" />
            <span>Proof Selected</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          <label className="border-2 border-dashed border-slate-200 hover:border-rail-blue rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center bg-slate-50/50 hover:bg-blue-50/20 active:scale-[0.99]">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploading ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-8 h-8 border-4 border-rail-blue border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold text-slate-600">Processing media...</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800">Choose Photo / Video File</span>
                <span className="text-[10px] text-muted-text mt-1">PNG, JPG, or MP4 up to 10MB</span>
              </>
            )}
          </label>

          <div className="flex items-center space-x-2 text-xs font-bold text-muted-text justify-center py-0.5">
            <span className="h-px bg-slate-200 flex-1"></span>
            <span>OR</span>
            <span className="h-px bg-slate-200 flex-1"></span>
          </div>

          <button
            type="button"
            onClick={handleSimulateCapture}
            disabled={uploading}
            className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Capture with Phone Camera (Mock)</span>
          </button>
        </div>
      )}
    </div>
  );
}
