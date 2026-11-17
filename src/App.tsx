import { useEffect, useMemo, useState } from "react";
import { classifyKano, opportunityScore, relativeImportance, technicalImportance, type HoQMetric, type HoQNeed, type KanoAnswer } from "./domain/analysisModels";
import { useWorkspaceStore } from "./state/workspaceStore";
import { generateIdeaAnalysis, type GeneratedAnalysis } from "./services/ideaAnalysis";
import { generateBenchmarkAnalysis, type BenchmarkAnalysis, type BenchmarkType } from "./services/benchmarkAnalysis";
import { askProductCopilot, type CopilotContext } from "./services/productCopilot";
import type { ProjectHistoryEntry } from "./domain/projectHistory";
import "./styles.css";

type View = "workspace" | "hoq" | "kano" | "benchmarking" | "intelligence";
const answers: KanoAnswer[] = ["like", "expect", "neutral", "live_with", "dislike"];
const initialMetrics: HoQMetric[] = [
  { id: "m1", name: "Seal integrity", direction: "up", target: "≥ 98%" },
  { id: "m2", name: "Thermal retention", direction: "up", target: "8 hours" },
  { id: "m3", name: "Total mass", direction: "down", target: "≤ 1.2 kg" },
  { id: "m4", name: "Opening force", direction: "target", target: "25 ± 5 N" },
];
const initialNeeds: HoQNeed[] = [
  { id: "n1", need: "Keep food safe through a long shift", importance: 5, relationships: [9, 9, 1, 3] },
  { id: "n2", need: "Open the box with one hand", importance: 4, relationships: [3, 1, 1, 9] },
  { id: "n3", need: "Clean it quickly after work", importance: 4, relationships: [3, 1, 3, 3] },
  { id: "n4", need: "Carry it comfortably", importance: 3, relationships: [1, 3, 9, 1] },
];
type KanoFeature = { id: string; feature: string; functional: KanoAnswer; dysfunctional: KanoAnswer; importance: number; satisfaction: number };
type MainReport = (GeneratedAnalysis & { title: string }) | null;

