import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, Square, Monitor, Smartphone } from 'lucide-react';

const ASPECT_RATIOS = [
  { id: 'free', label: 'Libre', icon: null },
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '4:3', label: '4:3', icon: null },
  { id: '1:1', label: '1:1', icon: Square },
  { id: '9:16', label: '9:16', icon: Smartphone },
];

export default function CropTool({ file, cropRect, onCropChange }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDims, setVideoDims] = useState({ w: 0, h: 0 });
  const [displayDims, setDisplayDims] = useState({ w: 0, h: 0 });
  const [aspectRatio, setAspectRatio] = useState('free');
  const [dragging, setDragging] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rect: null });

  useEffect(() => {
    if (file instanceof Blob) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [file]);

  const updateDisplayDims = useCallback(() => {
    if (!containerRef.current || !videoRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (!vw || !vh) return;

    const containerAR = container.width / container.height;
    const videoAR = vw / vh;
    let dw, dh;
    if (videoAR > containerAR) {
      dw = container.width;
      dh = container.width / videoAR;
    } else {
      dh = container.height;
      dw = container.height * videoAR;
    }
    setDisplayDims({ w: dw, h: dh });
  }, []);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDims({ w: v.videoWidth, h: v.videoHeight });
    updateDisplayDims();
  };

  useEffect(() => {
    window.addEventListener('resize', updateDisplayDims);
    return () => window.removeEventListener('resize', updateDisplayDims);
  }, [updateDisplayDims]);

  const applyAspectRatio = (ratioId) => {
    setAspectRatio(ratioId);
    if (ratioId === 'free') return;

    const [rw, rh] = ratioId.split(':').map(Number);
    const targetAR = rw / rh;
    const videoAR = videoDims.w / videoDims.h;

    let newW, newH;
    if (targetAR > videoAR) {
      newW = 100;
      newH = (videoAR / targetAR) * 100;
    } else {
      newH = 100;
      newW = (targetAR / videoAR) * 100;
    }

    const x = (100 - newW) / 2;
    const y = (100 - newH) / 2;
    onCropChange({ x, y, w: newW, h: newH });
  };

  const getPosPct = useCallback((e) => {
    if (!containerRef.current || !displayDims.w) return { px: 0, py: 0 };
    const containerRect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const offsetX = (containerRect.width - displayDims.w) / 2;
    const offsetY = (containerRect.height - displayDims.h) / 2;
    const px = ((clientX - containerRect.left - offsetX) / displayDims.w) * 100;
    const py = ((clientY - containerRect.top - offsetY) / displayDims.h) * 100;
    return { px: Math.max(0, Math.min(100, px)), py: Math.max(0, Math.min(100, py)) };
  }, [displayDims]);

  const handleMouseDown = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    const { px, py } = getPosPct(e);
    setDragging(type);
    setDragStart({ x: px, y: py, rect: { ...cropRect } });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      if (e.type === 'touchmove' && e.cancelable) {
        e.preventDefault();
      }
      const { px, py } = getPosPct(e);
      const dx = px - dragStart.x;
      const dy = py - dragStart.y;
      const r = dragStart.rect;

      if (dragging === 'move') {
        let nx = r.x + dx;
        let ny = r.y + dy;
        nx = Math.max(0, Math.min(100 - r.w, nx));
        ny = Math.max(0, Math.min(100 - r.h, ny));
        onCropChange({ ...r, x: nx, y: ny });
      } else if (dragging === 'n') {
        let nh = Math.max(5, r.h - dy);
        let ny = Math.max(0, r.y + r.h - nh);
        nh = r.y + r.h - ny;
        onCropChange({ ...r, y: ny, h: nh });
      } else if (dragging === 's') {
        let nh = Math.max(5, Math.min(100 - r.y, r.h + dy));
        onCropChange({ ...r, h: nh });
      } else if (dragging === 'w') {
        let nw = Math.max(5, r.w - dx);
        let nx = Math.max(0, r.x + r.w - nw);
        nw = r.x + r.w - nx;
        onCropChange({ ...r, x: nx, w: nw });
      } else if (dragging === 'e') {
        let nw = Math.max(5, Math.min(100 - r.x, r.w + dx));
        onCropChange({ ...r, w: nw });
      } else if (dragging === 'se') {
        let nw = Math.max(5, r.w + dx);
        let nh = Math.max(5, r.h + dy);
        nw = Math.min(nw, 100 - r.x);
        nh = Math.min(nh, 100 - r.y);

        if (aspectRatio !== 'free') {
          const [aw, ah] = aspectRatio.split(':').map(Number);
          const targetAR = aw / ah;
          const videoAR = videoDims.w / videoDims.h;
          nh = (nw / targetAR) * videoAR;
          if (r.y + nh > 100) {
            nh = 100 - r.y;
            nw = (nh * targetAR) / videoAR;
          }
        }
        onCropChange({ ...r, w: nw, h: nh });
      } else if (dragging === 'nw') {
        let nw = Math.max(5, r.w - dx);
        let nh = Math.max(5, r.h - dy);
        let nx = r.x + r.w - nw;
        let ny = r.y + r.h - nh;
        nx = Math.max(0, nx);
        ny = Math.max(0, ny);
        nw = r.x + r.w - nx;
        nh = r.y + r.h - ny;

        if (aspectRatio !== 'free') {
          const [aw, ah] = aspectRatio.split(':').map(Number);
          const targetAR = aw / ah;
          const videoAR = videoDims.w / videoDims.h;
          nh = (nw / targetAR) * videoAR;
          ny = r.y + r.h - nh;
          if (ny < 0) { ny = 0; nh = r.y + r.h; nw = (nh * targetAR) / videoAR; nx = r.x + r.w - nw; }
        }
        onCropChange({ x: nx, y: ny, w: nw, h: nh });
      } else if (dragging === 'ne') {
        let nw = Math.max(5, r.w + dx);
        let nh = Math.max(5, r.h - dy);
        nw = Math.min(nw, 100 - r.x);
        let ny = r.y + r.h - nh;
        ny = Math.max(0, ny);
        nh = r.y + r.h - ny;

        if (aspectRatio !== 'free') {
          const [aw, ah] = aspectRatio.split(':').map(Number);
          const targetAR = aw / ah;
          const videoAR = videoDims.w / videoDims.h;
          nh = (nw / targetAR) * videoAR;
          ny = r.y + r.h - nh;
          if (ny < 0) { ny = 0; nh = r.y + r.h; nw = (nh * targetAR) / videoAR; }
        }
        onCropChange({ x: r.x, y: ny, w: nw, h: nh });
      } else if (dragging === 'sw') {
        let nw = Math.max(5, r.w - dx);
        let nh = Math.max(5, r.h + dy);
        let nx = r.x + r.w - nw;
        nx = Math.max(0, nx);
        nw = r.x + r.w - nx;
        nh = Math.min(nh, 100 - r.y);

        if (aspectRatio !== 'free') {
          const [aw, ah] = aspectRatio.split(':').map(Number);
          const targetAR = aw / ah;
          const videoAR = videoDims.w / videoDims.h;
          nh = (nw / targetAR) * videoAR;
          if (r.y + nh > 100) { nh = 100 - r.y; nw = (nh * targetAR) / videoAR; nx = r.x + r.w - nw; }
        }
        onCropChange({ x: nx, y: r.y, w: nw, h: nh });
      }
    };

    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
    };
  }, [dragging, dragStart, getPosPct, onCropChange, aspectRatio, videoDims]);

  const resetCrop = () => {
    onCropChange({ x: 0, y: 0, w: 100, h: 100 });
    setAspectRatio('free');
  };

  const isCropActive = cropRect.x !== 0 || cropRect.y !== 0 || cropRect.w !== 100 || cropRect.h !== 100;

  return (
    <div className="tool-panel">
      <div className="section-label">
        <Crop className="w-4 h-4" style={{ color: '#10b981' }} />
        Reencuadrar Video (Crop)
      </div>

      <div className="crop-ratios">
        {ASPECT_RATIOS.map((ar) => (
          <button
            key={ar.id}
            className={`crop-ratio-btn ${aspectRatio === ar.id ? 'active' : ''}`}
            onClick={() => applyAspectRatio(ar.id)}
          >
            {ar.label}
          </button>
        ))}
      </div>

      {videoUrl && (
        <div className="crop-video-container" ref={containerRef}>
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
            muted
          />

          {displayDims.w > 0 && (
            <div
              className="crop-overlay"
              style={{
                width: `${displayDims.w}px`,
                height: `${displayDims.h}px`,
              }}
            >
              {/* Dark mask */}
              <div className="crop-mask" style={{ top: 0, left: 0, right: 0, height: `${cropRect.y}%` }} />
              <div className="crop-mask" style={{ top: `${cropRect.y + cropRect.h}%`, left: 0, right: 0, bottom: 0 }} />
              <div className="crop-mask" style={{ top: `${cropRect.y}%`, left: 0, width: `${cropRect.x}%`, height: `${cropRect.h}%` }} />
              <div className="crop-mask" style={{ top: `${cropRect.y}%`, left: `${cropRect.x + cropRect.w}%`, right: 0, height: `${cropRect.h}%` }} />

              {/* Crop box */}
              <div
                className="crop-box"
                style={{
                  left: `${cropRect.x}%`,
                  top: `${cropRect.y}%`,
                  width: `${cropRect.w}%`,
                  height: `${cropRect.h}%`,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                onTouchStart={(e) => handleMouseDown(e, 'move')}
              >
                {/* Grid lines */}
                <div className="crop-grid-h" style={{ top: '33.33%' }} />
                <div className="crop-grid-h" style={{ top: '66.66%' }} />
                <div className="crop-grid-v" style={{ left: '33.33%' }} />
                <div className="crop-grid-v" style={{ left: '66.66%' }} />

                {/* Edge handles (top, bottom, left, right) for super easy grabbing */}
                <div className="crop-edge-handle n" onMouseDown={(e) => handleMouseDown(e, 'n')} onTouchStart={(e) => handleMouseDown(e, 'n')} />
                <div className="crop-edge-handle s" onMouseDown={(e) => handleMouseDown(e, 's')} onTouchStart={(e) => handleMouseDown(e, 's')} />
                <div className="crop-edge-handle w" onMouseDown={(e) => handleMouseDown(e, 'w')} onTouchStart={(e) => handleMouseDown(e, 'w')} />
                <div className="crop-edge-handle e" onMouseDown={(e) => handleMouseDown(e, 'e')} onTouchStart={(e) => handleMouseDown(e, 'e')} />

                {/* Corner handles */}
                <div className="crop-handle nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} onTouchStart={(e) => handleMouseDown(e, 'nw')} />
                <div className="crop-handle ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} onTouchStart={(e) => handleMouseDown(e, 'ne')} />
                <div className="crop-handle sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} onTouchStart={(e) => handleMouseDown(e, 'sw')} />
                <div className="crop-handle se" onMouseDown={(e) => handleMouseDown(e, 'se')} onTouchStart={(e) => handleMouseDown(e, 'se')} />
              </div>
            </div>
          )}
        </div>
      )}

      {isCropActive && (
        <div className="crop-info">
          <span>
            Área: {Math.round(cropRect.w)}% × {Math.round(cropRect.h)}%
          </span>
          <button className="crop-reset-btn" onClick={resetCrop}>
            Restablecer
          </button>
        </div>
      )}
    </div>
  );
}
