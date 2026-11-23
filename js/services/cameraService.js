(function() {
  'use strict';
  window.Wared = window.Wared || {};

/* ==========================================================================
   Isolated Device Camera Service (MediaDevices + Canvas Frame Capture)
   ========================================================================== */

let activeStream = null;

async function startDeviceCamera(videoEl) {
  stopDeviceCamera();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { ok: false, error: 'المتصفح لا يدعم فتح الكاميرا مباشرة، يمكنك رفع صورة الفاتورة.' };
  }

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (videoEl) {
      videoEl.srcObject = activeStream;
      await videoEl.play();
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: 'تعذر الوصول لكاميرا الجهاز. اسمح بصلاحية الكاميرا أو ارفع صورة الفاتورة من جهازك.'
    };
  }
}

function captureFrameFromVideo(videoEl) {
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function stopDeviceCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
}

  window.Wared.CameraService = { startDeviceCamera, captureFrameFromVideo, stopDeviceCamera };
})();
