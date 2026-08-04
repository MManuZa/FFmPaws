import fs from 'fs';
import path from 'path';
import https from 'https';

const destDir = path.resolve('public', 'ffmpeg');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Descargando ${url} -> ${destPath}...`);
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Error ${response.statusCode} al descargar ${url}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`¡Completado!: ${destPath}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await downloadFile(`${baseURL}/ffmpeg-core.js`, path.join(destDir, 'ffmpeg-core.js'));
  await downloadFile(`${baseURL}/ffmpeg-core.wasm`, path.join(destDir, 'ffmpeg-core.wasm'));
  console.log('Archivos de FFmpeg WASM descargados exitosamente en public/ffmpeg/');
}

main().catch((err) => {
  console.error('Error al descargar FFmpeg assets:', err);
  process.exit(1);
});
