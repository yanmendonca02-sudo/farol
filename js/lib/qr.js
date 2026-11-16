/* QR rendering (qrcode-generator) and scanning (BarcodeDetector or jsQR). */

export const QR_MAX_CHARS = 900;

export function qrAvailable() {
  return typeof window.qrcode === 'function';
}

export function qrDataUrl(text, { margin = 2, ecc = 'M' } = {}) {
  if (!qrAvailable()) throw new Error('Biblioteca de QR não disponível.');
  if (text.length > QR_MAX_CHARS) throw new Error('Texto grande demais para um QR code. Divida em partes.');
  const qr = window.qrcode(0, ecc);
  qr.addData(text);
  qr.make();
  return qr.createDataURL(5, margin * 5);
}

export function qrImage(text, options = {}) {
  const img = document.createElement('img');
  img.alt = 'Código QR com o conteúdo para copiar';
  img.src = qrDataUrl(text, options);
  return img;
}

export function scannerAvailable() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function nativeDetectorAvailable() {
  return typeof window.BarcodeDetector === 'function';
}

export async function startScanner(video, onText, onError) {
  if (!scannerAvailable()) {
    onError?.('Este navegador não abre a câmera para ler QR. Digite o código manualmente.');
    return null;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
  } catch (error) {
    onError?.(`Não foi possível abrir a câmera (${error.name}). Digite o código manualmente.`);
    return null;
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  try { await video.play(); } catch { /* autoplay can fail on some browsers */ }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  let detector = null;
  if (nativeDetectorAvailable()) {
    try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
  }

  const scan = async () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes?.length) {
            onText(codes[0].rawValue);
            stop();
            return;
          }
        } else if (typeof window.jsQR === 'function') {
          const scale = Math.min(1, 900 / Math.max(1, video.videoWidth));
          canvas.width = Math.floor(video.videoWidth * scale);
          canvas.height = Math.floor(video.videoHeight * scale);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = window.jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
          if (result?.data) {
            onText(result.data);
            stop();
            return;
          }
        }
      } catch { /* keep trying */ }
    }
    setTimeout(scan, 220);
  };

  const stop = () => {
    stopped = true;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  scan();
  return stop;
}