function exportFile(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PdfButton({ label = "Generate PDF report" }: { label?: string }) {
  return <button className="export-button" onClick={() => printPdf("ideaview-report")}>{label}</button>;
}

function printPdf(filename: string) {
  const previousTitle = document.title;
  document.title = filename;
  window.print();
  window.setTimeout(() => { document.title = previousTitle; }, 1000);
}

function CopilotMessage({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return <div className="copilot-markdown">{lines.map((line, index) => {
    if (line.startsWith("### ")) return <h4 key={index}>{line.slice(4)}</h4>;
    if (line.startsWith("- ") || line.startsWith("* ")) return <li key={index}>{line.slice(2)}</li>;
    if (!line.trim()) return <span className="copilot-break" key={index} />;
    return <p key={index}>{line}</p>;
  })}</div>;
}

function ToolReviewPanel({ title, description, candidates, onApply }: { title: string; description: string; candidates: string[]; onApply: (selected: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(candidates);
  const toggle = (candidate: string) => setSelected(selected.includes(candidate) ? selected.filter((item) => item !== candidate) : [...selected, candidate]);
  return <section className="tool-review-panel">
    <div className="tool-review-head"><div><span className="report-section-label">Report-first review</span><h3>{title}</h3><p>{description}</p></div><div className="analysis-actions"><button className="secondary-button" onClick={() => setOpen(true)}>Generate detailed report</button><PdfButton /></div></div>
    {open && <div className="tool-review-body"><div className="report-review-note">AI-assisted draft. Review the evidence and keep only the items that belong in this model.</div><div className="selectable-list">{candidates.map((candidate) => <label key={candidate} className={selected.includes(candidate) ? "selected" : ""}><input type="checkbox" checked={selected.includes(candidate)} onChange={() => toggle(candidate)} /><span>{candidate}</span></label>)}</div><div className="report-transfer"><span>{selected.length} of {candidates.length} selected</span><button className="primary-button" disabled={!selected.length} onClick={() => onApply(selected)}>Use selected items</button></div></div>}
  </section>;
}

function ProjectPanelIntro({ title, onTitleChange, purpose }: { title: string; onTitleChange: (title: string) => void; purpose: string }) {
  return <div className="project-panel-intro">
    <div><span className="report-section-label">Analysis workspace</span><p>{purpose}</p></div>
    <label><span>Project title</span><input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Name this analysis" /></label>
  </div>;
}

function HoQView({ importedNeeds, importedMetrics, projectTitle, onModelChange }: { importedNeeds: HoQNeed[]; importedMetrics: HoQMetric[]; projectTitle: string; onModelChange: (needs: HoQNeed[], metrics: HoQMetric[]) => void }) {
  const [needs, setNeeds] = useState(importedNeeds.length ? importedNeeds : initialNeeds);
  const [metrics, setMetrics] = useState(importedMetrics.length ? importedMetrics : initialMetrics);
  const [title, setTitle] = useState(projectTitle || "Manual House of Quality");
  const importance = metrics.map((_, index) => technicalImportance(needs, index));
  const updateNeeds = (next: HoQNeed[]) => { setNeeds(next); onModelChange(next, metrics); };
  const updateMetrics = (next: HoQMetric[]) => { setMetrics(next); onModelChange(needs, next); };
  const addNeed = () => updateNeeds([...needs, { id: crypto.randomUUID(), need: "New customer need", importance: 3, relationships: metrics.map(() => 0) }]);
  const addMetric = () => updateMetrics([...metrics, { id: crypto.randomUUID(), name: "New metric", direction: "target", target: "Define target" }]);
  const removeNeed = (needId: string) => updateNeeds(needs.filter((need) => need.id !== needId));
  const removeMetric = (metricIndex: number) => {
    const nextMetrics = metrics.filter((_, index) => index !== metricIndex);
    const nextNeeds = needs.map((need) => ({ ...need, relationships: need.relationships.filter((_, index) => index !== metricIndex) }));
    setMetrics(nextMetrics);
    setNeeds(nextNeeds);
    onModelChange(nextNeeds, nextMetrics);
  };
  return <div className="analysis-view hoq-page">
    <AnalysisHeader title="House of Quality" eyebrow="QFD / customer voice to engineering metrics" actions={<><button onClick={addNeed}>+ Need</button><button onClick={addMetric}>+ Metric</button><PdfButton /><button className="export-button" onClick={() => exportFile("praxis-house-of-quality.csv", ["Need,Importance,...metrics"].join(",") + "\n" + needs.map((need) => [need.need, need.importance, ...need.relationships].join(",")).join("\n"), "text/csv")}>Export CSV</button></>} />
    <ProjectPanelIntro title={title} onTitleChange={setTitle} purpose="Build the relationship between customer needs and engineering measures. Add needs and metrics manually when no report is available." />
    <div className="model-summary"><Metric label="Needs" value={needs.length} /><Metric label="Engineering metrics" value={metrics.length} /><Metric label="Highest priority" value={`${Math.max(...importance)} pts`} /><Metric label="Coverage" value={`${Math.round(needs.filter((n) => n.relationships.some(Boolean)).length / needs.length * 100)}%`} /></div>
    <div className="table-scroll"><table className="model-table hoq-table"><thead><tr><th className="sticky-col">Customer need</th><th>Importance</th>{metrics.map((metric, index) => <th key={metric.id}><div className="hoq-column-heading"><input value={metric.name} onChange={(event) => updateMetrics(metrics.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><button className="table-remove-button" type="button" onClick={() => removeMetric(index)} aria-label={`Remove metric ${metric.name || index + 1}`} title="Remove metric">×</button></div><small>{metric.direction} · {metric.target}</small></th>)}<th>Opportunity</th></tr></thead><tbody>{needs.map((need, needIndex) => <tr key={need.id}><td className="sticky-col"><div className="hoq-row-heading"><input value={need.need} onChange={(event) => updateNeeds(needs.map((item, index) => index === needIndex ? { ...item, need: event.target.value } : item))} /><button className="table-remove-button" type="button" onClick={() => removeNeed(need.id)} aria-label={`Remove customer need ${need.need || needIndex + 1}`} title="Remove customer need">×</button></div></td><td><input className="number-input" type="number" min="1" max="5" value={need.importance} onChange={(event) => updateNeeds(needs.map((item, index) => index === needIndex ? { ...item, importance: Number(event.target.value) } : item))} /></td>{metrics.map((metric, metricIndex) => <td key={metric.id}><select value={need.relationships[metricIndex] ?? 0} onChange={(event) => updateNeeds(needs.map((item, index) => index === needIndex ? { ...item, relationships: item.relationships.map((value, i) => i === metricIndex ? Number(event.target.value) : value) } : item))}><option value="0">·</option><option value="1">○ 1</option><option value="3">△ 3</option><option value="9">● 9</option></select></td>)}<td className="score">{opportunityScore(need.importance, Math.max(...need.relationships, 0))}</td></tr>)}</tbody><tfoot><tr><th className="sticky-col">Technical importance</th><th></th>{importance.map((value, index) => <th key={metrics[index].id} className="score">{value}<small>{relativeImportance(needs, index).toFixed(1)}%</small></th>)}<th></th></tr></tfoot></table></div>
    <div className="insight-strip"><strong>How to read this model</strong><span>Relationship strength: 1 weak · 3 medium · 9 strong</span><span>Relative importance is normalized across engineering metrics.</span><span className="warning">Review empty rows and columns before a gate review.</span></div>
  </div>;
}

function KanoView({ reportFeatures = [], projectTitle, currentIdea, onModelChange }: { reportFeatures?: string[]; projectTitle: string; currentIdea: string; onModelChange: (items: KanoFeature[]) => void }) {
  const initialFeatures = reportFeatures.length ? reportFeatures : [currentIdea || "Current product idea", "Leak-proof seal", "Dishwasher safe"];
  const [items, setItems] = useState<KanoFeature[]>(initialFeatures.map((feature, index) => ({ id: crypto.randomUUID(), feature, functional: "like", dysfunctional: index ? "neutral" : "dislike", importance: index ? 4 : 5, satisfaction: index ? 3 : 2 })));
  const [title, setTitle] = useState(projectTitle || "Manual Kano Study");
  const updateItems = (next: KanoFeature[]) => { setItems(next); onModelChange(next); };
  const update = (id: string, patch: Partial<KanoFeature>) => updateItems(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <div className="analysis-view kano-page"><AnalysisHeader title="Kano model" eyebrow="Feature response / satisfaction and delight" actions={<><button onClick={() => updateItems([...items, { id: crypto.randomUUID(), feature: "New feature", functional: "like", dysfunctional: "neutral", importance: 3, satisfaction: 3 }])}>+ Feature</button><PdfButton /><button className="export-button" onClick={() => exportFile("praxis-kano.csv", "Feature,Functional,Dysfunctional,Class,Importance,Satisfaction,Opportunity\n" + items.map((item) => [item.feature, item.functional, item.dysfunctional, classifyKano(item.functional, item.dysfunctional), item.importance, item.satisfaction, opportunityScore(item.importance, item.satisfaction)].join(",")).join("\n"), "text/csv")}>Export CSV</button></>} /><ProjectPanelIntro title={title} onTitleChange={setTitle} purpose="Classify feature response before implementation. Add features manually, then capture functional and dysfunctional customer reactions." /><ToolReviewPanel title="Select features for Kano analysis" description="Generate and review the feature report before deciding which candidates enter the Kano questionnaire." candidates={items.map((item) => item.feature)} onApply={(selected) => updateItems(items.filter((item) => selected.includes(item.feature)))} /><div className="model-summary"><Metric label="Features" value={items.length} /><Metric label="Must-be" value={items.filter((i) => classifyKano(i.functional, i.dysfunctional) === "Must-be").length} /><Metric label="Delighters" value={items.filter((i) => classifyKano(i.functional, i.dysfunctional) === "Delighter").length} /><Metric label="Avg opportunity" value={(items.reduce((sum, i) => sum + opportunityScore(i.importance, i.satisfaction), 0) / items.length).toFixed(1)} /></div><div className="table-scroll"><table className="model-table"><thead><tr><th>Feature</th><th>Functional question</th><th>Dysfunctional question</th><th>Kano class</th><th>Importance</th><th>Satisfaction</th><th>Opportunity</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><input value={item.feature} onChange={(e) => update(item.id, { feature: e.target.value })} /></td><td><select value={item.functional} onChange={(e) => update(item.id, { functional: e.target.value as KanoAnswer })}>{answers.map((answer) => <option key={answer} value={answer}>{answer.replace("_", " ")}</option>)}</select></td><td><select value={item.dysfunctional} onChange={(e) => update(item.id, { dysfunctional: e.target.value as KanoAnswer })}>{answers.map((answer) => <option key={answer} value={answer}>{answer.replace("_", " ")}</option>)}</select></td><td><span className={`class-badge class-${classifyKano(item.functional, item.dysfunctional).toLowerCase()}`}>{classifyKano(item.functional, item.dysfunctional)}</span></td><td><input className="number-input" type="number" min="1" max="5" value={item.importance} onChange={(e) => update(item.id, { importance: Number(e.target.value) })} /></td><td><input className="number-input" type="number" min="1" max="5" value={item.satisfaction} onChange={(e) => update(item.id, { satisfaction: Number(e.target.value) })} /></td><td className="score">{opportunityScore(item.importance, item.satisfaction).toFixed(1)}</td></tr>)}</tbody></table></div><div className="kano-chart">{items.map((item) => <div className="bar-row" key={item.id}><span>{item.feature}</span><div className="bar-track"><i style={{ width: `${opportunityScore(item.importance, item.satisfaction) / 2 * 10}%` }} /></div><b>{opportunityScore(item.importance, item.satisfaction).toFixed(1)}</b><small>opportunity</small></div>)}</div></div>;
}

const benchmarkTypes: { id: BenchmarkType; label: string }[] = [
  { id: "feature", label: "Feature / capability" }, { id: "performance", label: "Performance / specs" },
  { id: "price", label: "Price / value" }, { id: "user_experience", label: "User experience" },
  { id: "sustainability", label: "Sustainability" }, { id: "market_position", label: "Market position" },
];

function BenchmarkingView({ projectTitle, currentIdea, onPromote }: { projectTitle: string; currentIdea: string; onPromote: (analysis: BenchmarkAnalysis, selected: BenchmarkAnalysis["rows"]) => void }) {
  const [title, setTitle] = useState(projectTitle || "Benchmark study");
  const [idea, setIdea] = useState(currentIdea);
  const [types, setTypes] = useState<BenchmarkType[]>(benchmarkTypes.map((item) => item.id));
  const [competitors, setCompetitors] = useState("Suggest competitors with the analysis");
  const [analysis, setAnalysis] = useState<BenchmarkAnalysis>();
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toggleType = (type: BenchmarkType) => setTypes(types.includes(type) ? types.filter((item) => item !== type) : [...types, type]);
  const run = async () => {
    if (!idea.trim() || !types.length) return;
    setLoading(true); setError("");
    try { const result = await generateBenchmarkAnalysis(title, `${idea}\nCompetitor instruction: ${competitors}`, types); setAnalysis(result); setSelected(result.rows.map((_, index) => index)); }
    catch (value) { setError(value instanceof Error ? value.message : "The benchmark could not be generated."); }
    finally { setLoading(false); }
  };
  return <div className="analysis-view benchmarking-page">
    <AnalysisHeader title="Benchmarking" eyebrow="Competitive evidence / current product versus market alternatives" actions={<><PdfButton /><button className="export-button" disabled={!analysis} onClick={() => analysis && exportFile("praxis-benchmarking.csv", ["Criterion,Current," + analysis.competitors.join(",") + ",Gap,Opportunity"].join(",") + "\n" + analysis.rows.map((row) => [row.criterion, row.current, ...row.competitors.map((item) => item.value), row.gap, row.opportunity].join(",")).join("\n"), "text/csv")}>Export CSV</button></>} />
    <ProjectPanelIntro title={title} onTitleChange={setTitle} purpose="Compare the current product with industry competitors across selected benchmark dimensions. Treat generated claims as hypotheses until verified." />
    <div className="benchmark-input-grid"><label><span>Current product / idea</span><textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Describe the current product, target user, and known specifications..." /></label><label><span>Competitor instruction</span><textarea value={competitors} onChange={(event) => setCompetitors(event.target.value)} /></label></div>
    <div className="benchmark-controls"><div><span className="report-section-label">Benchmark dimensions</span><div className="benchmark-type-list">{benchmarkTypes.map((item) => <label key={item.id} className={types.includes(item.id) ? "selected" : ""}><input type="checkbox" checked={types.includes(item.id)} onChange={() => toggleType(item.id)} />{item.label}</label>)}</div></div><button className="primary-button" disabled={loading || !idea.trim() || !types.length} onClick={() => void run()}>{loading ? "Benchmarking…" : "Run detailed benchmark"} <span>→</span></button></div>
    {error && <div className="report-error">{error}</div>}
    {analysis && <><div className="report-callout"><strong>{analysis.source === "llm" ? "LLM-generated benchmark" : "Local benchmark draft"}</strong><span>{analysis.summary} Competitors: {analysis.competitors.join(", ")}.</span></div><div className="benchmark-table-wrap"><table className="model-table benchmark-table"><thead><tr><th>Dimension</th><th>Current product</th>{analysis.competitors.map((name) => <th key={name}>{name}</th>)}<th>Gap</th><th>Opportunity</th><th>HoQ</th></tr></thead><tbody>{analysis.rows.map((row, index) => <tr key={`${row.criterion}-${index}`}><td><strong>{row.criterion}</strong><small>Importance {row.importance}/5</small></td><td>{row.current}</td>{analysis.competitors.map((name) => <td key={name}>{row.competitors.find((item) => item.name === name)?.value || "Not reported"}</td>)}<td>{row.gap}</td><td>{row.opportunity}<small>{row.metric.name} · {row.metric.target}</small></td><td><input type="checkbox" checked={selected.includes(index)} onChange={() => setSelected(selected.includes(index) ? selected.filter((item) => item !== index) : [...selected, index])} /></td></tr>)}</tbody></table></div>{analysis.references.length > 0 && <div className="report-references"><span className="report-section-label">References to verify</span><ol>{analysis.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a><span>{reference.relevance}</span></li>)}</ol></div>}<div className="report-transfer"><span>{selected.length} findings selected for HoQ</span><button className="primary-button" disabled={!selected.length} onClick={() => onPromote(analysis, selected.map((index) => analysis.rows[index]))}>Add selected needs + metrics to HoQ <span>→</span></button></div></>}
  </div>;
}

function ProductIntelligenceView({ projectTitle, currentIdea, hoqNeeds, hoqMetrics, kanoItems, mainReport }: { projectTitle: string; currentIdea: string; hoqNeeds: HoQNeed[]; hoqMetrics: HoQMetric[]; kanoItems: KanoFeature[]; mainReport: MainReport }) {
  const { objects, links } = useWorkspaceStore();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "### Product Copilot\n\nAsk me about the current idea, customer, evidence, HoQ, Kano, or what to validate next." },
  ]);
  const context: CopilotContext = {
    projectTitle,
    currentIdea,
    canvas: {
      objects: objects.slice(0, 60).map(({ type, title, body, evidenceGrade }) => ({ type, title, body: body.slice(0, 500), evidenceGrade })),
      links: links.slice(0, 80).map(({ fromObjectId, toObjectId, type, rationale }) => ({ fromObjectId, toObjectId, type, rationale })),
    },
    houseOfQuality: { needs: hoqNeeds, metrics: hoqMetrics },
    kano: { features: kanoItems.map((item) => ({ feature: item.feature, functional: item.functional, dysfunctional: item.dysfunctional, classification: classifyKano(item.functional, item.dysfunctional), importance: item.importance, satisfaction: item.satisfaction })) },
    mainReport: mainReport ? { summary: mainReport.summary, problem: mainReport.problem, features: mainReport.features, metrics: mainReport.metrics, assumptions: mainReport.assumptions, tests: mainReport.tests, references: mainReport.references } : null,
  };
  const ask = async (prompt = question) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setError("");
    setLoading(true);
    try {
      const answer = await askProductCopilot(trimmed, context);
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Product Copilot could not respond.");
    } finally {
      setLoading(false);
    }
  };
  const suggestions = ["What is the riskiest assumption?", "Who is the target customer?", "What should I validate next?"];
  return <div className="analysis-view intelligence-page copilot-page">
    <AnalysisHeader title="Product Copilot" eyebrow="Your idea, understood" actions={<PdfButton label="Export conversation" />} />
    <div className="copilot-context"><span className="panel-icon">✦</span><div><span className="report-section-label">Working from the current Canvas idea</span><strong>{currentIdea || "No idea added yet"}</strong><small>{projectTitle || "Untitled product study"} · {objects.length} evidence object(s) · Powered by Puter</small></div></div>
    <section className="intelligence-panel copilot-chat"><div className="copilot-chat-head"><div className="panel-icon">✦</div><div><h3>Product Copilot</h3><p>Grounded in your current idea, Canvas, HoQ, Kano, and main report</p></div><span className="copilot-status">{loading ? "● Thinking…" : "● Ready"}</span></div><div className="copilot-messages">{messages.map((message, index) => <div className={`copilot-message ${message.role}`} key={`${message.role}-${index}`}><span className="copilot-avatar">{message.role === "assistant" ? "✦" : "You"}</span>{message.role === "assistant" ? <CopilotMessage text={message.text} /> : <div>{message.text}</div>}</div>)}{loading && <div className="copilot-message assistant"><span className="copilot-avatar">✦</span><div>Reviewing only the relevant product context…</div></div>}</div><div className="copilot-suggestions">{suggestions.map((item) => <button key={item} onClick={() => void ask(item)}>{item}<span>→</span></button>)}</div>{error && <div className="report-error">{error}</div>}<div className="copilot-composer"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(); } }} placeholder="Ask about your idea..." rows={1} /><button className="primary-button" onClick={() => void ask()} disabled={!question.trim() || loading}>Send <span>↑</span></button></div><small className="copilot-hint">Press Enter to send · Shift + Enter for a new line</small></section>
  </div>;
}

