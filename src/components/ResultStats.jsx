import React, { useEffect } from 'react';
import { Download, RefreshCw, Sparkles, FileVideo, HardDrive, Percent, Maximize2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatBytes } from '../services/ffmpegService';
import VideoCompareViewer from './VideoCompareViewer';

export default function ResultStats({
  originalFile,
  compressedBlob,
  compressedUrl,
  resolution,
  onReset,
  onUseCompressed,
}) {
  const originalSize = originalFile?.size || 0;
  const compressedSize = compressedBlob?.size || 0;
  const savingsPct = Math.max(0, Math.round((1 - compressedSize / originalSize) * 100));

  useEffect(() => {
    // Trigger confetti on successful compression display
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#10b981', '#c4b5fd'],
      });
    } catch (e) {}
  }, []);

  const downloadFilename = originalFile
    ? originalFile.name.replace(/\.[a-zA-Z0-9]+$/, '') + '-comprimido.mp4'
    : 'video-comprimido.mp4';

  const [localOriginalUrl, setLocalOriginalUrl] = React.useState('');

  useEffect(() => {
    if (!originalFile) {
      setLocalOriginalUrl('');
      return;
    }
    const url = URL.createObjectURL(originalFile);
    setLocalOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [originalFile]);

  return (
    <section className="panel results">
      <div className="section-label">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        Resultado de Compresión
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="num">{formatBytes(originalSize)}</div>
          <div className="lbl">Tamaño Original</div>
        </div>
        <div className="stat-card">
          <div className="num">{formatBytes(compressedSize)}</div>
          <div className="lbl">Tamaño Comprimido</div>
        </div>
        <div className="stat-card savings">
          <div className="num">-{savingsPct}%</div>
          <div className="lbl">Ahorro Obtenido</div>
        </div>
        <div className="stat-card">
          <div className="num">{resolution || '1080p'}</div>
          <div className="lbl">Resolución Salida</div>
        </div>
      </div>

      {localOriginalUrl && (
        <VideoCompareViewer
          originalUrl={localOriginalUrl}
          compressedUrl={compressedUrl}
        />
      )}

      <div className="download-row">
        <a
          className="dl-btn"
          href={compressedUrl}
          download={downloadFilename}
        >
          <Download className="w-5 h-5" />
          Descargar Video Comprimido ({formatBytes(compressedSize)})
        </a>

        <button className="reset-btn" onClick={onReset}>
          <RefreshCw className="w-4 h-4" />
          Comprimir otro video
        </button>
      </div>

      {/* Use compressed video as new input */}
      {onUseCompressed && (
        <div className="use-compressed-row">
          <button className="use-compressed-btn" onClick={onUseCompressed}>
            <ArrowRight className="w-4 h-4" />
            Usar este video como entrada nueva
          </button>
          <span className="use-compressed-hint">
            Seguí editando: recortá, reencuadrá o agregá marca de agua al video comprimido
          </span>
        </div>
      )}
    </section>
  );
}
