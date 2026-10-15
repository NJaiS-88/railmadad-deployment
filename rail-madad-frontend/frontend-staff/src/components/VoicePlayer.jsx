import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function VoicePlayer({ audioUrl }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration] = useState(14); // Mock length of 14 seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const timerRef = useRef(null);

  // Dance bars heights for waveform animation
  const initialWaveform = [10, 18, 24, 14, 28, 36, 20, 32, 26, 12, 18, 30, 22, 16, 28, 38, 24, 14, 20, 12];
  const [waveform, setWaveform] = useState(initialWaveform);

  useEffect(() => {
    if (isPlaying) {
      // Audio timer simulation
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            clearInterval(timerRef.current);
            return 0;
          }
          return prev + 1;
        });

        // Jitter waveform heights
        setWaveform(initialWaveform.map(h => Math.max(8, Math.min(40, h + (Math.random() * 12 - 6)))));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setWaveform(initialWaveform);
    }

    return () => clearInterval(timerRef.current);
  }, [isPlaying, duration]);

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e) => {
    setCurrentTime(Number(e.target.value));
  };

  const formatTime = (timeInSecs) => {
    const mins = Math.floor(timeInSecs / 60);
    const secs = timeInSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-50 border border-app-border rounded-2xl p-4 shadow-sm select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
          <Volume2 className="w-3.5 h-3.5 text-rail-blue" />
          <span>Voice Evidence</span>
        </span>
        <span className="text-[10px] font-bold text-muted-text bg-slate-200 px-2 py-0.5 rounded">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Waveform and Toggles */}
      <div className="flex items-center space-x-3 mt-3">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayToggle}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 shadow cursor-pointer ${
            isPlaying ? 'bg-action-orange text-white' : 'bg-rail-blue text-white'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        {/* Custom dancing waveform representation */}
        <div className="flex-1 flex items-end justify-between h-10 px-1 bg-white border border-slate-100 rounded-lg overflow-hidden">
          {waveform.map((height, idx) => {
            const isFilled = idx / waveform.length <= currentTime / duration;
            return (
              <div
                key={idx}
                className={`w-[3px] rounded-full transition-all duration-200 ${
                  isFilled 
                    ? isPlaying ? 'bg-action-orange' : 'bg-rail-blue' 
                    : 'bg-slate-200'
                }`}
                style={{ height: `${height}%`, transition: 'height 0.15s ease-in-out' }}
              />
            );
          })}
        </div>

        {/* Mute Button */}
        <button 
          onClick={() => setMuted(!muted)} 
          className="p-2 text-slate-400 hover:text-slate-600 transition"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Time Track Slider */}
      <input
        type="range"
        min="0"
        max={duration}
        value={currentTime}
        onChange={handleSliderChange}
        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rail-blue mt-3 outline-none"
      />
    </div>
  );
}