function WorkspaceView({ onAnalysisGenerated, onUseFeatures, onProjectTitleChange, onIdeaSubmitted, onReportChange }: { onAnalysisGenerated: (analysis: GeneratedAnalysis, selectedFeatures: string[], selectedMetrics: GeneratedAnalysis["metrics"]) => void; onUseFeatures: (view: "kano", features: string[]) => void; onProjectTitleChange: (title: string) => void; onIdeaSubmitted: (idea: string) => void; onReportChange: (report: MainReport) => void }) {
  const { addObject, updateObject } = useWorkspaceStore();
  const [idea, setIdea] = useState("");
  const [briefName, setBriefName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [report, setReport] = useState<(GeneratedAnalysis & { title: string }) | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  useEffect(() => {
    const loadProject = (event: Event) => {
      const entry = (event as CustomEvent<ProjectHistoryEntry>).detail;
      setBriefName(entry.title);
      setIdea(entry.idea);
      setSubmitted(false);
      setReport(null);
      onReportChange(null);
      setGenerationError("");
      onProjectTitleChange(entry.title);
    };
    window.addEventListener("praxis:load-project", loadProject);
    return () => window.removeEventListener("praxis:load-project", loadProject);
  }, [onProjectTitleChange]);
  const submitIdea = () => {
    if (!idea.trim()) return;
    const id = addObject("NOTE");
    const title = briefName.trim() || "New product idea";
    updateObject(id, { title, body: idea.trim() });
    onIdeaSubmitted(idea.trim());
    setSubmitted(true);
  };
  const generateReport = async () => {
    const source = idea.trim();
    if (!source) return;
    const title = briefName.trim() || "Untitled opportunity";
    setGenerating(true);
    setGenerationError("");
    try {
      const analysis = await generateIdeaAnalysis(title, source);
      const nextReport = { ...analysis, title };
      setReport(nextReport);
      onReportChange(nextReport);
      setSelectedFeatures([]);
      setSelectedMetrics([]);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "The analysis could not be generated.");
    } finally {
      setGenerating(false);
    }
  };
  const exportReport = () => {
    if (!report) return;
    printPdf("ideaview-opportunity-report");
  };
  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setBriefName(file.name.replace(/\.[^/.]+$/, ""));
      setIdea(typeof reader.result === "string" ? reader.result : "");
      setSubmitted(false);
    };
    reader.onerror = () => setSubmitted(false);
    reader.readAsText(file);
  };
  return <div className="workspace-mini">
    <section className="idea-hero">
      <div className="idea-hero-copy"><span className="eyebrow">Start with the opportunity</span><h1>Turn an idea into a<br /><em>golden thread.</em></h1><p>Describe the product, problem, or opportunity in your own words. IdeaView will give you a clear place to shape the evidence, needs, assumptions, and decisions.</p><div className="hero-rule" /></div>
      <div className="idea-orbit" aria-hidden="true"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><span>01</span><strong>IDEA</strong></div><span className="orbit-label label-one">Evidence</span><span className="orbit-label label-two">Needs</span><span className="orbit-label label-three">Decisions</span></div>
    </section>
    <section className="idea-composer">
      <div className="composer-top"><div><span className="composer-kicker">New project brief</span><h2>What are you building?</h2></div><span className="composer-step">01 <i /> 03</span></div>
      <input className="idea-title" value={briefName} onChange={(event) => { setBriefName(event.target.value); onProjectTitleChange(event.target.value); }} placeholder="Give your idea a working name" />
      <textarea className="idea-textarea" value={idea} onChange={(event) => { setIdea(event.target.value); setSubmitted(false); }} placeholder="Example: A smart insulated lunchbox that helps shift workers keep meals safe and enjoyable through a long shift..." />
      <div className="composer-footer"><label className="upload-brief"><input type="file" accept=".txt,.md,.csv" onChange={(event) => event.target.files?.[0] && loadFile(event.target.files[0])} /> <span>↥</span> Upload a text brief</label><span className="character-count">{idea.length} characters</span><button className="primary-button idea-submit" disabled={!idea.trim()} onClick={submitIdea}>{submitted ? "Added to canvas" : "Place idea on canvas"} <span>→</span></button></div>
    </section>
    <div className="idea-prompts"><span>Try starting with</span><button onClick={() => setIdea("A product that helps shift workers keep a fresh, satisfying meal safe during a long shift.")}>A customer problem</button><button onClick={() => setIdea("A new physical product for people who need a reliable solution during demanding workdays.")}>A product opportunity</button><button onClick={() => setIdea("A frustrating workaround that people repeat every day and wish they could avoid.")}>A repeated frustration</button></div>
    <section className="report-launch"><div><span className="eyebrow">Structured analysis</span><h2>Shape the idea into a product brief</h2><p>Generate a detailed report first. Review every candidate, then choose exactly what belongs in House of Quality.</p></div><button className="primary-button" disabled={!idea.trim() || generating} onClick={() => void generateReport()}>{generating ? "Generating…" : "Generate detailed report"} <span>→</span></button></section>
    {generationError && <div className="report-error">{generationError}</div>}
    {report && <section className="opportunity-report">
      <div className="report-title-row"><div><span className="eyebrow">Inferred draft · human review required</span><h2>{report.title}</h2><p>{report.summary}</p></div><button className="secondary-button" onClick={exportReport}>Generate PDF report</button></div>
      <div className="report-callout"><strong>{report.source === "llm" ? "LLM-generated draft" : "Local draft fallback"}</strong><span>This report contains hypotheses inferred from the submitted idea. It does not upgrade evidence grades or claim customer validation. {report.source === "local-draft" && "Set VITE_LLM_ANALYSIS_ENDPOINT to connect a general LLM provider."}</span></div>
      {report.references.length > 0 && <div className="report-references"><span className="report-section-label">References to verify</span><ol>{report.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a><span>{reference.relevance}</span></li>)}</ol></div>}
      <div className="report-grid report-sections">
        <article><span className="report-section-label">Opportunity framing</span><h3>Customer problem to investigate</h3><p>{report.problem}</p></article>
        <article><span className="report-section-label">Next validation</span><h3>Cheapest useful tests</h3><ul>{report.tests.map((test) => <li key={test}>{test}</li>)}</ul></article>
      </div>
      <div className="report-table-block"><div className="report-block-head"><div><span className="report-section-label">Choose HoQ inputs</span><h3>Engineering metrics</h3><p>Select only the metrics worth tracking in the first House of Quality pass.</p></div><button className="secondary-button" onClick={() => { const nextReport = { ...report, metrics: [...report.metrics, { name: "New metric", direction: "target" as const, target: "Define with evidence" }] }; setReport(nextReport); onReportChange(nextReport); setSelectedMetrics([...selectedMetrics, report.metrics.length]); }}>+ Metric</button></div><div className="report-metric-list">{report.metrics.map((metric, index) => <div className={`report-metric-row ${selectedMetrics.includes(index) ? "selected" : ""}`} key={`${metric.name}-${index}`}><label><input type="checkbox" checked={selectedMetrics.includes(index)} onChange={() => setSelectedMetrics(selectedMetrics.includes(index) ? selectedMetrics.filter((item) => item !== index) : [...selectedMetrics, index])} /><strong>{metric.name}</strong></label><span className={`direction direction-${metric.direction}`}>{metric.direction === "up" ? "↑ improve" : metric.direction === "down" ? "↓ reduce" : "◎ target"}</span><input value={metric.target} onChange={(event) => { const nextReport = { ...report, metrics: report.metrics.map((item, itemIndex) => itemIndex === index ? { ...item, target: event.target.value } : item) }; setReport(nextReport); onReportChange(nextReport); }} /></div>)}</div></div>
      <div className="report-grid report-sections"><article><div className="report-block-head"><div><span className="report-section-label">Choose HoQ inputs</span><h3>Candidate features</h3><p>Select the customer needs that should enter HoQ.</p></div><button className="secondary-button" onClick={() => setSelectedFeatures(selectedFeatures.length === report.features.length ? [] : report.features.map((_, index) => index))}>{selectedFeatures.length === report.features.length ? "Clear all" : "Select all"}</button></div><ul className="selectable-list">{report.features.map((feature, index) => <li key={feature} className={selectedFeatures.includes(index) ? "selected" : ""}><label><input type="checkbox" checked={selectedFeatures.includes(index)} onChange={() => setSelectedFeatures(selectedFeatures.includes(index) ? selectedFeatures.filter((item) => item !== index) : [...selectedFeatures, index])} /><span>{feature}</span></label></li>)}</ul></article><article><span className="report-section-label">Assumption register</span><h3>What could make this wrong</h3><ul>{report.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></article></div>
      <div className="report-transfer"><span>{selectedFeatures.length} features · {selectedMetrics.length} metrics selected</span><div className="report-transfer-actions"><button className="secondary-button" disabled={!selectedFeatures.length} onClick={() => onUseFeatures("kano", selectedFeatures.map((index) => report.features[index]))}>Use in Kano</button><button className="primary-button" disabled={!selectedFeatures.length || !selectedMetrics.length} onClick={() => onAnalysisGenerated(report, selectedFeatures.map((index) => report.features[index]), selectedMetrics.map((index) => report.metrics[index]))}>Add selected items to HoQ <span>→</span></button></div></div>
    </section>}
    {!report && <div className="report-empty"><span className="report-empty-mark">01</span><div><strong>Your report will appear here</strong><p>Start with an idea above, then generate a structured draft for your team to challenge and refine.</p></div></div>}
  </div>;
}

