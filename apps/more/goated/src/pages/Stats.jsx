import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Download, Upload, Trash2, Eye, TrendingUp, Zap, Activity, Award, Layers, Compass
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSessions, deleteSession, exportData, importData, getAssessments } from '@/lib/localStorageManager';
import { COACH_PHASES } from '@/lib/gameConstants';
import { migrateCoachState, rankOf, phaseDisplayTitle } from '@/lib/coachMastery';
import { computeCapacityCredits, tierLabel, FAR_TRANSFER_TIERS } from '@/lib/farTransfer';

export default function Stats() {
  const [sessions, setSessions] = useState([]);
  const [importError, setImportError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'coach', 'stressors'
  const [chartSessionsCount, setChartSessionsCount] = useState(15);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [coachState, setCoachState] = useState({ phaseIndex: 0, rankName: 'Initiate' });

  useEffect(() => {
    setSessions(getSessions());
    // Recover coach state
    try {
      const saved = localStorage.getItem('goated_coach_state');
      const parsed = saved ? JSON.parse(saved) : {};
      setCoachState(migrateCoachState(parsed));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nback-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importData(data);
      setSessions(getSessions());
    } catch (err) {
      setImportError('Failed to import data. Invalid file format.');
    }
  };

  const handleDelete = (sessionId) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    deleteSession(sessionId);
    setSessions(getSessions());
  };

  // Base metrics
  const totalSessions = sessions.length;
  const avgAccuracy = totalSessions > 0 ? Math.round(sessions.reduce((s, x) => s + (x.accuracy || 0), 0) / totalSessions) : 0;
  const totalTrials = sessions.reduce((s, x) => s + (x.totalTrials || 0), 0);
  const highestAccuracy = totalSessions > 0 ? Math.max(...sessions.map(s => s.accuracy || 0)) : 0;

  // Breakdown by N-level
  const nLevels = [...new Set(sessions.map(s => s.nLevel))].sort((a, b) => a - b);
  const nStats = nLevels.map(n => {
    const filtered = sessions.filter(s => s.nLevel === n);
    const avg = Math.round(filtered.reduce((s, x) => s + (x.accuracy || 0), 0) / filtered.length);
    return { nLevel: n, count: filtered.length, avgAccuracy: avg };
  });

  // Autopilot specific sessions
  const autopilotSessions = sessions.filter(s => s.autopilot);
  const manualSessions = sessions.filter(s => !s.autopilot);
  const autopilotAvgAccuracy = autopilotSessions.length > 0
    ? Math.round(autopilotSessions.reduce((s, x) => s + (x.accuracy || 0), 0) / autopilotSessions.length)
    : 0;

  // Stressors/Modes Performance Analysis
  const modeStats = [];
  const uniqueModes = [...new Set(sessions.flatMap(s => s.modes || []))];
  uniqueModes.forEach(modeId => {
    const matching = sessions.filter(s => s.modes?.includes(modeId));
    if (matching.length > 0) {
      const avg = Math.round(matching.reduce((s, x) => s + (x.accuracy || 0), 0) / matching.length);
      modeStats.push({ id: modeId, count: matching.length, avgAccuracy: avg });
    }
  });
  modeStats.sort((a, b) => b.avgAccuracy - a.avgAccuracy);

  // Synaesthesia analytics
  const synaesthesiaSessions = sessions.filter(s => s.synaesthesia);
  const synaesthesiaCount = synaesthesiaSessions.length;
  const synaesthesiaAvgAccuracy = synaesthesiaCount > 0
    ? Math.round(synaesthesiaSessions.reduce((s, x) => s + (x.accuracy || 0), 0) / synaesthesiaCount)
    : 0;

  // SVG Trend Line Chart Configuration
  const trendSessions = [...sessions]
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    .slice(-chartSessionsCount);

  const chartWidth = 500;
  const chartHeight = 160;
  const paddingX = 30;
  const paddingY = 20;

  let svgPath = '';
  let fillPath = '';
  const points = [];

  if (trendSessions.length > 1) {
    trendSessions.forEach((s, idx) => {
      const x = paddingX + (idx / (trendSessions.length - 1)) * (chartWidth - paddingX * 2);
      const y = chartHeight - paddingY - ((s.accuracy || 0) / 100) * (chartHeight - paddingY * 2);
      points.push({ x, y, session: s, index: idx });
    });

    // Build line path
    svgPath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      svgPath += ` L ${points[i].x} ${points[i].y}`;
    }

    // Build area fill path
    fillPath = `${svgPath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background py-6 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-primary animate-pulse" />
            <div>
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-foreground tracking-tight">Neuro-Analytics Dashboard</h1>
              <p className="text-[10px] font-mono text-muted-foreground">Quantified memory optimization &amp; transfer tracking</p>
            </div>
          </div>
          <Link to="/" className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-mono font-semibold transition-colors">
            Dashboard
          </Link>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex bg-secondary/30 border border-border/80 rounded-xl p-1 shrink-0 font-mono text-xs gap-1">
          {[
            { id: 'overview', label: 'Overview Metrics', icon: Activity },
            { id: 'coach', label: 'Coach Autopilot', icon: Zap },
            { id: 'trajectory', label: 'Predictive Map (SR/TEM)', icon: Compass },
            { id: 'stressors', label: 'Stressor Analytics', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors font-semibold ${active ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="inline sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* TAB A: OVERVIEW METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              {[
                { label: 'Total Sessions', value: totalSessions, sub: `${autopilotSessions.length} autopilot`, color: 'text-primary' },
                { label: 'Average Accuracy', value: `${avgAccuracy}%`, sub: `Overall performance`, color: 'text-emerald-400' },
                { label: 'Peak Accuracy', value: `${highestAccuracy}%`, sub: 'Record session', color: 'text-accent' },
                { label: 'Total Trials', value: totalTrials, sub: 'Active repetitions', color: 'text-cyan-400' }
              ].map((stat, i) => (
                <div key={i} className="rounded-xl bg-secondary/35 border border-border/80 p-4 text-center shadow-inner relative overflow-hidden">
                  <div className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[11px] font-mono text-foreground font-semibold mt-1">{stat.label}</div>
                  <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Reasoning Index (ICAR pre/post) summary */}
            {(() => {
              const assessments = getAssessments();
              if (!assessments.length) return null;
              const lastBaseline = [...assessments].reverse().find(a => a.benchmark === 'baseline');
              const lastFollowup = [...assessments].reverse().find(a => a.benchmark === 'followup');
              const delta = (lastBaseline && lastFollowup) ? lastFollowup.iq - lastBaseline.iq : null;
              return (
                <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/30 p-4 flex flex-wrap items-center gap-4 font-mono">
                  <div className="flex-1 min-w-[180px]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-300">Reasoning Index</h3>
                    <p className="text-[10px] text-muted-foreground">Matrix-reasoning pre/post (Sandia Matrices). Δ is the training transfer signal.</p>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div><div className="text-xl font-bold text-foreground">{lastBaseline?.iq ?? '—'}</div><div className="text-[9px] uppercase tracking-widest text-muted-foreground">Baseline</div></div>
                    <div><div className="text-xl font-bold text-foreground">{lastFollowup?.iq ?? '—'}</div><div className="text-[9px] uppercase tracking-widest text-muted-foreground">Follow-up</div></div>
                    <div><div className={`text-xl font-bold ${delta == null ? 'text-muted-foreground' : delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-foreground'}`}>{delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}</div><div className="text-[9px] uppercase tracking-widest text-muted-foreground">Δ index</div></div>
                  </div>
                  <Link to="/assessment" className="text-[11px] text-cyan-400 hover:text-cyan-300 underline">Open →</Link>
                </div>
              );
            })()}

            {/* Capacity Credits — probe-based far-transfer score, training
                Δ-IQ trajectory, cumulative g (engagement). Sits next to the
                validated Reasoning Index above so the user reads training
                estimate vs. ground truth in one glance. */}
            {(() => {
              const credits = computeCapacityCredits(sessions, coachState, getAssessments(), COACH_PHASES);
              if (!credits) return null;
              const t = credits.totals;
              const probeCount = credits.probes.counts.total;
              const tierTextColor = ({
                early: 'text-amber-300', consolidating: 'text-cyan-300',
                transferring: 'text-emerald-300', broad: 'text-fuchsia-300', no_evidence: 'text-muted-foreground/70',
              })[t.tier] || 'text-muted-foreground';
              return (
                <div id="capacity-credits" className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/30 p-4 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-fuchsia-300">Capacity Credits</h3>
                      <p className="text-[10px] font-mono text-muted-foreground">Probe-based far-transfer + training-IQ trajectory. Volume vs. evidence.</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {probeCount} probe{probeCount === 1 ? '' : 's'} · {credits.probes.counts.switch} switch · {credits.probes.counts.recheck} recheck
                    </span>
                  </div>

                  {/* Headline trio */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-center">
                    <div className="rounded-lg bg-background/40 border border-border p-3">
                      <div className="text-2xl font-bold text-emerald-300">{t.gTotal.toLocaleString()}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">g · training credit</div>
                      <div className="text-[9px] text-muted-foreground/60 italic mt-1">engagement metric</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border p-3">
                      <div className={`text-2xl font-bold ${t.iqCreditTotal >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
                        {t.iqCreditTotal >= 0 ? '+' : ''}{t.iqCreditTotal.toFixed(2)}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">ΔIQ · training estimate</div>
                      <div className="text-[9px] text-muted-foreground/60 italic mt-1">probe-gated · drops on Drop</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border p-3">
                      <div className={`text-2xl font-bold ${tierTextColor}`}>
                        {t.farTransferPct == null ? '—' : `${t.farTransferPct}%`}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Far Transfer · {tierLabel(t.tier)}</div>
                      <div className="text-[9px] text-muted-foreground/60 italic mt-1">
                        {t.farTransferPct == null
                          ? `play varied configs · ${Math.max(0, 3 - probeCount)} more probes needed`
                          : `EMA of last ${Math.min(12, probeCount)} probe outcomes`}
                      </div>
                    </div>
                  </div>

                  {/* Ground-truth callout (Sandia pre/post vs. training estimate). */}
                  {credits.ground.sandiaDelta && (
                    <div className={`rounded-lg p-3 border ${
                      credits.ground.calibration === 'hot'
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : credits.ground.calibration === 'cool'
                          ? 'bg-cyan-500/10 border-cyan-500/40'
                          : 'bg-emerald-500/10 border-emerald-500/40'}`}>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300/90 mb-2">Ground-truth check</div>
                      <div className="flex items-center justify-between flex-wrap gap-3 font-mono text-xs">
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Training-estimated</div>
                          <div className={`text-lg font-bold ${t.iqCreditTotal >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
                            {t.iqCreditTotal >= 0 ? '+' : ''}{t.iqCreditTotal.toFixed(2)} IQ
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Validated Reasoning Index Δ</div>
                          <div className={`text-lg font-bold ${
                            credits.ground.sandiaDelta.deltaIQ > 0 ? 'text-emerald-300'
                              : credits.ground.sandiaDelta.deltaIQ < 0 ? 'text-rose-300' : 'text-foreground'
                          }`}>
                            {credits.ground.sandiaDelta.deltaIQ > 0 ? '+' : ''}{credits.ground.sandiaDelta.deltaIQ} IQ
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            95% CI [{credits.ground.sandiaDelta.ci95[0]} → {credits.ground.sandiaDelta.ci95[1]}] · RCI {credits.ground.sandiaDelta.reliable ? '✓' : '✗'}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/80 mt-2 italic">
                        {credits.ground.calibration === 'hot'
                          ? 'Training trajectory is running hot vs. the validated Reasoning Index — engagement is real, IQ change is smaller.'
                          : credits.ground.calibration === 'cool'
                            ? 'Validated IQ delta exceeds the training estimate — you may be transferring more than the trajectory captures.'
                            : 'Training estimate is aligned with the validated Reasoning Index.'}
                      </p>
                    </div>
                  )}
                  {!credits.ground.sandiaDelta && (
                    <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/30 p-3">
                      <p className="text-[10px] font-mono text-cyan-300/90">
                        Take a Reasoning Index now, then again in 4+ weeks, to register a validated Δ-IQ alongside the training estimate. <Link to="/assessment" className="underline">Open Reasoning Index →</Link>
                      </p>
                    </div>
                  )}

                  {/* Probe ledger (last 10 probes) */}
                  {probeCount > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300/90">Recent probes</div>
                      <div className="overflow-x-auto">
                        <table className="w-full font-mono text-[10px]">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border/40">
                              <th className="text-left py-1 pr-2">When</th>
                              <th className="text-left py-1 pr-2">Kind</th>
                              <th className="text-left py-1 pr-2">Outcome</th>
                              <th className="text-right py-1 pr-2">Acc</th>
                              <th className="text-right py-1 pr-2">Baseline</th>
                              <th className="text-right py-1 pr-2">Δ</th>
                              <th className="text-right py-1">ΔIQ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {credits.perSession.filter(r => r.probeKind).slice(-10).reverse().map((r, i) => (
                              <tr key={i} className="border-b border-border/20">
                                <td className="py-1 pr-2 text-muted-foreground">{r.createdDate ? new Date(r.createdDate).toLocaleDateString() : '—'}</td>
                                <td className="py-1 pr-2 text-foreground/80">{r.probeKind}</td>
                                <td className={`py-1 pr-2 font-bold ${
                                  r.probeOutcome === 'Hold' ? 'text-emerald-300'
                                    : r.probeOutcome === 'Partial' ? 'text-amber-300' : 'text-rose-300'
                                }`}>{r.probeOutcome}</td>
                                <td className="py-1 pr-2 text-right text-foreground/80">{r.accuracy}%</td>
                                <td className="py-1 pr-2 text-right text-muted-foreground">{r.probeBaseline != null ? `${r.probeBaseline}%` : '—'}</td>
                                <td className={`py-1 pr-2 text-right ${r.probeDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{r.probeDelta >= 0 ? '+' : ''}{r.probeDelta}</td>
                                <td className={`py-1 text-right font-bold ${r.iqCredit >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>{r.iqCredit >= 0 ? '+' : ''}{r.iqCredit.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Methodology */}
                  <details className="text-[10px] font-mono text-muted-foreground/80">
                    <summary className="cursor-pointer hover:text-foreground">Methodology</summary>
                    <div className="mt-2 space-y-2 leading-relaxed">
                      <p>
                        <strong>g</strong> accumulates from every session as difficulty × (accuracy / 100) × duration factor × mode-diversity bonus. It is an engagement metric only — not a cognitive measure.
                      </p>
                      <p>
                        <strong>Probes</strong> fire automatically. A <em>switch probe</em> fires when this session&apos;s config (mode set, N-band, NRINT rule, stream count, …) differs from your recent baseline by ≥ 2 features. A <em>recheck</em> fires when you replay a phase whose mastery record is ≥ 5 sessions old. The probe outcome is <strong>Hold</strong> (accuracy held), <strong>Partial</strong> (small drop), or <strong>Drop</strong> (large drop) vs. the baseline.
                      </p>
                      <p>
                        <strong>Far Transfer Score</strong> is the EMA of the last 12 probe outcomes (Hold = 1.0, Partial = 0.5, Drop = 0), scaled to 0–100%. Tiers: {FAR_TRANSFER_TIERS.map(t2 => t2.label).join(' · ')}.
                      </p>
                      <p>
                        <strong>Training ΔIQ</strong> updates only on probe sessions — playing the same config repeatedly grows g but not ΔIQ. Drop probes subtract a small amount, so the trajectory can move down. Validated Reasoning Index Δ-IQ stays as the ground truth above.
                      </p>
                      <p className="text-muted-foreground/60 italic">
                        References on n-back transfer hygiene: Jaeggi et al. 2008, Au et al. 2015, Owen et al. 2010. This is a training tool, not a clinical instrument.
                      </p>
                    </div>
                  </details>
                </div>
              );
            })()}

            {/* Performance Trend Chart */}
            <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 shadow-lg flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-4 shrink-0 font-mono">
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Chronological Accuracy Trend</h3>
                  <p className="text-[10px] text-muted-foreground">Demonstrating progression over recent trials</p>
                </div>
                <div className="flex border border-border rounded overflow-hidden text-[9px] font-semibold">
                  {[10, 15, 30].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setChartSessionsCount(cnt)}
                      className={`px-2 py-1 transition-colors ${chartSessionsCount === cnt ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary/40 text-muted-foreground'}`}
                    >
                      {cnt} runs
                    </button>
                  ))}
                </div>
              </div>

              {trendSessions.length < 2 ? (
                <div className="h-40 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0 font-mono text-xs text-muted-foreground">
                  Play at least 2 sessions to plot neural progression trend lines.
                </div>
              ) : (
                <div className="relative shrink-0 select-none bg-background/20 rounded-lg p-2 border border-border/40">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis guide lines */}
                    {[25, 50, 75, 100].map(lvl => {
                      const y = chartHeight - paddingY - (lvl / 100) * (chartHeight - paddingY * 2);
                      return (
                        <g key={lvl} className="opacity-20">
                          <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                          <text x={paddingX - 5} y={y + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[8px] font-semibold">{lvl}%</text>
                        </g>
                      );
                    })}

                    {/* Area fill */}
                    <path d={fillPath} fill="url(#chartGradient)" />

                    {/* Line path */}
                    <path d={svgPath} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Interaction Points */}
                    {points.map(pt => (
                      <circle
                        key={pt.index}
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredPoint?.index === pt.index ? 6 : 4}
                        className={`transition-all duration-150 cursor-pointer ${hoveredPoint?.index === pt.index ? 'fill-accent' : 'fill-primary'} stroke-background stroke-2`}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>

                  {/* Interactive Chart Tooltip */}
                  <AnimatePresence>
                    {hoveredPoint && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-2 left-1/2 -translate-x-1/2 bg-card border border-border/90 px-3 py-1.5 rounded-lg shadow-xl font-mono text-[10px] space-y-0.5 text-center pointer-events-none"
                      >
                        <div className="font-bold text-foreground">
                          Accuracy: <span className="text-emerald-400">{hoveredPoint.session.accuracy}%</span>
                        </div>
                        <div className="text-muted-foreground font-medium">
                          N={hoveredPoint.session.nLevel} · {hoveredPoint.session.totalTrials} trials
                        </div>
                        <div className="text-[8px] text-muted-foreground/80">
                          {new Date(hoveredPoint.session.created_date).toLocaleDateString()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB B: COACH AUTOPILOT */}
        {activeTab === 'coach' && (
          <div className="space-y-6">
            {/* Coach Rank Status Banner */}
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-5 shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shrink-0">
              <div className="p-3 bg-secondary/50 rounded-full border border-border flex items-center justify-center shrink-0">
                <Award className="w-10 h-10 text-emerald-400 animate-bounce" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-emerald-400">Current Coach frontier (difficulty-ordered)</div>
                <h3 className="text-lg font-mono font-bold text-foreground">{phaseDisplayTitle(coachState.phaseIndex) || 'Initiate'} <span className="text-cyan-400 text-base">· D{COACH_PHASES[coachState.phaseIndex]?.difficulty ?? '?'}</span></h3>
                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed max-w-lg">
                  {COACH_PHASES[coachState.phaseIndex]?.desc || 'Start Coach Autopilot training to elevate cognitive baseline parameters.'}
                </p>
              </div>
              <div className="px-4 py-2 rounded-lg bg-secondary/80 border border-border text-center shrink-0 font-mono">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Autopilot Runs</div>
                <div className="text-lg font-bold text-primary mt-0.5">{autopilotSessions.length}</div>
              </div>
            </div>

            {/* Curriculum ladder progress */}
            <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 shadow-inner space-y-3 shrink-0">
              <div className="flex items-center justify-between font-mono text-xs font-bold text-foreground border-b border-border/40 pb-2">
                <span>STAGE BASICS PROGRESSION</span>
                <span className="text-cyan-400">{Math.round(((Math.max(0, rankOf(coachState.phaseIndex || 0)) + 1) / COACH_PHASES.length) * 100)}% COMPLETE</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {Array.from({ length: COACH_PHASES.length }).map((_, idx) => {
                  // Color by MASTERY LEVEL (0–5) instead of binary
                  // before/at/after. Pre-frontier untouched phases stay grey;
                  // frontier highlighted; mastery levels fade through cyan→
                  // emerald→gold; phases due for review get a violet ring.
                  const m = coachState.phaseMastery?.[idx];
                  const isCurrent = (coachState.phaseIndex || 0) === idx;
                  const lvl = m?.masteryLevel || 0;
                  const sessionN = coachState.sessionCount || 0;
                  const reviewDue = m && m.masteryLevel >= 2 && (m.nextReviewN || 0) <= sessionN;

                  let color;
                  if (!m || m.attempts === 0) {
                    color = 'bg-secondary/40 border-border/50 text-muted-foreground';
                  } else if (lvl === 0) {
                    color = 'bg-red-500/20 border-red-400/50 text-red-300';
                  } else if (lvl === 1) {
                    color = 'bg-amber-500/20 border-amber-400/50 text-amber-300';
                  } else if (lvl === 2) {
                    color = 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300';
                  } else if (lvl === 3) {
                    color = 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300';
                  } else { // 4–5 mastered
                    color = 'bg-yellow-500/30 border-yellow-400/70 text-yellow-200 font-bold';
                  }
                  if (isCurrent) color += ' ring-2 ring-accent/40';
                  if (reviewDue) color += ' ring-2 ring-violet-400/70';

                  const tip = `${phaseDisplayTitle(idx) || ''}\n${m && m.attempts > 0 ? `Lvl ${lvl} · ${m.attempts} attempts · ${m.successes} successes` + (reviewDue ? ' · REVIEW DUE' : (m.nextReviewN ? ` · review in ${Math.max(0, m.nextReviewN - sessionN)}` : '')) : 'Not attempted'}`;

                  return (
                    <div
                      key={idx}
                      className={`py-2 text-center rounded border font-mono text-[10px] flex flex-col justify-center items-center h-10 transition-colors ${color}`}
                      title={tip}
                    >
                      <span className="font-semibold block">{idx + 1}</span>
                      <span className="text-[7px] font-medium block truncate max-w-full px-0.5">{m && m.attempts > 0 ? `L${lvl}` : `N=${COACH_PHASES[idx]?.nLevel || 2}`}</span>
                    </div>
                  );
                })}
              </div>
              {/* Mastery legend */}
              <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono pt-2 border-t border-border/40">
                <span className="text-muted-foreground">Mastery:</span>
                <span className="px-1.5 py-0.5 rounded bg-secondary/40 border border-border/50 text-muted-foreground">none</span>
                <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/50 text-red-300">L0 fail</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300">L1</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300">L2</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/60 text-emerald-300">L3</span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-500/30 border border-yellow-400/70 text-yellow-200 font-bold">L4–5</span>
                <span className="px-1.5 py-0.5 rounded ring-1 ring-violet-400/70 text-violet-300">review due</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/70">
                Sessions played: <strong className="text-foreground">{coachState.sessionCount || 0}</strong> · Frontier: <strong className="text-primary">{phaseDisplayTitle(coachState.phaseIndex || 0) || '—'} (D{COACH_PHASES[coachState.phaseIndex || 0]?.difficulty ?? '?'})</strong> · Phases mastered (L≥2): <strong className="text-emerald-400">{Object.values(coachState.phaseMastery || {}).filter(m => m.masteryLevel >= 2).length}</strong>
              </div>
            </div>

            {/* Autopilot vs Manual performance split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 shadow-lg space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Autopilot Sessions
                </h4>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Sessions Tracked</span>
                    <span className="font-bold text-foreground">{autopilotSessions.length}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Average Accuracy</span>
                    <span className="font-bold text-emerald-400">{autopilotAvgAccuracy}%</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="text-muted-foreground">Rank Progression Ratio</span>
                    <span className="font-bold text-foreground">
                      {autopilotSessions.filter(s => s.accuracy >= 75).length} Up / {autopilotSessions.filter(s => s.accuracy < 55).length} Down
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 shadow-lg space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Manual Sessions
                </h4>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Sessions Tracked</span>
                    <span className="font-bold text-foreground">{manualSessions.length}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Average Accuracy</span>
                    <span className="font-bold text-cyan-400">
                      {manualSessions.length > 0 ? Math.round(manualSessions.reduce((s, x) => s + (x.accuracy || 0), 0) / manualSessions.length) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="text-muted-foreground">Average N-Level</span>
                    <span className="font-bold text-foreground">
                      {manualSessions.length > 0 ? (manualSessions.reduce((s, x) => s + x.nLevel, 0) / manualSessions.length).toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB C: TRAJECTORY N-BACK ANALYTICS (SR / TEM) */}
        {activeTab === 'trajectory' && (() => {
          const tjnSessions = sessions.filter(s => s.modes?.includes('trajectory_nback'));
          const tjnCount = tjnSessions.length;
          const tjnAvgAcc = tjnCount > 0
            ? Math.round(tjnSessions.reduce((a, x) => a + (x.accuracy || 0), 0) / tjnCount)
            : 0;
          const tjnBestAcc = tjnCount > 0
            ? Math.max(...tjnSessions.map(s => s.accuracy || 0))
            : 0;
          // Tier accuracy — tier label embedded in phaseTitle when launched via Coach
          const tierFromTitle = (s) => {
            const t = (s.phaseTitle || '').toLowerCase();
            if (t.includes('easy')) return 'easy';
            if (t.includes('medium') || t.includes('neighbour')) return 'medium';
            if (t.includes('hard') || t.includes('successor')) return 'hard';
            if (t.includes('extreme') || t.includes('revaluation')) return 'extreme';
            return null;
          };
          const tierGroups = ['easy', 'medium', 'hard', 'extreme'].map(tier => {
            const matched = tjnSessions.filter(s => tierFromTitle(s) === tier);
            const avg = matched.length > 0
              ? Math.round(matched.reduce((a, x) => a + (x.accuracy || 0), 0) / matched.length)
              : null;
            return { tier, count: matched.length, avg };
          });
          // Schema vs single — uses phaseTitle "Schema Transfer" presence
          const schemaSessions = tjnSessions.filter(s => /schema|transfer|cross-topology/i.test(s.phaseTitle || ''));
          const singleSessions = tjnSessions.filter(s => !/schema|transfer|cross-topology/i.test(s.phaseTitle || ''));
          const schemaAvg = schemaSessions.length > 0
            ? Math.round(schemaSessions.reduce((a, x) => a + (x.accuracy || 0), 0) / schemaSessions.length)
            : null;
          const singleAvg = singleSessions.length > 0
            ? Math.round(singleSessions.reduce((a, x) => a + (x.accuracy || 0), 0) / singleSessions.length)
            : null;
          // Transfer cost: drop from single-graph to schema-transfer at the same tier ladder
          const transferCost = (schemaAvg != null && singleAvg != null) ? (singleAvg - schemaAvg) : null;

          return (
            <div className="space-y-6">
              {/* Top metric strip */}
              <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/30 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Compass className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-indigo-300">Predictive Map Training</h3>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400/70">Stachenfeld 2017 (SR) · Behrens 2020 (TEM)</span>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground/80 leading-relaxed">
                  Hippocampal / entorhinal training — distinct from PFC working memory. Tracks graph-traversal n-back performance across tiers and across schema-transfer variants.
                </p>
                {tjnCount === 0 ? (
                  <p className="text-[11px] font-mono text-muted-foreground italic">
                    No Trajectory N-Back sessions yet. Enable <strong className="text-indigo-300">Trajectory N-Back</strong> in the start screen, or run Coach Phase 26+.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Sessions', value: tjnCount, color: 'text-primary' },
                      { label: 'Average Accuracy', value: `${tjnAvgAcc}%`, color: 'text-emerald-400' },
                      { label: 'Peak Accuracy', value: `${tjnBestAcc}%`, color: 'text-accent' },
                      { label: 'Schema Transfer Cost', value: transferCost == null ? '—' : `${transferCost > 0 ? '+' : ''}${transferCost}%`, color: transferCost == null ? 'text-muted-foreground' : transferCost > 8 ? 'text-rose-400' : 'text-emerald-400', sub: 'single − schema avg' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-xl bg-background/40 border border-indigo-500/20 p-3 text-center">
                        <div className={`text-xl font-mono font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] font-mono text-foreground font-semibold mt-1">{s.label}</div>
                        {s.sub && <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{s.sub}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tier breakdown */}
              {tjnCount > 0 && (
                <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 space-y-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" /> Tier Accuracy
                  </h3>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    From Coach-launched sessions only (manual launches don't tag tier in phaseTitle).
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {tierGroups.map(g => {
                      const accColor = g.avg == null ? 'text-muted-foreground'
                        : g.avg >= 80 ? 'text-emerald-400'
                        : g.avg >= 60 ? 'text-amber-400' : 'text-rose-400';
                      return (
                        <div key={g.tier} className="rounded-lg bg-background/40 border border-border p-3">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-300">{g.tier}</div>
                          <div className={`text-2xl font-mono font-bold mt-1 ${accColor}`}>{g.avg != null ? `${g.avg}%` : '—'}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">{g.count} session{g.count === 1 ? '' : 's'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Schema vs Single (TEM transfer) */}
              {tjnCount > 0 && (schemaAvg != null || singleAvg != null) && (
                <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 space-y-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-indigo-400" /> Schema Transfer (TEM) vs Single-Graph
                  </h3>
                  <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    Behrens 2020 prediction: a player who encoded the abstract <em>schema</em> rather than the concrete map should perform comparably across both variants. A large gap (single &gt; schema by &gt;8%) suggests surface-level memorization rather than schema abstraction.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-background/40 border border-border p-3">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">Single-Graph</div>
                      <div className="text-2xl font-mono font-bold mt-1 text-emerald-400">{singleAvg != null ? `${singleAvg}%` : '—'}</div>
                      <div className="text-[9px] font-mono text-muted-foreground">{singleSessions.length} session{singleSessions.length === 1 ? '' : 's'}</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border p-3">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-violet-300">Schema Transfer (TEM)</div>
                      <div className="text-2xl font-mono font-bold mt-1 text-emerald-400">{schemaAvg != null ? `${schemaAvg}%` : '—'}</div>
                      <div className="text-[9px] font-mono text-muted-foreground">{schemaSessions.length} session{schemaSessions.length === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                  {transferCost != null && (
                    <div className={`text-[11px] font-mono rounded-lg px-3 py-2 border ${transferCost > 8 ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                      {transferCost > 8
                        ? `Transfer cost = ${transferCost}%. You're encoding maps surface-deep — practice schema mode more to abstract the topology.`
                        : transferCost > 0
                          ? `Transfer cost = ${transferCost}%. Mild surface dependency, mostly schema-encoded.`
                          : `Transfer cost = ${transferCost}%. Schema transfer is at parity or better than single-graph — strong evidence of abstract schema encoding.`}
                    </div>
                  )}
                </div>
              )}

              {/* Recent TJN sessions list */}
              {tjnCount > 0 && (
                <div className="rounded-xl bg-secondary/35 border border-border/80 p-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Recent TJN Sessions
                  </h3>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {tjnSessions.slice(-10).reverse().map((s, i) => {
                      const tier = tierFromTitle(s) || '?';
                      const accColor = (s.accuracy || 0) >= 75 ? 'text-emerald-400'
                        : (s.accuracy || 0) >= 55 ? 'text-amber-400' : 'text-rose-400';
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-background/40 border border-border/60 font-mono text-[11px]">
                          <span className="text-foreground/85 truncate flex-1">{s.phaseTitle || 'Manual TJN'}</span>
                          <span className="text-[10px] uppercase tracking-wider text-indigo-300 shrink-0">{tier}</span>
                          <span className={`font-bold shrink-0 ${accColor}`}>{Math.round(s.accuracy || 0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB D: STRESSOR ANALYTICS */}
        {activeTab === 'stressors' && (
          <div className="space-y-6">
            {/* N-Level Accuracy Breakdown Bar Chart */}
            <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 shadow-lg space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">N-Level Performance Breakdown</h3>
                <p className="text-[10px] font-mono text-muted-foreground">Accuracy averages relative to target memory capacity</p>
              </div>

              {nStats.length === 0 ? (
                <div className="h-28 rounded-lg border border-dashed border-border flex items-center justify-center font-mono text-xs text-muted-foreground">
                  No sessions on record to compute capacity metrics.
                </div>
              ) : (
                <div className="space-y-3 shrink-0 font-mono text-xs">
                  {nStats.map(stat => (
                    <div key={stat.nLevel} className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-foreground">N={stat.nLevel} Training (capacity)</span>
                        <span className="text-primary font-bold">{stat.avgAccuracy}% accuracy <span className="text-[10px] text-muted-foreground font-normal">({stat.count} runs)</span></span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border/30">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${stat.avgAccuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selective Attention (decoy filter) — with vs without comparison */}
            {(() => {
              const withDecoy = sessions.filter(s => s.decoyFilterActive);
              const withoutDecoy = sessions.filter(s => !s.decoyFilterActive);
              if (withDecoy.length === 0) return null;
              const avg = (arr) => arr.length ? Math.round(arr.reduce((a, x) => a + (x.accuracy || 0), 0) / arr.length) : null;
              const wAvg = avg(withDecoy);
              const woAvg = avg(withoutDecoy);
              const drop = (wAvg != null && woAvg != null) ? (woAvg - wAvg) : null;
              return (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/30 p-4 shadow-lg space-y-3">
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300">Selective Attention (Decoy)</h3>
                    <p className="text-[10px] font-mono text-muted-foreground">Scored-stream accuracy with a spurious decoy present vs absent. A drop means the distractor is taxing you — that's the training effect.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="rounded-lg bg-background/40 border border-border p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-400">{woAvg != null ? `${woAvg}%` : '—'}</div>
                      <div className="text-[10px] text-foreground font-semibold mt-1">Without decoy</div>
                      <div className="text-[9px] text-muted-foreground">{withoutDecoy.length} session{withoutDecoy.length === 1 ? '' : 's'}</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-amber-500/30 p-3 text-center">
                      <div className="text-2xl font-bold text-amber-400">{wAvg != null ? `${wAvg}%` : '—'}</div>
                      <div className="text-[10px] text-foreground font-semibold mt-1">With decoy</div>
                      <div className="text-[9px] text-muted-foreground">{withDecoy.length} session{withDecoy.length === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                  {drop != null && (
                    <div className={`text-[11px] font-mono rounded-lg px-3 py-2 border ${drop > 5 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                      {drop > 5
                        ? `Decoy cost = ${drop}% — the distractor is meaningfully taxing your scored streams. Keep training to build filtering resistance.`
                        : drop >= 0
                          ? `Decoy cost = ${drop}% — minimal interference; your selective attention is holding up well.`
                          : `Decoy cost = ${drop}% — you actually score higher with a decoy present (small-sample noise or extra arousal).`}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Stressors Accuracy Comparison Panel */}
            <div className="rounded-xl bg-secondary/35 border border-border/80 p-4 shadow-lg space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">Active Stressors Impact Profile</h3>
                <p className="text-[10px] font-mono text-muted-foreground">Mean accuracy under explicit difficulty combinations</p>
              </div>

              {modeStats.length === 0 ? (
                <div className="h-28 rounded-lg border border-dashed border-border flex items-center justify-center font-mono text-xs text-muted-foreground">
                  Activate special enhancement modes in your baseline configs to view stressor performance.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 font-mono text-xs">
                  {modeStats.map(stat => (
                    <div key={stat.id} className="p-3 bg-secondary/35 border border-border/80 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold text-foreground capitalize">{stat.id.replace(/_/g, ' ')}</span>
                        <span className="block text-[9px] text-muted-foreground font-medium">{stat.count} sessions completed</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${stat.avgAccuracy >= 75 ? 'text-emerald-400' : stat.avgAccuracy >= 55 ? 'text-cyan-400' : 'text-red-400'}`}>
                          {stat.avgAccuracy}%
                        </span>
                        <span className="block text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">Avg Acc</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NRINT per-rule accuracy breakdown (Grapist's match rules).
                With multi-rule + weighted sessions, single-rule sessions
                contribute their overall accuracy to that rule's row, while
                multi-rule sessions break down to per-trial granularity using
                each trial's recorded _nrintMatchRule (one of the 5 sampled
                that trial). This keeps the aggregate honest across mixes. */}
            {(() => {
              const nrintSessions = sessions.filter(s => s.nrintMatchRule);
              if (!nrintSessions.length) return null;
              const rules = ['union', 'intersection', 'xor', 'implication', 'biconditional'];
              const isMultiRule = (s) => {
                const w = s.nrintMatchRuleWeights;
                if (!w || typeof w !== 'object') return false;
                const active = rules.filter(r => Number(w[r]) > 0);
                return active.length > 1;
              };
              const rows = rules.map(r => {
                // Single-rule sessions for rule r: contribute their overall accuracy
                const singleMatched = nrintSessions.filter(s => !isMultiRule(s) && s.nrintMatchRule === r);
                const singleAccs = singleMatched.map(s => Number(s.accuracy) || 0);
                // Multi-rule sessions: count per-trial hits/totals for trials sampled to r
                let multiHits = 0, multiTotal = 0, multiSessionCount = 0;
                nrintSessions.filter(isMultiRule).forEach(s => {
                  const ts = (s.trials || []).filter(t => t?.responseType === 'relation' && t?.stimulus?._nrintMatchRule === r);
                  if (ts.length) {
                    multiSessionCount++;
                    multiTotal += ts.length;
                    multiHits += ts.filter(t => t.correct).length;
                  }
                });
                const singleAcc = singleAccs.length ? singleAccs.reduce((a, x) => a + x, 0) / singleAccs.length : null;
                const multiAcc = multiTotal > 0 ? (multiHits / multiTotal) * 100 : null;
                let avg = null;
                if (singleAcc != null && multiAcc != null) avg = Math.round((singleAcc * singleMatched.length + multiAcc * multiSessionCount) / (singleMatched.length + multiSessionCount));
                else if (singleAcc != null) avg = Math.round(singleAcc);
                else if (multiAcc != null) avg = Math.round(multiAcc);
                return { rule: r, count: singleMatched.length + multiSessionCount, avg };
              });
              return (
                <div className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/30 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-fuchsia-300">Nonverbal RINT · per match rule</h3>
                    <span className="text-[10px] font-mono text-fuchsia-400/70">{nrintSessions.length} NRINT sessions</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground/80">Average accuracy under each of the 5 NRINT logical rules — Union (default), Intersection, XOR, Implication, Biconditional. Multi-rule sessions break down per-trial via the recorded rule on each trial.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-center">
                    {rows.map(r => {
                      const accColor = r.avg == null ? 'text-muted-foreground' : r.avg >= 75 ? 'text-emerald-400' : r.avg >= 55 ? 'text-cyan-400' : 'text-amber-400';
                      return (
                        <div key={r.rule} className="rounded-lg bg-background/40 border border-border p-2">
                          <div className={`text-lg font-bold ${accColor}`}>{r.avg == null ? '—' : `${r.avg}%`}</div>
                          <div className="text-[9px] uppercase tracking-widest text-fuchsia-300">{r.rule}</div>
                          <div className="text-[8px] text-muted-foreground">{r.count}x</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Multi-rule sessions block — surfaces the rule mix used
                      and the realised per-trial frequencies (which can drift
                      from the configured weights on short sessions). */}
                  {(() => {
                    const multi = nrintSessions.filter(isMultiRule);
                    if (!multi.length) return null;
                    // Aggregate realised per-rule trial counts across multi sessions
                    const realised = { union: 0, intersection: 0, xor: 0, implication: 0, biconditional: 0 };
                    let total = 0;
                    multi.forEach(s => {
                      (s.trials || []).forEach(t => {
                        if (t?.responseType === 'relation' && rules.includes(t?.stimulus?._nrintMatchRule)) {
                          realised[t.stimulus._nrintMatchRule]++;
                          total++;
                        }
                      });
                    });
                    return (
                      <div className="pt-3 border-t border-fuchsia-500/20 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300/90">Multi-rule sessions</span>
                          <span className="text-[10px] font-mono text-fuchsia-400/70">{multi.length} session{multi.length === 1 ? '' : 's'} · {total} trial{total === 1 ? '' : 's'}</span>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/80">
                          Realised per-trial rule frequency across all multi-rule sessions (sampled by configured weights; short sessions can drift from target).
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {rules.filter(r => realised[r] > 0).map(r => {
                            const pct = total ? Math.round((realised[r] / total) * 100) : 0;
                            return (
                              <span key={r} className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200">
                                {r} {pct}% <span className="text-fuchsia-400/60">({realised[r]})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Synaesthesia Training Performance Card */}
            <div className="rounded-xl bg-gradient-to-br from-indigo-900/10 to-indigo-950/20 border border-indigo-500/20 p-4 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 animate-pulse" /> Synaesthesia training metrics
                  </h3>
                  <p className="text-[10px] font-mono text-muted-foreground">Progression trends using custom grapheme-color mappings</p>
                </div>
                {synaesthesiaCount > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">
                    ACTIVE SESSIONS: {synaesthesiaCount}
                  </span>
                )}
              </div>

              {synaesthesiaCount === 0 ? (
                <div className="h-24 rounded-lg border border-dashed border-indigo-500/20 flex items-center justify-center font-mono text-xs text-muted-foreground/60 text-center px-4">
                  Launch a session with Synaesthesia Mode toggled on to capture your character-color associative working memory charts here!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 font-mono text-xs">
                  <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-300">Synaesthesia Memory Accuracy</span>
                      <span className="block text-[9px] text-muted-foreground font-medium">Mean target detection correctness</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${synaesthesiaAvgAccuracy >= 75 ? 'text-emerald-400' : synaesthesiaAvgAccuracy >= 55 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {synaesthesiaAvgAccuracy}%
                      </span>
                      <span className="block text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">Avg Acc</span>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-300">Associated Grapheme Capacity</span>
                      <span className="block text-[9px] text-muted-foreground font-medium">Derived fluid retention rating</span>
                    </div>
                    <div className="text-right font-mono font-bold text-indigo-300 text-sm">
                      {synaesthesiaAvgAccuracy >= 85 ? 'ELITE' : synaesthesiaAvgAccuracy >= 70 ? 'ADVANCED' : 'BUILDING'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export/Import Controls */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button onClick={handleExport} className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 font-mono text-xs">
            <Download className="w-3.5 h-3.5" /> Export Data
          </Button>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 cursor-pointer transition-colors font-mono text-xs font-semibold">
            <Upload className="w-3.5 h-3.5" /> Import Data
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {importError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-xs font-mono shrink-0">
            {importError}
          </div>
        )}

        {/* Sessions List */}
        <div className="space-y-3 shrink-0">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">Detailed Session History</h2>

          {sessions.length === 0 ? (
            <div className="rounded-xl bg-secondary/35 border border-border/80 p-6 text-center">
              <p className="text-xs font-mono text-muted-foreground">No cognitive training sessions detected. Launch a training run to load analytics.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
              {[...sessions]
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                .map((session, idx) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(10, idx) * 0.03 }}
                    className="rounded-lg bg-secondary/30 border border-border p-3.5 flex items-center justify-between gap-3 text-left hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="font-mono font-bold text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                        <span>N={session.nLevel}</span>
                        {session.autopilot ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-[8px] font-bold text-emerald-400 flex items-center gap-0.5">
                            <Zap className="w-2 h-2 animate-pulse" /> {session.phaseTitle || 'Autopilot'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-[8px] font-bold text-cyan-400">
                            Manual
                          </span>
                        )}
                        {session.noobMode && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[8px] font-bold text-amber-400">
                            NOOB
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{new Date(session.created_date).toLocaleString()}</span>
                        <span>·</span>
                        <span>{session.totalTrials} trials</span>
                        {session.modes && session.modes.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-primary truncate max-w-[200px]" title={session.modes.join(', ')}>
                              {session.modes.map(m => m.replace(/_/g, ' ')).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                      {/* RST family micro-row — only if this session had any
                          RST trials with a recorded family. Each chip shows
                          accuracy% on that family. Helps spot whether Hard
                          (Analogy) accuracy lags Easy (Distinction). */}
                      {(() => {
                        const trials = session.trials || [];
                        const rstTrials = trials.filter(t => t.responseType === 'rst');
                        if (rstTrials.length === 0) return null;
                        const families = { distinction: { c: 0, t: 0 }, comparison: { c: 0, t: 0 }, analogy: { c: 0, t: 0 } };
                        rstTrials.forEach(t => {
                          const fam = t.rst?.family || 'distinction';
                          if (!families[fam]) return;
                          families[fam].t++;
                          if (t.correct) families[fam].c++;
                        });
                        const chips = Object.entries(families).filter(([, v]) => v.t > 0);
                        if (chips.length === 0) return null;
                        const famLabel = { distinction: 'DIST', comparison: 'COMP', analogy: 'ANLG' };
                        return (
                          <div className="text-[10px] font-mono text-violet-300/80 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-violet-400/60 uppercase">RST</span>
                            {chips.map(([fam, v]) => {
                              const acc = Math.round((v.c / v.t) * 100);
                              const cls = acc >= 75 ? 'text-emerald-400' : acc >= 50 ? 'text-amber-400' : 'text-red-400';
                              return (
                                <span key={fam} className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/30">
                                  {famLabel[fam]}: <span className={cls + ' font-bold'}>{acc}%</span> <span className="text-muted-foreground/60">({v.t})</span>
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-base font-mono font-bold ${session.accuracy >= 75 ? 'text-emerald-400' : session.accuracy >= 55 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {session.accuracy}%
                      </div>
                      <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Acc</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Link to={`/review/${session.id}`}>
                        <button className="w-7 h-7 rounded bg-secondary/80 border border-border text-muted-foreground hover:text-primary transition-colors flex items-center justify-center" title="Review trials">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="w-7 h-7 rounded bg-secondary/80 border border-border text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}