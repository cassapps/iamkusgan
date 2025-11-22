import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ModalWrapper from "./ModalWrapper";

export default function CameraModal({ open, onClose, onCapture, waitForAck = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const startingRef = useRef(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  // Stop current stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Start a stream for a specific device
  const startStream = async (id = "") => {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    setError("");
    stopStream();
  try {
      const preferred = id
        ? { video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }
        : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferred);
      } catch (err1) {
        // Fallbacks for common failures
        try {
          const fallback = id
            ? { video: { deviceId: { ideal: id } }, audio: false }
            : { video: true, audio: false };
          stream = await navigator.mediaDevices.getUserMedia(fallback);
        } catch (err2) {
          const e = err2 || err1;
          const name = e && e.name ? String(e.name) : "";
          if (name === "NotAllowedError") {
            setError("Camera permission denied. Please allow camera access in the browser site settings and macOS Privacy > Camera.");
          } else if (name === "NotReadableError") {
            setError("Camera is busy or not readable. Close other apps using the camera (e.g., Zoom/Meet/FaceTime) and try again.");
          } else if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
            setError("Selected camera doesn't meet constraints. Try choosing a different camera.");
          } else if (name === "NotFoundError") {
            setError("No camera found. Plug in a camera or check system permissions.");
          } else {
            setError("Cannot access camera. Check site permissions and OS privacy settings.");
          }
          return; // stop on failure
        }
      }

      // Success path
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch { /* ignore play errors (autoplay), stream is set */ }
      }
      // After success, refresh device labels (permissions granted now)
      try { await refreshDevices(); } catch { /* ignore */ }
    } catch (e) {
      setError("Cannot access camera. Check site permissions and OS privacy settings.");
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  };

  // Enumerate video devices (after first permission grant, labels appear)
  const refreshDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId);
    } catch {
      /* ignore */
    }
  };

  // Open/close lifecycle
  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    (async () => {
      setError("");
      // Proactively request permission and begin streaming; this also helps reveal device labels
      await startStream(deviceId || "");
    })();

    // listen for device changes (e.g., plug/unplug USB camera)
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Switch camera when the selector changes
  useEffect(() => {
    if (!open || !deviceId) return;
    try {
      const currentId = streamRef.current?.getVideoTracks?.()[0]?.getSettings?.().deviceId || "";
      if (currentId && currentId === deviceId) return; // already on this device
    } catch { /* ignore */ }
    startStream(deviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const takeSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const naturalW = video.videoWidth || 1280;
    const naturalH = video.videoHeight || 720;
    // resize to max width to reduce file size (important on free Firebase)
    const maxW = 800;
    const scale = naturalW > maxW ? (maxW / naturalW) : 1;
    const w = Math.max(320, Math.round(naturalW * scale));
    const h = Math.max(240, Math.round(naturalH * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    // use slightly lower quality to save storage (free tier)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    // Immediately hand the captured photo back to the parent and close the camera
    // This produces a smoother UX: after pressing Capture the user returns to the
    // Edit modal and preview is handled there. If the parent returns a Promise
    // and requested `waitForAck`, we'll await it before closing.
    try {
      const maybe = onCapture?.(dataUrl);
      if (waitForAck && maybe && typeof maybe.then === 'function') {
        // If caller asked us to wait for the parent's ack, show processing state.
        setIsProcessing(true);
        try {
          await Promise.resolve(maybe);
        } catch (e) {
          // surface error but continue to cleanup
          setError((e && e.message) ? e.message : String(e || 'Failed to process photo'));
        }
      } else {
        // fire-and-forget; surface any rejections
        try {
          if (maybe && typeof maybe.then === 'function') maybe.catch((e) => { try { setError(String(e?.message || e)); } catch {} });
        } catch {}
      }
    } catch (e) {
      setError((e && e.message) ? e.message : String(e || 'Failed to process photo'));
    } finally {
      // always clear processing flag, stop stream and close modal
      try { setIsProcessing(false); } catch {}
      stopStream();
      onClose?.();
    }
  };

  const [captured, setCaptured] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const acceptCapture = () => {
    // kept for backwards compat; replaced by async handler below
  };
  const acceptCaptureAsync = async () => {
    if (!captured) return;
    setError("");
    const maybe = onCapture?.(captured);
    if (waitForAck && maybe && typeof maybe.then === "function") {
      setIsProcessing(true);
      try {
        await Promise.resolve(maybe);
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e || "Failed to process photo");
        setError(msg);
      } finally {
        setIsProcessing(false);
        setCaptured(null);
        onClose?.();
      }
      return;
    }

    // Default/smoother UX: do not wait; close immediately and let parent process in background
    try {
      if (maybe && typeof maybe.then === 'function') maybe.catch((e) => { try { setError(String(e?.message || e)); } catch {} });
    } catch {}
    setCaptured(null);
    onClose?.();
  };
  const retake = () => {
    setCaptured(null);
    // restart stream to ensure camera active
    startStream(deviceId || "");
  };

  if (!open) return null;

  const modal = (
    <ModalWrapper open={open} onClose={onClose} width={720} noWrapper={true}>

          {/* Camera selector */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Camera:</label>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e7e8ef" }}
            >
              {devices.length === 0 && <option value="">(No camera found)</option>}
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          </div>

          {!error && !streamRef.current && (
            <div style={{ color: "#666", marginBottom: 8 }}>
              Initializing camera… please allow the browser prompt.
            </div>
          )}
          {error ? (
            <div style={{ color: "#d33", marginBottom: 12 }}>
              {error}
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              {!captured ? (
                <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 10, background: "#000" }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <img src={captured} alt="preview" style={{ width: '100%', borderRadius: 10 }} />
                  <div style={{ color: '#666', fontSize: 13 }}>Preview — accept to use this photo or retake.</div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
            {!captured ? (
              <>
                <button type="button" className="button btn-lg" onClick={takeSnapshot} disabled={!!error || !streamRef.current}>Capture</button>
              </>
            ) : (
              <>
                <button type="button" className="button" onClick={retake} disabled={isProcessing}>Retake</button>
                <button type="button" className="button btn-lg" onClick={acceptCaptureAsync} disabled={isProcessing}>
                  {isProcessing ? 'Processing…' : 'Use Photo'}
                </button>
              </>
            )}
          </div>
    </ModalWrapper>
  );

  return createPortal(modal, document.body);
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    width: "min(720px, 92vw)", background: "#fff", borderRadius: 12,
    padding: 16, border: "1px solid #e7e8ef", boxShadow: "0 6px 24px rgba(0,0,0,.2)",
  },
};