function AnalysisHeader({ title, eyebrow, actions }: { title: string; eyebrow: string; actions: React.ReactNode }) { return <div className="analysis-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="analysis-actions">{actions}</div></div>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function App() {
  const [view, setView] = useState<View>("workspace");
  const [importedNeeds, setImportedNeeds] = useState<HoQNeed[]>([]);
  const [importedMetrics, setImportedMetrics] = useState<HoQMetric[]>([]);
  const [reportFeatures, setReportFeatures] = useState<string[]>([]);
  const [hoqNeeds, setHoqNeeds] = useState<HoQNeed[]>(initialNeeds);
  const [hoqMetrics, setHoqMetrics] = useState<HoQMetric[]>(initialMetrics);
  const [kanoItems, setKanoItems] = useState<KanoFeature[]>([]);
  const [mainReport, setMainReport] = useState<MainReport>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled product study");
  const [methodsCollapsed, setMethodsCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("ideaview-theme") !== "light");
  useEffect(() => {
    localStorage.setItem("ideaview-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const views: [View, string][] = [["workspace", "Canvas"], ["intelligence", "Product Intelligence"], ["hoq", "House of Quality"], ["kano", "Kano model"], ["benchmarking", "Benchmarking"]];
  const [currentIdea, setCurrentIdea] = useState("");
  const content = useMemo(() => view === "intelligence" ? <ProductIntelligenceView projectTitle={projectTitle} currentIdea={currentIdea} hoqNeeds={hoqNeeds} hoqMetrics={hoqMetrics} kanoItems={kanoItems} mainReport={mainReport} /> : view === "hoq" ? <HoQView importedNeeds={importedNeeds} importedMetrics={importedMetrics} projectTitle={projectTitle} onModelChange={(needs, metrics) => { setHoqNeeds(needs); setHoqMetrics(metrics); }} /> : view === "kano" ? <KanoView reportFeatures={reportFeatures} projectTitle={projectTitle} currentIdea={currentIdea} onModelChange={setKanoItems} /> : view === "benchmarking" ? <BenchmarkingView projectTitle={projectTitle} currentIdea={currentIdea} onPromote={(analysis, selected) => { const needs = selected.map((row) => ({ id: crypto.randomUUID(), need: `${row.opportunity} (${row.criterion})`, importance: row.importance, relationships: selected.map(() => 0) })); const metrics = selected.map((row) => ({ id: crypto.randomUUID(), ...row.metric })); setImportedNeeds(needs); setImportedMetrics(metrics); setHoqNeeds(needs); setHoqMetrics(metrics); setView("hoq"); }} /> : <WorkspaceView onProjectTitleChange={setProjectTitle} onUseFeatures={(targetView, features) => { setReportFeatures(features); setView(targetView); }} onAnalysisGenerated={(analysis, features, metrics) => { setReportFeatures(features); const needs = features.map((feature) => ({ id: crypto.randomUUID(), need: feature, importance: 3, relationships: metrics.map(() => 0) })); const nextMetrics = metrics.map((metric) => ({ ...metric, id: crypto.randomUUID() })); setImportedNeeds(needs); setImportedMetrics(nextMetrics); setHoqNeeds(needs); setHoqMetrics(nextMetrics); setView("hoq"); }} onIdeaSubmitted={(idea) => setCurrentIdea(idea)} onReportChange={setMainReport} />, [view, importedNeeds, importedMetrics, reportFeatures, projectTitle, currentIdea, hoqNeeds, hoqMetrics, kanoItems, mainReport]);
  const railIcons: Record<View, string> = { workspace: "CV", intelligence: "✦", hoq: "HQ", kano: "KN", benchmarking: "BM" };
  return <main className={`app-shell ${darkMode ? "theme-dark" : "theme-light"}`}><header className="topbar"><div className="brand"><span className="brand-mark">I</span><span>IdeaView</span></div><button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}>{darkMode ? "☼ Light" : "◐ Dark"}</button></header><div className="app-body"><aside className={`left-rail ${methodsCollapsed ? "collapsed" : ""}`}><button className="rail-toggle" onClick={() => setMethodsCollapsed(!methodsCollapsed)} aria-label={methodsCollapsed ? "Expand methods" : "Collapse methods"}>{methodsCollapsed ? "»" : "«"}</button>{!methodsCollapsed && <div className="rail-heading">Methods</div>}{views.map(([key, label]) => <button className={`rail-item ${view === key ? "active" : ""}`} key={key} onClick={() => setView(key)} title={methodsCollapsed ? label : undefined}><span>{railIcons[key]}</span>{!methodsCollapsed && label}</button>)}</aside><section className="main-stage"><div className="stage-content">{content}</div></section></div></main>;
}
export default App;