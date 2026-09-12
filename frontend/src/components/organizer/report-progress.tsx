"use client";

import { Check, Layers3, ScanLine, Shapes, FileText, Bot, LoaderCircle } from "lucide-react";
import type { CSSProperties } from "react";

import { reportStages } from "@/lib/report-presentation";

import styles from "./report-progress.module.css";

const icons = [Layers3, Shapes, ScanLine, FileText];
const delay = (index: number): CSSProperties => ({ "--i": index }) as CSSProperties;

export function ReportProgress({ step }: { step: number }) {
  const ready = step >= reportStages.length;
  const stage = reportStages[Math.min(step, reportStages.length - 1)];

  return <section className={styles.workspace} aria-label="Report creation progress" data-report-step={step}>
    <aside className={styles.sidebar}>
      <div className={styles.identity}><span className={styles.agentIcon}><Bot size={18} aria-hidden="true" /></span><span>Saywide agent</span></div>
      <h1 className={styles.heading}>From voices<br /> to clarity.</h1>
      <p className={styles.intro}>A thoughtful look at what people have to say.</p>
      <ol className={styles.steps}>
        {reportStages.map((item, index) => {
          const Icon = icons[index];
          const status = index < step ? "complete" : index === step ? "active" : "waiting";
          return <li key={item.progress} className={styles.step} data-status={status} aria-current={status === "active" ? "step" : undefined}>
            <span className={styles.stepIcon}>{status === "complete" ? <Check size={18} className={styles.check} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}</span>
            <span className={styles.stepLabel}>{item.label}<span className="sr-only"> — {status}</span></span>
            {status === "active" && <LoaderCircle size={20} strokeWidth={2.5} className={styles.stepLoader} aria-hidden="true" />}
          </li>;
        })}
      </ol>
      <div className={styles.sidebarFoot}><span className={styles.smallLine} /> Voices become understanding</div>
    </aside>
    <div className={styles.stage}>
      <div className={styles.stageTop}><span className={styles.stageEyebrow}>{ready ? "Ready for you" : "Your responses, taking shape"}</span><span className={styles.counter}>{ready ? <Check size={14} aria-hidden="true" /> : `0${step + 1}`}<span>/ 04</span></span></div>
      <div className={styles.sceneWindow} aria-hidden="true">
        <div className={styles.halo} />
        <div key={step} className={styles.sceneEntry}><ReportScene step={step} /></div>
      </div>
      <div key={`copy-${step}`} className={styles.caption} role="status" aria-live="polite" aria-atomic="true">
        <p className={styles.stageEyebrow}>{ready ? "All four steps complete" : `Step ${step + 1} · ${stage.label}`}</p>
        <h2>{ready ? "Your report is ready." : stage.title}</h2>
        <p className={styles.description}>{ready ? "The findings, the evidence, and a way forward." : stage.description}</p>
      </div>
      <div className={styles.segments} aria-hidden="true">{reportStages.map((item, index) => <span key={item.progress} data-status={index < step ? "complete" : index === step ? "active" : "waiting"}><i /></span>)}</div>
    </div>
  </section>;
}

