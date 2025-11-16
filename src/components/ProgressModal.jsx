import React, { useEffect, useMemo, useState } from "react";
// CameraModal intentionally not imported here: use file picker for progress photos so
// the camera UI only appears from Add/Edit member flows.
import ModalWrapper from "./ModalWrapper";
import events from "../lib/events";
import api from "../api";
const { addProgressRow, uploadMemberPhoto } = api;

// Manila timezone helpers
const MANILA_TZ = "Asia/Manila";
const manilaTodayYMD = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const displayManila = (dOrYmd) => {
  if (!dOrYmd) return "-";
  let date;
  if (typeof dOrYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dOrYmd)) {
    const [y, m, d] = dOrYmd.split("-").map(Number);
    date = new Date(Date.UTC(y, m - 1, d));
  } else {
    date = dOrYmd instanceof Date ? dOrYmd : new Date(dOrYmd);
  }
  if (isNaN(date)) return "-";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: MANILA_TZ, month: "short", day: "numeric", year: "numeric" }).formatToParts(date);
  const m = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  const y = parts.find((p) => p.type === "year")?.value || "";
  return `${m}-${day}, ${y}`;
};

// Inclusive day count: MemberSince is Day 1
function inclusiveDayNo(memberSinceYMD, todayYMD) {
  if (!memberSinceYMD || !todayYMD) return 1;
  const [y1, m1, d1] = memberSinceYMD.split("-").map(Number);
  const [y2, m2, d2] = todayYMD.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.floor((b - a) / 86400000);
  return Math.max(1, diffDays + 1);
}

function dataUrlToFile(dataUrl, filename = `photo-${Date.now()}.jpg`) {
  try {
    const arr = dataUrl.split(",");
    const mime = (arr[0].match(/:(.*?);/)?.[1]) || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new File([u8], filename, { type: mime });
  } catch {
    return null;
  }
}

