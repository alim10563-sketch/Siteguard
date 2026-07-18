import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, Download, AlertTriangle, ShieldCheck, ClipboardList,
  Camera, Loader2, Leaf, Sparkles, X, ImagePlus,
} from "lucide-react";
import DavidsonPieCalculator from "../components/DavidsonPieCalculator";
const CATEGORIES = [
  "Chemical", "Mechanical", "Electrical", "Fire/Explosion",
  "Ergonomic", "Biological", "Environmental", "Fall/Slip", "Other",
];

const BAND = (score) => {
  if (score >= 20) return { label: "Critical", color: "#C1392B", text: "#FBEAE7" };
  if (score >= 12) return { label: "High", color: "#E8622C", text: "#2A160C" };
  if (score >= 6) return { label: "Medium", color: "#F5A623", text: "#2A2005" };
  return { label: "Low", color: "#4C9A6A", text: "#0D2016" };
};

const uid = () => Math.random().toString(36).slice(2, 10);

const STORE_KEY = "ehs-risk-assessments-v1";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function extractVideoFrame(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 1) / 3);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(url);
        resolve({ base64: dataUrl.split(",")[1] });
      } catch (e) {
        reject(e);
      }
    };
    video.onerror = () => reject(new Error("video read failed"));
  });
}

 function RiskMatrix() {
  const [assessments, setAssessments] = useState(null); // null = loading
  const [activeId, setActiveId] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [form, setForm] = useState(blankHazard());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, base64, mediaType }
  const fileInputRef = useRef(null);

  function blankHazard() {
    return {
      description: "",
      category: CATEGORIES[0],
      likelihood: 3,
      severity: 3,
      controls: "",
    };
  }

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      setAssessments(data);
      setActiveId(data[0]?.id ?? null);
    } catch {
      setAssessments([]);
    }
  }, []);

  const persist = useCallback((next) => {
    setSaveState("saving");
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch {
      setSaveState("error");
    }
  }, []);

  const update = (next) => {
    setAssessments(next);
    persist(next);
  };

  const active = assessments?.find((a) => a.id === activeId) ?? null;

  const addAssessment = () => {
    const a = { id: uid(), title: "Untitled site / process", createdAt: Date.now(), hazards: [], photoAnalyses: [] };
    const next = [a, ...(assessments ?? [])];
    update(next);
    setActiveId(a.id);
  };

  const deleteAssessment = (id) => {
    const next = assessments.filter((a) => a.id !== id);
    update(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const renameAssessment = (title) => {
    const next = assessments.map((a) => (a.id === activeId ? { ...a, title } : a));
    update(next);
  };

  const addHazard = () => {
    if (!form.description.trim()) return;
    const hazard = { id: uid(), ...form };
    const next = assessments.map((a) =>
      a.id === activeId ? { ...a, hazards: [...a.hazards, hazard] } : a
    );
    update(next);
    setForm(blankHazard());
  };

  const removeHazard = (hid) => {
    const next = assessments.map((a) =>
      a.id === activeId ? { ...a, hazards: a.hazards.filter((h) => h.id !== hid) } : a
    );
    update(next);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAnalyzeError("");

    try {
      let base64, mediaType;
      if (file.type.startsWith("video/")) {
        const frame = await extractVideoFrame(file);
        base64 = frame.base64;
        mediaType = "image/jpeg";
      } else {
        base64 = await fileToBase64(file);
        mediaType = file.type || "image/jpeg";
      }
      setPendingImage({ dataUrl: `data:${mediaType};base64,${base64}`, base64, mediaType });
      await runAnalysis(base64, mediaType);
    } catch (err) {
      setAnalyzeError("Couldn't read that file. Try another photo or video.");
    }
  };

  const runAnalysis = async (base64, mediaType) => {
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const prompt = `You are an EHS (environmental, health & safety) and ecological restoration expert inspecting a worksite photo. Look carefully at the image and respond ONLY with a JSON object, no markdown fences, no preamble, in this exact shape:
{
  "hazards_identified": ["short hazard description", ...],
  "mitigation_suggestions": ["specific, actionable step", ...],
  "site_recovery_steps": ["step to recover/stabilize the site after an incident", ...],
  "ecological_restoration": ["step to restore soil/vegetation/water/local ecology if affected", ...]
}
Each array should have 2-5 concise, specific, practical bullet points relevant to what's actually visible in the image. If a category genuinely doesn't apply (e.g. no ecological impact visible), return an empty array for it rather than inventing content.`;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType, prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Analysis request failed");
      const parsed = data; // proxy already returns parsed JSON fields
      const analysis = {
        id: uid(),
        createdAt: Date.now(),
        image: `data:${mediaType};base64,${base64}`,
        ...parsed,
      };
      const next = assessments.map((a) =>
        a.id === activeId
          ? { ...a, photoAnalyses: [analysis, ...(a.photoAnalyses || [])] }
          : a
      );
      update(next);
    } catch (err) {
      setAnalyzeError("Analysis failed. Please try again with a clearer photo.");
    } finally {
      setAnalyzing(false);
      setPendingImage(null);
    }
  };

  const removeAnalysis = (id) => {
    const next = assessments.map((a) =>
      a.id === activeId
        ? { ...a, photoAnalyses: (a.photoAnalyses || []).filter((p) => p.id !== id) }
        : a
    );
    update(next);
  };

  const addSuggestionAsHazard = (description) => {
    const hazard = { id: uid(), description, category: "Other", likelihood: 3, severity: 3, controls: "" };
    const next = assessments.map((a) =>
      a.id === activeId ? { ...a, hazards: [...a.hazards, hazard] } : a
    );
    update(next);
  };

  const exportReport = () => {
    if (!active) return;
    const lines = [
      `RISK ASSESSMENT REPORT`,
      `Site/Process: ${active.title}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      ...active.hazards.map((h, i) => {
        const b = BAND(h.likelihood * h.severity);
        return [
          `${i + 1}. ${h.description} [${h.category}]`,
          `   Likelihood: ${h.likelihood}/5  Severity: ${h.severity}/5  Score: ${h.likelihood * h.severity} — ${b.label}`,
          `   Controls: ${h.controls || "None recorded"}`,
          "",
        ].join("\n");
      }),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `risk-assessment-${active.title.replace(/\s+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (assessments === null) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Loading assessments…</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{fontImports}</style>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <ShieldCheck size={22} color="#F5A623" />
          <div>
            <div style={styles.brand}>SITEGUARD</div>
            <div style={styles.brandSub}>Risk Assessment Matrix</div>
          </div>
        </div>
        <div style={styles.saveIndicator}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Save failed"}
        </div>
      </header>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <button style={styles.newBtn} onClick={addAssessment}>
            <Plus size={16} /> New assessment
          </button>
          <div style={styles.sidebarList}>
            {assessments.length === 0 && (
              <div style={styles.emptyHint}>No assessments yet. Start one above.</div>
            )}
            {assessments.map((a) => (
              <div
                key={a.id}
                onClick={() => setActiveId(a.id)}
                style={{
                  ...styles.sidebarItem,
                  ...(a.id === activeId ? styles.sidebarItemActive : {}),
                }}
              >
                <ClipboardList size={14} color={a.id === activeId ? "#F5A623" : "#7A8B85"} />
                <span style={styles.sidebarItemTitle}>{a.title}</span>
                <Trash2
                  size={14}
                  color="#7A8B85"
                  style={{ cursor: "pointer", flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAssessment(a.id);
                  }}
                />
              </div>
            ))}
          </div>
        </aside>

        <main style={styles.main}>
          {!active ? (
            <div style={styles.emptyState}>
              <AlertTriangle size={32} color="#4A5551" />
              <p style={styles.emptyStateText}>
                Create an assessment to start logging hazards and scoring risk.
              </p>
            </div>
          ) : (
            <>
              <input
                style={styles.titleInput}
                value={active.title}
                onChange={(e) => renameAssessment(e.target.value)}
                placeholder="Site / process name"
              />

              <div style={styles.grid}>
                <section style={styles.formCard}>
                  <div style={styles.cardLabel}>Log a hazard</div>
                  <textarea
                    style={styles.textarea}
                    placeholder="Describe the hazard (e.g. unguarded conveyor belt near packing line)"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                  />
                  <div style={styles.row}>
                    <select
                      style={styles.select}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.sliderRow}>
                    <label style={styles.sliderLabel}>
                      Likelihood <span style={styles.sliderVal}>{form.likelihood}</span>
                    </label>
                    <input
                      type="range" min={1} max={5} value={form.likelihood}
                      onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })}
                      style={styles.slider}
                    />
                  </div>
                  <div style={styles.sliderRow}>
                    <label style={styles.sliderLabel}>
                      Severity <span style={styles.sliderVal}>{form.severity}</span>
                    </label>
                    <input
                      type="range" min={1} max={5} value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                      style={styles.slider}
                    />
                  </div>
                  <textarea
                    style={styles.textarea}
                    placeholder="Existing / planned controls"
                    value={form.controls}
                    onChange={(e) => setForm({ ...form, controls: e.target.value })}
                    rows={2}
                  />
                  <button style={styles.addBtn} onClick={addHazard}>
                    <Plus size={15} /> Add hazard
                  </button>
                </section>

                <section style={styles.matrixCard}>
                  <div style={styles.cardLabel}>Risk matrix</div>
                  <RiskGrid hazards={active.hazards} />
                  <Legend />
                </section>
              </div>

              <section style={styles.photoCard}>
                <div style={styles.listHeader}>
                  <div style={styles.cardLabel}>Site photo analysis</div>
                </div>
                <p style={styles.photoHint}>
                  Take a photo or short video of a hazard or affected site. It'll suggest
                  mitigation steps, site recovery actions, and ecological restoration measures.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                <button
                  style={styles.captureBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                >
                  {analyzing ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
                  {analyzing ? "Analyzing…" : "Capture photo / video"}
                </button>
                {analyzeError && <div style={styles.errorText}>{analyzeError}</div>}

                {(active.photoAnalyses || []).length > 0 && (
                  <div style={styles.analysesList}>
                    {(active.photoAnalyses || []).map((p) => (
                      <div key={p.id} style={styles.analysisCard}>
                        <div style={styles.analysisTop}>
                          <img src={p.image} alt="Captured site" style={styles.analysisImg} />
                          <X
                            size={14}
                            color="#7A8B85"
                            style={{ cursor: "pointer", flexShrink: 0 }}
                            onClick={() => removeAnalysis(p.id)}
                          />
                        </div>

                        <AnalysisGroup
                          icon={<AlertTriangle size={13} color="#E8622C" />}
                          title="Hazards identified"
                          items={p.hazards_identified}
                          onAdd={addSuggestionAsHazard}
                        />
                        <AnalysisGroup
                          icon={<Sparkles size={13} color="#F5A623" />}
                          title="Mitigation suggestions"
                          items={p.mitigation_suggestions}
                        />
                        <AnalysisGroup
                          icon={<ShieldCheck size={13} color="#4C9A6A" />}
                          title="Site recovery steps"
                          items={p.site_recovery_steps}
                        />
                        <AnalysisGroup
                          icon={<Leaf size={13} color="#4C9A6A" />}
                          title="Ecological restoration"
                          items={p.ecological_restoration}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={styles.listSection}>
                <div style={styles.listHeader}>
                  <div style={styles.cardLabel}>Logged hazards ({active.hazards.length})</div>
                  {active.hazards.length > 0 && (
                    <button style={styles.exportBtn} onClick={exportReport}>
                      <Download size={14} /> Export report
                    </button>
                  )}
                </div>
                {active.hazards.length === 0 ? (
                  <div style={styles.emptyHint}>No hazards logged yet.</div>
                ) : (
                  <div style={styles.hazardList}>
                    {active.hazards.map((h) => {
                      const b = BAND(h.likelihood * h.severity);
                      return (
                        <div key={h.id} style={styles.hazardRow}>
                          <div style={{ ...styles.scoreBadge, background: b.color, color: b.text }}>
                            {h.likelihood * h.severity}
                          </div>
                          <div style={styles.hazardInfo}>
                            <div style={styles.hazardDesc}>{h.description}</div>
                            <div style={styles.hazardMeta}>
                              {h.category} · {b.label} · L{h.likelihood} × S{h.severity}
                              {h.controls ? ` · Controls: ${h.controls}` : ""}
                            </div>
                          </div>
                          <Trash2
                            size={15}
                            color="#7A8B85"
                            style={{ cursor: "pointer", flexShrink: 0 }}
                            onClick={() => removeHazard(h.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function RiskGrid({ hazards }) {
  const cells = {};
  hazards.forEach((h) => {
    const key = `${h.likelihood}-${h.severity}`;
    cells[key] = (cells[key] || 0) + 1;
  });

  return (
    <div style={styles.gridWrap}>
      <div style={styles.gridAxisY}>Severity</div>
      <div style={styles.gridGrid}>
        {[5, 4, 3, 2, 1].map((sev) => (
          <div key={sev} style={styles.gridRow}>
            {[1, 2, 3, 4, 5].map((lik) => {
              const score = lik * sev;
              const b = BAND(score);
              const count = cells[`${lik}-${sev}`];
              return (
                <div
                  key={lik}
                  style={{
                    ...styles.cell,
                    background: b.color + "33",
                    borderColor: b.color + "66",
                  }}
                  title={`Likelihood ${lik} × Severity ${sev} = ${score}`}
                >
                  {count && (
                    <span style={{ ...styles.cellDot, background: b.color }}>{count}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={styles.gridAxisX}>Likelihood →</div>
    </div>
  );
}

function AnalysisGroup({ icon, title, items, onAdd }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={styles.analysisGroup}>
      <div style={styles.analysisGroupTitle}>
        {icon} {title}
      </div>
      <ul style={styles.analysisGroupList}>
        {items.map((item, i) => (
          <li key={i} style={styles.analysisGroupItem}>
            <span>{item}</span>
            {onAdd && (
              <button style={styles.addSuggestionBtn} onClick={() => onAdd(item)}>
                <ImagePlus size={11} /> Log as hazard
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend() {
  const bands = [
    { label: "Low (1–5)", color: "#4C9A6A" },
    { label: "Medium (6–11)", color: "#F5A623" },
    { label: "High (12–19)", color: "#E8622C" },
    { label: "Critical (20–25)", color: "#C1392B" },
  ];
  return (
    <div style={styles.legend}>
      {bands.map((b) => (
        <div key={b.label} style={styles.legendItem}>
          <span style={{ ...styles.legendSwatch, background: b.color }} />
          {b.label}
        </div>
      ))}
    </div>
  );
}

const fontImports = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

const styles = {
  app: {
    fontFamily: "'Inter', sans-serif",
    background: "#161B19",
    color: "#ECE8E1",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  loadingWrap: {
    minHeight: "100vh",
    background: "#161B19",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#7A8B85", fontFamily: "'Inter', sans-serif" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid #2A322F",
    background: "#1C2321",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  brand: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "0.06em",
    color: "#ECE8E1",
  },
  brandSub: { fontSize: 11, color: "#7A8B85" },
  saveIndicator: { fontSize: 11, color: "#7A8B85", fontFamily: "'IBM Plex Mono', monospace" },
  body: { display: "flex", flex: 1, minHeight: 0 },
  sidebar: {
    width: 220,
    borderRight: "1px solid #2A322F",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flexShrink: 0,
  },
  newBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    background: "#F5A623",
    color: "#2A2005",
    border: "none",
    borderRadius: 6,
    padding: "8px 10px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  sidebarList: { display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" },
  sidebarItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    color: "#B8C2BE",
  },
  sidebarItemActive: { background: "#232B28", color: "#ECE8E1" },
  sidebarItemTitle: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  emptyHint: { fontSize: 12, color: "#5E6A66", padding: "8px 4px" },
  main: { flex: 1, padding: 20, overflowY: "auto", minWidth: 0 },
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    color: "#5E6A66",
  },
  emptyStateText: { fontSize: 13, maxWidth: 260, textAlign: "center" },
  titleInput: {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #2A322F",
    color: "#ECE8E1",
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    padding: "4px 0 8px 0",
    marginBottom: 16,
    width: "100%",
    outline: "none",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 20,
  },
  formCard: {
    background: "#1C2321",
    border: "1px solid #2A322F",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  matrixCard: {
    background: "#1C2321",
    border: "1px solid #2A322F",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#7A8B85",
    fontWeight: 600,
    marginBottom: 4,
  },
  textarea: {
    background: "#161B19",
    border: "1px solid #2A322F",
    borderRadius: 6,
    color: "#ECE8E1",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
    resize: "vertical",
    outline: "none",
  },
  row: { display: "flex", gap: 8 },
  select: {
    background: "#161B19",
    border: "1px solid #2A322F",
    borderRadius: 6,
    color: "#ECE8E1",
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
    flex: 1,
  },
  sliderRow: { display: "flex", flexDirection: "column", gap: 4 },
  sliderLabel: {
    fontSize: 12,
    color: "#B8C2BE",
    display: "flex",
    justifyContent: "space-between",
  },
  sliderVal: { fontFamily: "'IBM Plex Mono', monospace", color: "#F5A623" },
  slider: { width: "100%", accentColor: "#F5A623" },
  addBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "#2A322F",
    color: "#ECE8E1",
    border: "1px solid #3A443F",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  gridWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  gridAxisY: {
    fontSize: 10,
    color: "#7A8B85",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  gridGrid: { display: "flex", flexDirection: "column", gap: 3 },
  gridRow: { display: "flex", gap: 3 },
  cell: {
    width: 36,
    height: 36,
    borderRadius: 4,
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cellDot: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    color: "#161B19",
    fontWeight: 700,
  },
  gridAxisX: {
    fontSize: 10,
    color: "#7A8B85",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: 2,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 14px",
    marginTop: 12,
    justifyContent: "center",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#B8C2BE" },
  legendSwatch: { width: 9, height: 9, borderRadius: 2, display: "inline-block" },
  photoCard: {
    background: "#1C2321",
    border: "1px solid #2A322F",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  photoHint: { fontSize: 12.5, color: "#7A8B85", margin: "4px 0 12px 0", lineHeight: 1.5 },
  captureBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#F5A623",
    color: "#2A2005",
    border: "none",
    borderRadius: 6,
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  errorText: { color: "#E8622C", fontSize: 12, marginTop: 8 },
  analysesList: { display: "flex", flexDirection: "column", gap: 14, marginTop: 16 },
  analysisCard: {
    background: "#161B19",
    border: "1px solid #2A322F",
    borderRadius: 8,
    padding: 12,
  },
  analysisTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  analysisImg: { width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 6 },
  analysisGroup: { marginTop: 10 },
  analysisGroupTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#B8C2BE",
    marginBottom: 6,
  },
  analysisGroupList: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 },
  analysisGroupItem: {
    fontSize: 12.5,
    color: "#ECE8E1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  addSuggestionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    border: "1px solid #3A443F",
    color: "#7A8B85",
    borderRadius: 5,
    padding: "3px 7px",
    fontSize: 10.5,
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  listSection: { marginTop: 4 },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "1px solid #3A443F",
    color: "#ECE8E1",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  hazardList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10 },
  hazardRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#1C2321",
    border: "1px solid #2A322F",
    borderRadius: 8,
    padding: "10px 12px",
  },
  scoreBadge: {
    width: 34,
    height: 34,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  hazardInfo: { flex: 1, minWidth: 0 },
  hazardDesc: { fontSize: 13.5, color: "#ECE8E1" },
  hazardMeta: { fontSize: 11.5, color: "#7A8B85", marginTop: 2 },
};
const tabStyle = {
  background: "transparent",
  border: "1px solid #3A443F",
  color: "#B8C2BE",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};

const tabActive = {
  background: "#F5A623",
  color: "#2A2005",
  borderColor: "#F5A623",
  fontWeight: 600,
};

export default function App() {
  const [view, setView] = useState("risk");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "10px 20px", background: "#1C2321", borderBottom: "1px solid #2A322F" }}>
        <button style={{ ...tabStyle, ...(view === "risk" ? tabActive : {}) }} onClick={() => setView("risk")}>
          Risk Matrix
        </button>
        <button style={{ ...tabStyle, ...(view === "davidson" ? tabActive : {}) }} onClick={() => setView("davidson")}>
          Davidson Pie
        </button>
      </div>
      {view === "risk" ? <RiskMatrix /> : <DavidsonPieCalculator />}
    </div>
  );
}