function ResponseCard({ x, y, index = 0, tint = false }: { x: number; y: number; index?: number; tint?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <g className={styles.responseCard} style={delay(index)}>
      <rect width="140" height="78" rx="12" fill={tint ? "#edf5f0" : "white"} stroke="#cbded3" />
      <circle cx="23" cy="23" r="9" fill="#dcece2" />
      <path d="M20 21h3v4h-4v-3l2-3m5 2h3v4h-4v-3l2-3" fill="none" stroke="#54816b" strokeWidth="1.4" />
      <path d="M43 22h72M20 46h100M20 57h72" stroke="#c8d9cf" strokeWidth="5" strokeLinecap="round" />
    </g>
  </g>;
}

function ReportScene({ step }: { step: number }) {
  return <svg viewBox="0 0 600 340" className={styles.illustration} data-ready={step >= 4} fill="none">
    <ellipse cx="300" cy="296" rx="174" ry="17" fill="#244e3a" opacity=".045" />
    {step === 0 && <>
      <rect x="211" y="76" width="178" height="190" rx="20" stroke="#a9c7b7" strokeDasharray="5 7" />
      <g className={styles.stackBack}><rect x="229" y="112" width="142" height="126" rx="14" fill="#d8e8de" stroke="#b8d0c2" /></g>
      <g className={styles.gatherLeft}><ResponseCard x={66} y={79} index={0} /></g>
      <g className={styles.gatherRight}><ResponseCard x={394} y={156} index={1} /></g>
      <g className={styles.gatherBottom}><ResponseCard x={218} y={220} index={2} /></g>
      <ResponseCard x={230} y={125} index={3} tint />
      <g className={styles.centerSeal}><circle cx="370" cy="99" r="21" fill="#286451" /><path d="m360 99 7 7 13-14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>
    </>}
    {step === 1 && <>
      <path d="M300 162 135 106M300 162l165-56M300 162v90" className={styles.connection} />
      {[{ x: 50, y: 54, tint: "#e4efe8" }, { x: 390, y: 54, tint: "#e9edf4" }, { x: 220, y: 224, tint: "#f3eddf" }].map((group, index) => <g key={index}>
        <rect x={group.x - 12} y={group.y - 12} width="174" height="105" rx="20" fill={group.tint} className={styles.groupHalo} style={delay(index)} />
        <ResponseCard x={group.x + 6} y={group.y + 4} index={index} />
      </g>)}
      <g className={styles.themeCore}><circle cx="300" cy="160" r="39" fill="white" stroke="#b5cebf" /><circle cx="300" cy="160" r="28" fill="#286451" /><path d="M285 160h30m-15-15v30m-10-25 20 20m0-20-20 20" stroke="#cce6d7" strokeWidth="2" strokeLinecap="round" /></g>
      <circle r="4" fill="#286451" className={styles.travelerOne} /><circle r="4" fill="#658477" className={styles.travelerTwo} /><circle r="4" fill="#b59c68" className={styles.travelerThree} />
    </>}
    {step === 2 && <>
      <g className={styles.evidencePaper}>
        <rect x="103" y="55" width="242" height="233" rx="18" fill="white" stroke="#bfd3c7" />
        <rect x="126" y="78" width="33" height="33" rx="9" fill="#e4efe8" />
        <path d="M138 88h5v10h-8v-7l4-5m12 2h5v10h-8v-7l4-5" stroke="#54816b" strokeWidth="1.5" transform="translate(-2 0)" />
        <path d="M174 88h107M174 101h70" stroke="#ceded4" strokeWidth="6" strokeLinecap="round" />
        {[0, 1, 2].map(index => <g key={index}>
          <rect x="124" y={134 + index * 43} width="198" height="30" rx="6" fill="#eff5f1" />
          <path d={`M135 ${149 + index * 43}h${150 - index * 16}`} stroke="#aac7b7" strokeWidth="4" strokeLinecap="round" />
          <path d={`M345 ${149 + index * 43}h38l20 ${index === 1 ? 0 : index === 0 ? 24 : -24}`} className={styles.evidenceLink} style={delay(index)} />
        </g>)}
        <rect x="116" y="128" width="218" height="39" rx="8" fill="#66a18d" opacity=".17" className={styles.scan} />
      </g>
      <g className={styles.verifiedSeal}><circle cx="434" cy="192" r="53" fill="#e6f0e9" /><circle cx="434" cy="192" r="38" fill="#286451" /><path d="m416 192 12 12 25-27" className={styles.svgCheck} stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>
    </>}
    {step >= 3 && <>
      <g className={styles.document}>
        <rect x="196" y="49" width="218" height="261" rx="17" fill="#dcebe2" transform="rotate(5 305 179)" />
        <rect x="188" y="36" width="218" height="261" rx="17" fill="white" stroke="#bcd3c5" />
        <rect x="210" y="58" width="30" height="7" rx="3.5" fill="#286451" />
        <path d="M210 86h157M210 101h111" stroke="#386b52" strokeWidth="7" strokeLinecap="round" className={styles.reportLine} style={delay(0)} />
        <path d="M210 124h166M210 135h139" stroke="#ccded2" strokeWidth="4" strokeLinecap="round" className={styles.reportLine} style={delay(1)} />
        <rect x="209" y="155" width="177" height="80" rx="10" fill="#f0f6f2" />
        {[29, 49, 37, 60, 46].map((height, index) => <rect key={index} x={229 + index * 29} y={221 - height} width="17" height={height} rx="4" fill={index === 3 ? "#286451" : "#8ab69c"} className={styles.bar} style={delay(index)} />)}
        <path d="M212 255h164M212 268h111" stroke="#ccded2" strokeWidth="4" strokeLinecap="round" className={styles.reportLine} style={delay(3)} />
      </g>
      {step === 3 && <>
        <g className={styles.orbitNote}><rect x="85" y="122" width="75" height="57" rx="11" fill="white" stroke="#c4d9cc" /><path d="M100 140h44M100 152h30M100 164h38" stroke="#93b59f" strokeWidth="3" strokeLinecap="round" /></g>
        <g className={styles.orbitNoteRight}><rect x="440" y="189" width="68" height="60" rx="11" fill="#e9f1eb" stroke="#c4d9cc" /><path d="m457 219 9 9 24-24" stroke="#54816b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>
      </>}
      {step >= 4 && <g className={styles.readySeal}><circle cx="400" cy="255" r="43" fill="#e2f0e7" /><circle cx="400" cy="255" r="32" fill="#286451" /><path d="m386 255 10 10 20-22" className={styles.svgCheck} stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></g>}
    </>}
    <g className={styles.ambientDots}><circle cx="79" cy="224" r="3" fill="#99b9a7" /><circle cx="498" cy="82" r="4" fill="#c1d2c7" /><path d="M448 45v10m-5-5h10M149 290v8m-4-4h8" stroke="#98b5a5" strokeWidth="1.5" strokeLinecap="round" /></g>
  </svg>;
}