export default function ProgressModal({ open, onClose, memberId, memberSinceYMD, onSaved, memberNick }) {
  // Disable photo capture/upload UI if camera is not configured yet.
  const PHOTOS_ENABLED = false;
  const today = manilaTodayYMD();
  const dayNo = useMemo(() => inclusiveDayNo(memberSinceYMD, today), [memberSinceYMD, today]);

  // Form values (use metric UI as commonly used in PH: kg & cm)
  const [kg, setKg] = useState("");
  const [cm, setCm] = useState("");
  const [muscle, setMuscle] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [visceralFat, setVisceralFat] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [shoulders, setShoulders] = useState("");
  const [arms, setArms] = useState("");
  const [forearms, setForearms] = useState("");
  const [thighs, setThighs] = useState("");
  const [calves, setCalves] = useState("");
  const [bp, setBp] = useState("");
  const [rhr, setRhr] = useState("");
  const [comments, setComments] = useState("");

  // Photos (max 3)
  const [photos, setPhotos] = useState([]); // array of URLs at indices 0..2
  // camera modal removed for progress entries; use file picker instead
  const fileInputRef = React.useRef(null);
  const [activeIdx, setActiveIdx] = useState(-1); // which box is being filled/replaced
  const [err, setErr] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Derived
  const bmi = useMemo(() => {
    const w = Number(kg) || 0;
    const hM = (Number(cm) || 0) / 100;
    if (!w || !hM) return 0;
    return Math.round((w / (hM * hM)) * 10) / 10; // one decimal
  }, [kg, cm]);

  const lbs = useMemo(() => Math.round((Number(kg) || 0) * 2.20462262185 * 10) / 10, [kg]);
  const inches = useMemo(() => Math.round(((Number(cm) || 0) / 2.54) * 10) / 10, [cm]);

  useEffect(() => {
    if (!open) return;
    // reset when opened
  setKg(""); setCm(""); setMuscle(""); setBodyFat(""); setVisceralFat("");
  setChest(""); setWaist(""); setHips(""); setShoulders("");
  setArms(""); setForearms(""); setThighs(""); setCalves("");
    setBp(""); setRhr(""); setComments("");
    setPhotos([]);
    setActiveIdx(-1);
    setIsSaving(false);
  }, [open]);

  const onFilePick = async (file) => {
    if (!file) return;
    try {
      const baseId = String(memberId || "").toLowerCase();
      const res = await uploadMemberPhoto(file, baseId);
      const url = typeof res === "string" ? res : (res?.url || "");
      setPhotos((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        while (next.length < 3) next.push("");
        const idx = activeIdx >= 0 && activeIdx < 3 ? activeIdx : next.findIndex((x) => !x);
        if (idx === -1) return next;
        next[idx] = url;
        return next;
      });
    } catch (e) {
      const msg = e?.message || 'Failed to upload photo';
      setErr(msg);
      try { events.emit('modal:error', { message: msg, source: 'ProgressModal', error: String(e) }); } catch (ee) {}
    } finally {
      setActiveIdx(-1);
    }
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      if (idx < 0 || idx >= 3) return next;
      if (next.length < 3) while (next.length < 3) next.push("");
      next[idx] = ""; // clear but keep slot
      return next;
    });
  };

  const openPickerFor = (idx) => {
    setActiveIdx(idx);
    try {
      if (fileInputRef.current) fileInputRef.current.value = null;
      fileInputRef.current?.click();
    } catch (e) { setErr('Cannot open file picker'); }
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!memberId) return;
    if (isSaving) return;
    setIsSaving(true);
    setErr("");
    const row = {
      MemberID: memberId,
      Date: today,
      No: `Day ${dayNo}`,
      // Store metric-first fields (kg / cm)
      "Weight (kg)": kg ? String(kg) : "",
      "Weight(kg)": kg ? String(kg) : "",
      WeightKg: kg ? String(kg) : "",
      Weight: kg ? String(kg) : "",
      BMI: bmi ? String(bmi) : "",
      MuscleMass: muscle ? String(muscle) : "",
      BodyFat: bodyFat ? String(bodyFat) : "",
      VisceralFat: visceralFat ? String(visceralFat) : "",
      Photo1URL: photos[0] || "",
      Photo2URL: photos[1] || "",
      Photo3URL: photos[2] || "",
      // Height in cm
      "Height (cm)": cm ? String(cm) : "",
      "Height(cm)": cm ? String(cm) : "",
      HeightCm: cm ? String(cm) : "",
      Height: cm ? String(cm) : "",
      Chest: chest ? String(chest) : "",
      Waist: waist ? String(waist) : "",
      Hips: hips ? String(hips) : "",
      Shoulders: shoulders ? String(shoulders) : "",
      Arms: arms ? String(arms) : "",
      Forearms: forearms ? String(forearms) : "",
      Thighs: thighs ? String(thighs) : "",
      Calves: calves ? String(calves) : "",
      BloodPressure: bp,
      "RestingHeart Rate": rhr,
      Comments: comments,
    };
    try {
      await addProgressRow(row);
      onSaved?.();
      onClose?.();
    } catch (e) {
      const msg = e?.message || 'Failed to save progress entry';
      setErr(msg);
      try { events.emit('modal:error', { message: msg, source: 'ProgressModal', error: String(e) }); } catch (ee) {}
    }
    finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalWrapper open={open} onClose={onClose} title="Progress Entry" width={1000}>
      {err && <div className="small-error" style={{ marginBottom: 8 }}>{err}</div>}
  <form onSubmit={save} style={{ width: "100%", padding: 0, background: "transparent", border: "none", boxShadow: "none", overflow: "visible" }}>

        {/* Auto info row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 14, fontStyle: "italic", color: "var(--muted)", display: "block", marginBottom: 4 }}>Nickname</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{memberNick || memberId}</div>
          </div>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 14, fontStyle: "italic", color: "var(--muted)", display: "block", marginBottom: 4 }}>Date</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{displayManila(today)}</div>
          </div>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 14, fontStyle: "italic", color: "var(--muted)", display: "block", marginBottom: 4 }}>No.</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{`Day ${dayNo}`}</div>
          </div>
        </div>

        {/* Measurements (metric UI) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <label className="field"><span className="label">Weight (kg)</span><input type="number" step="0.1" min="0" value={kg} onChange={(e)=>setKg(e.target.value)} /></label>
          <label className="field"><span className="label">Height (cm)</span><input type="number" step="0.1" min="0" value={cm} onChange={(e)=>setCm(e.target.value)} /></label>
          {/* BMI read-only, but label styling same as other fields */}
          <div className="field">
            <span className="label">BMI</span>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, fontWeight: 700 }}>
              {bmi || "-"}
            </div>
          </div>

          <label className="field"><span className="label">Muscle Mass</span><input type="number" step="0.1" min="0" value={muscle} onChange={(e)=>setMuscle(e.target.value)} /></label>
          <label className="field"><span className="label">Body Fat (%)</span><input type="number" step="0.1" min="0" value={bodyFat} onChange={(e)=>setBodyFat(e.target.value)} /></label>
          <label className="field"><span className="label">Visceral Fat</span><input type="number" step="0.1" min="0" value={visceralFat} onChange={(e)=>setVisceralFat(e.target.value)} /></label>

          <label className="field"><span className="label">Chest (cm)</span><input type="number" step="0.1" min="0" value={chest} onChange={(e)=>setChest(e.target.value)} /></label>
          <label className="field"><span className="label">Waist (cm)</span><input type="number" step="0.1" min="0" value={waist} onChange={(e)=>setWaist(e.target.value)} /></label>
          <label className="field"><span className="label">Hips (cm)</span><input type="number" step="0.1" min="0" value={hips} onChange={(e)=>setHips(e.target.value)} /></label>

          <label className="field"><span className="label">Shoulders (cm)</span><input type="number" step="0.1" min="0" value={shoulders} onChange={(e)=>setShoulders(e.target.value)} /></label>
          <label className="field"><span className="label">Arms (cm)</span><input type="number" step="0.1" min="0" value={arms} onChange={(e)=>setArms(e.target.value)} /></label>
          <label className="field"><span className="label">Forearms (cm)</span><input type="number" step="0.1" min="0" value={forearms} onChange={(e)=>setForearms(e.target.value)} /></label>

          <label className="field"><span className="label">Thighs (cm)</span><input type="number" step="0.1" min="0" value={thighs} onChange={(e)=>setThighs(e.target.value)} /></label>
          <label className="field"><span className="label">Calves (cm)</span><input type="number" step="0.1" min="0" value={calves} onChange={(e)=>setCalves(e.target.value)} /></label>

          <label className="field"><span className="label">Blood Pressure</span><input placeholder="120/80" value={bp} onChange={(e)=>setBp(e.target.value)} /></label>
          <label className="field"><span className="label">Resting Heart Rate</span><input type="number" step="1" min="0" value={rhr} onChange={(e)=>setRhr(e.target.value)} /></label>
          <div />
        </div>

        {/* Photos: 3 clickable boxes; each opens camera; previews sized reliably */}
        <div style={{ marginTop: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>Photos (max 3)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[0,1,2].map((i) => {
              const url = photos[i] || "";
              return (
                <div key={i} style={{ position: "relative" }}>
                  {/* Aspect ratio wrapper (3:4) works across Safari/Chrome */}
                  <div
                    onClick={() => { if (PHOTOS_ENABLED) openPickerFor(i); }}
                    style={{
                      position: "relative",
                      width: "100%",
                      height: 0,
                      paddingTop: "133.333%",
                      borderRadius: 8,
                      border: url ? "1px solid #e5e7eb" : "1px dashed #e5e7eb",
                      cursor: PHOTOS_ENABLED ? "pointer" : "default",
                      overflow: "hidden",
                      background: url ? "#fff" : "#fafafa",
                      opacity: PHOTOS_ENABLED ? 1 : 0.65,
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`Photo ${i+1}`}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
                        {PHOTOS_ENABLED ? 'Click to add' : 'Photo disabled'}
                      </div>
                    )}
                  </div>
                  {url && (
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removePhoto(i)}
                      style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 6, padding: "4px 6px", border: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hidden file input used for adding progress photos. We don't expose the camera modal here so
            the camera UI only appears from Add/Edit member flows. On mobile, `capture` may hint camera. */}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return; onFilePick(f);
        }} />

        {/* Comments */}
        <div className="field" style={{ marginTop: 12 }}>
          <span className="label">Comments</span>
          <textarea rows={4} value={comments} onChange={(e)=>setComments(e.target.value)} style={{ width: "100%", borderRadius: 8, border: "1px solid #e5e7eb", padding: 12, fontFamily: "inherit", resize: "vertical", fontSize: 16 }} />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="back-btn" onClick={onClose} style={{ background: "#e5e7eb", color: "#111", fontWeight: 700 }}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={isSaving}>
            {isSaving ? 'Saving...' : '💾 Save Progress'}
          </button>
        </div>

        {/* CameraModal intentionally omitted here — use file picker for progress photos */}
        </form>
      </ModalWrapper>
    );
}
