/* Camera-torch helper. Torch support depends on the phone and browser;
 * iOS Safari does not allow turning the torch on from the web page. */

let stream = null;
let track = null;

export async function initTorch() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: 'Este navegador não permite acessar a lanterna.' };
  }
  try {
    stream ||= await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    track = stream.getVideoTracks()[0] || null;
    if (!track) return { supported: false, reason: 'Nenhuma câmera encontrada.' };
    const caps = track.getCapabilities?.() || {};
    return {
      supported: Boolean(caps.torch),
      reason: caps.torch ? '' : 'Este aparelho não expõe a lanterna para o navegador. Use a tela branca.',
    };
  } catch (error) {
    return { supported: false, reason: `Sem acesso à câmera (${error.name}). Use a tela branca.` };
  }
}

export async function setTorch(on) {
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: Boolean(on) }] });
    return true;
  } catch {
    return false;
  }
}

export function stopTorch() {
  try {
    setTorch(false);
    stream?.getTracks().forEach((item) => item.stop());
  } catch { /* ignore */ }
  stream = null;
  track = null;
}
