import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, SlidersHorizontal,
  Volume2, VolumeX, Headphones,
} from 'lucide-react';

export default function VideoCompareViewer({ originalUrl, compressedUrl }) {
  const vidBeforeRef = useRef(null);
  const vidAfterRef = useRef(null);
  const compareBoxRef = useRef(null);

  const [sliderPct, setSliderPct] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Audio controls state
  const [audioSource, setAudioSource] = useState('compressed'); // 'compressed' | 'original' | 'muted'
  const [volume, setVolume] = useState(0.8);

  // Apply audio routing whenever source or volume changes
  useEffect(() => {
    const vBefore = vidBeforeRef.current;
    const vAfter = vidAfterRef.current;
    if (!vBefore || !vAfter) return;

    if (audioSource === 'muted') {
      vBefore.muted = true;
      vAfter.muted = true;
    } else if (audioSource === 'original') {
      vBefore.muted = false;
      vBefore.volume = volume;
      vAfter.muted = true;
    } else {
      // 'compressed' (default)
      vBefore.muted = true;
      vAfter.muted = false;
      vAfter.volume = volume;
    }
  }, [audioSource, volume]);

  const togglePlay = () => {
    const vBefore = vidBeforeRef.current;
    const vAfter = vidAfterRef.current;
    if (!vBefore || !vAfter) return;

    if (isPlaying) {
      vBefore.pause();
      vAfter.pause();
      setIsPlaying(false);
    } else {
      vBefore.play().catch(() => {});
      vAfter.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    if (vidBeforeRef.current) vidBeforeRef.current.currentTime = 0;
    if (vidAfterRef.current) vidAfterRef.current.currentTime = 0;
  };

  // Drag handler for interactive handle on video
  const handleMouseMove = useCallback((e) => {
    if (!compareBoxRef.current) return;
    if (e.type === 'touchmove' && e.cancelable) {
      e.preventDefault();
    }
    const rect = compareBoxRef.current.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.min(100, Math.max(0, pct));
    setSliderPct(pct);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
      window.addEventListener('touchcancel', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchcancel', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const cycleAudioSource = () => {
    setAudioSource((prev) => {
      if (prev === 'compressed') return 'original';
      if (prev === 'original') return 'muted';
      return 'compressed';
    });
  };

  const audioLabel = {
    compressed: 'Audio: Comprimido',
    original: 'Audio: Original',
    muted: 'Audio: Silenciado',
  };

  return (
    <div>
      <div
        className="compare-container"
        ref={compareBoxRef}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      >
        <video
          ref={vidBeforeRef}
          src={originalUrl}
          muted
          loop
          playsInline
        />
        <video
          ref={vidAfterRef}
          src={compressedUrl}
          muted
          loop
          playsInline
          style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
        />

        <div className="compare-label before">Original</div>
        <div className="compare-label after">Comprimido</div>

        <div
          className="divider-line"
          style={{ left: `${sliderPct}%` }}
        >
          <div className="divider-handle">
            <SlidersHorizontal className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      <input
        type="range"
        className="compare-slider-input"
        min="0"
        max="100"
        value={sliderPct}
        onChange={(e) => setSliderPct(parseInt(e.target.value, 10))}
      />

      <div className="compare-controls">
        <button className="icon-btn" onClick={togglePlay}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          {isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        <button className="icon-btn" onClick={handleRestart}>
          <RotateCcw className="w-4 h-4" />
          Reiniciar
        </button>
      </div>

      {/* ── Audio Controls ── */}
      <div className="audio-controls">
        <div className="audio-controls-header">
          <Headphones className="w-4 h-4" style={{ color: 'var(--violet-light)' }} />
          <span className="audio-controls-title">Control de Audio</span>
        </div>

        <div className="audio-controls-body">
          {/* Source selector */}
          <div className="audio-source-group">
            <button
              className={`audio-source-btn ${audioSource === 'compressed' ? 'active' : ''}`}
              onClick={() => setAudioSource('compressed')}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Comprimido
            </button>
            <button
              className={`audio-source-btn ${audioSource === 'original' ? 'active' : ''}`}
              onClick={() => setAudioSource('original')}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Original
            </button>
            <button
              className={`audio-source-btn ${audioSource === 'muted' ? 'active' : ''}`}
              onClick={() => setAudioSource('muted')}
            >
              <VolumeX className="w-3.5 h-3.5" />
              Silenciar
            </button>
          </div>

          {/* Volume slider */}
          <div className="audio-volume-row">
            <button
              className="audio-mute-toggle"
              onClick={() => setAudioSource(audioSource === 'muted' ? 'compressed' : 'muted')}
              title={audioSource === 'muted' ? 'Activar audio' : 'Silenciar'}
            >
              {audioSource === 'muted'
                ? <VolumeX className="w-4 h-4" />
                : <Volume2 className="w-4 h-4" />
              }
            </button>
            <input
              type="range"
              className="audio-volume-slider"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) / 100;
                setVolume(val);
                if (val > 0 && audioSource === 'muted') {
                  setAudioSource('compressed');
                }
              }}
              disabled={audioSource === 'muted'}
            />
            <span className="audio-volume-label">
              {audioSource === 'muted' ? '—' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
