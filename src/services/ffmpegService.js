import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance = null;
let loadPromise = null;

export const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes > 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
};

/**
 * Initializes FFmpeg singleton.
 *
 * Key insight: @ffmpeg/ffmpeg v0.12 spawns an internal Web Worker of type "module".
 * That worker tries to dynamically `import()` the coreURL we pass.
 * For that dynamic import to succeed inside the worker, the URL must point to a
 * valid ES module that exports `createFFmpegCore` as its default export.
 *
 * The @ffmpeg/core ESM build (`dist/esm/ffmpeg-core.js`) satisfies this requirement.
 * We use `toBlobURL` to download it from a CDN and convert it to a same-origin
 * blob URL, which avoids CORS/COEP issues while keeping the module structure intact.
 */
export async function getFFmpeg(onStatusUpdate, onLog, onProgress) {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    onStatusUpdate?.({
      status: "loading",
      text: "Iniciando descarga del motor...",
      pct: 5,
    });

    const createInstance = () => {
      return new FFmpeg();
    };

    try {
      let ffmpeg = createInstance();

      const loadLogHandler = ({ message }) => onLog?.(message);
      const loadProgressHandler = ({ progress }) => {
        onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
      };

      ffmpeg.on("log", loadLogHandler);
      ffmpeg.on("progress", loadProgressHandler);

      try {
        // Intento 1: Carga local (rápido, offline)
        onStatusUpdate?.({
          status: "loading",
          text: "Cargando motor local...",
          pct: 15,
        });
        const coreURL = await toBlobURL(`/ffmpeg/ffmpeg-core.js`, "text/javascript");
        const wasmURL = await toBlobURL(`/ffmpeg/ffmpeg-core.wasm`, "application/wasm");

        await ffmpeg.load({ coreURL, wasmURL });
      } catch (localErr) {
        console.warn("Carga local falló, reintentando vía CDN:", localErr);
        ffmpeg.off("log", loadLogHandler);
        ffmpeg.off("progress", loadProgressHandler);
        
        ffmpeg = createInstance(); // Recrear instancia para evitar worker corrupto
        ffmpeg.on("log", loadLogHandler);
        ffmpeg.on("progress", loadProgressHandler);

        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
        onStatusUpdate?.({
          status: "loading",
          text: "Descargando motor desde CDN...",
          pct: 30,
        });
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");

        await ffmpeg.load({ coreURL, wasmURL });
      }

      ffmpeg.off("log", loadLogHandler);
      ffmpeg.off("progress", loadProgressHandler);

      ffmpegInstance = ffmpeg;
      onStatusUpdate?.({ status: "ready", text: "Motor listo", pct: 100 });
      return ffmpeg;
    } catch (err) {
      console.error("Error al cargar FFmpeg WASM:", err);
      onStatusUpdate?.({
        status: "error",
        text: "Error al cargar · clic para reintentar",
        pct: 0,
        error: err.message,
      });
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

/**
 * Runs compression on a video file with specified parameters.
 * Now supports trim, crop, and watermark settings.
 *
 * settings: { crf, width, presetSpeed, fps, audioBitrate, muteAudio }
 * extras:   { trimStart, trimEnd, cropRect, watermark }
 *   - trimStart / trimEnd: seconds (0 = unused)
 *   - cropRect: { x, y, w, h } in percentages of video (100 = full)
 *   - watermark: { file, x, y, scale, opacity } — file is a File/Blob, x/y/scale in %, opacity 0-1
 */
export async function compressVideo({
  file,
  settings,
  extras,
  onLog,
  onProgress,
  onStatus,
}) {
  onStatus?.("Preparando motor...");
  const ffmpeg = await getFFmpeg(
    (statusObj) => onStatus?.(statusObj?.text || statusObj),
    onLog,
    onProgress
  );

  const logHandler = ({ message }) => onLog?.(message);
  const progressHandler = ({ progress }) => {
    onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
  };

  if (onLog) ffmpeg.on("log", logHandler);
  if (onProgress) ffmpeg.on("progress", progressHandler);

  const extMatch = file.name.match(/\.[a-zA-Z0-9]+$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".mp4";
  const inputName = `input_${Date.now()}${ext}`;
  const outputName = `output_${Date.now()}.mp4`;
  let watermarkInputName = null;

  try {
    onStatus?.("Cargando video en memoria del navegador...");
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Load watermark image if provided
    if (extras?.watermark?.file) {
      const wmExt =
        extras.watermark.file.name?.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".png";
      watermarkInputName = `watermark_${Date.now()}${wmExt}`;
      onStatus?.("Cargando marca de agua...");
      await ffmpeg.writeFile(
        watermarkInputName,
        await fetchFile(extras.watermark.file),
      );
    }

    // Build FFmpeg command arguments
    const args = [];

    // Trim: -ss before -i for fast seeking
    if (extras?.trimStart && extras.trimStart > 0) {
      args.push("-ss", String(extras.trimStart));
    }

    args.push("-i", inputName);

    // Trim: -to for end time (relative to -ss if used)
    if (extras?.trimEnd && extras.trimEnd > 0) {
      const duration =
        extras.trimStart && extras.trimStart > 0
          ? extras.trimEnd - extras.trimStart
          : extras.trimEnd;
      if (duration > 0) {
        args.push("-t", String(duration));
      }
    }

    // Add watermark as second input
    if (watermarkInputName) {
      args.push("-i", watermarkInputName);
    }

    // Video Codec & Quality
    args.push("-c:v", "libx264");
    args.push("-crf", String(settings.crf));
    args.push("-preset", settings.presetSpeed || "veryfast");
    args.push("-pix_fmt", "yuv420p");

    // Build video filter chain
    const vfFilters = [];

    // Resolution Scaling
    if (settings.width && settings.width > 0) {
      vfFilters.push(`scale='min(${settings.width},iw)':-2`);
    }

    // Crop filter
    if (extras?.cropRect) {
      const { x, y, w, h } = extras.cropRect;
      if (x !== 0 || y !== 0 || w !== 100 || h !== 100) {
        // Convert percentage to pixel expressions
        const cropW = `iw*${(w / 100).toFixed(4)}`;
        const cropH = `ih*${(h / 100).toFixed(4)}`;
        const cropX = `iw*${(x / 100).toFixed(4)}`;
        const cropY = `ih*${(y / 100).toFixed(4)}`;
        vfFilters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
      }
    }

    // Apply video filters (without watermark for now)
    if (watermarkInputName) {
      // Complex filtergraph for watermark overlay
      const wm = extras.watermark;
      // Scale watermark relative to video width, position in %
      const wmScaleW = `iw*${(wm.scale / 100).toFixed(4)}`;
      const overlayX = `main_w*${(wm.x / 100).toFixed(4)}`;
      const overlayY = `main_h*${(wm.y / 100).toFixed(4)}`;
      const opacity = wm.opacity.toFixed(2);

      let filterComplex = "";

      // Pre-filters on input video
      if (vfFilters.length > 0) {
        filterComplex += `[0:v]${vfFilters.join(",")}[base];`;
      } else {
        filterComplex += "[0:v]null[base];";
      }

      // Scale watermark and set opacity
      filterComplex += `[1:v]scale=${wmScaleW}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm];`;

      // Overlay
      filterComplex += `[base][wm]overlay=${overlayX}:${overlayY}[out]`;

      args.push("-filter_complex", filterComplex);
      args.push("-map", "[out]");
      args.push("-map", "0:a?");
    } else if (vfFilters.length > 0) {
      args.push("-vf", vfFilters.join(","));
    }

    // Target FPS if specified
    if (settings.fps && settings.fps > 0) {
      args.push("-r", String(settings.fps));
    }

    // Audio Codec & Bitrate
    if (settings.muteAudio) {
      args.push("-an");
    } else {
      args.push("-c:a", "aac");
      args.push("-b:a", settings.audioBitrate || "128k");
    }

    // Fast start for web streaming
    args.push("-movflags", "+faststart");
    args.push(outputName);

    onStatus?.("Procesando video con FFmpeg...");
    onLog?.(`> ffmpeg ${args.join(" ")}`);
    await ffmpeg.exec(args);

    onStatus?.("Generando archivo final...");
    const data = await ffmpeg.readFile(outputName);
    const compressedBlob = new Blob([data], { type: "video/mp4" });

    return compressedBlob;
  } finally {
    // Cleanup temporary files in WASM memory
    const deleteSafe = async (name) => {
      try { if (name) await ffmpeg.deleteFile(name); } catch (e) {}
    };
    await Promise.all([
      deleteSafe(inputName),
      deleteSafe(outputName),
      deleteSafe(watermarkInputName)
    ]);

    if (onLog) ffmpeg.off("log", logHandler);
    if (onProgress) ffmpeg.off("progress", progressHandler);
  }
}
