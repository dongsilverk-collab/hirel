import Head from "next/head";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

// mammoth is browser-only
let mammoth;
if (typeof window !== "undefined") {
  mammoth = require("mammoth");
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#070B12", surface:"#0C1220", card:"#101828",
  border:"#1a2d45", borderL:"#213550",
  accent:"#3B82F6", glow:"rgba(59,130,246,0.13)",
  teal:"#0EA5E9", green:"#10B981", amber:"#F59E0B", red:"#EF4444",
  purple:"#8B5CF6", pink:"#EC4899",
  text:"#F1F5F9", sub:"#94A3B8", muted:"#3d5470",
};
const ROLE_COLORS = [
  { accent:"#3B82F6", glow:"rgba(59,130,246,.15)" },
  { accent:"#10B981", glow:"rgba(16,185,129,.15)" },
  { accent:"#8B5CF6", glow:"rgba(139,92,246,.15)" },
  { accent:"#F59E0B", glow:"rgba(245,158,11,.15)" },
  { accent:"#EC4899", glow:"rgba(236,72,153,.15)" },
  { accent:"#0EA5E9", glow:"rgba(14,165,233,.15)" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function fileToBase64(f){return new Promise((r,j)=>{const x=new FileReader();x.onload=()=>r(x.result.split(",")[1]);x.onerror=j;x.readAsDataURL(f)});}
function fileToText(f){return new Promise((r,j)=>{const x=new FileReader();x.onload=()=>r(x.result);x.onerror=j;x.readAsText(f,"UTF-8")});}
async function docxText(f){if(!mammoth)return"";const ab=await f.arrayBuffer();return(await mammoth.extractRawText({arrayBuffer:ab})).value;}
function fileIcon(t=""){return t.includes("pdf")?"📄":t.includes("word")||t.includes("docx")?"📝":t.startsWith("image")?"🖼":"📃";}
function fmtSize(b){return b<1024?b+" B":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";}
function fmtTime(s){return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
const sc=(s)=>s>=75?C.green:s>=50?C.accent:s>=30?C.amber:C.red;
const scHex=(s)=>s>=75?"#10B981":s>=50?"#3B82F6":s>=30?"#F59E0B":"#EF4444";

// ─── AI call (via /api/chat proxy) ───────────────────────────────────────────
async function callAI(body) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, ...body }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (e) {
    console.error("API 호출 오류:", e);
    throw e;
  }
}

// ─── 큐라엘 컬쳐 기준 (고정) ─────────────────────────────────────────────────
const CURAEL_CULTURE = `
=== 큐라엘(CURAEL) 회사 소개 및 컬쳐 기준 ===

【회사 미션】
암환자의 지름길이 되는 회사 — 암환자가 올바른 정보와 제품에 가장 빠르게 접근할 수 있도록 돕는다.

【팀 구성】 소수정예 일당백 조직
- 김훈하 대표 (약사·통합종양학 연구자·5권 저자)
- 김동은 상무 / 김민경 MD / 유환진 콘텐츠 PD
- 이우석 연구원 / 유해인 인사 / 박형철 유통
- 열방약국과 긴밀하게 협업

【우리가 원하는 사람】
✓ 소수 인원에서 여러 역할을 유연하게 맡을 수 있는 사람 (일당백 마인드)
✓ 암환자·의료·헬스케어에 진심으로 관심 있는 사람
✓ 근거 중심 사고 — 데이터와 논문을 기반으로 판단하는 사람
✓ 빠른 실행력 — 완벽함보다 빠른 실험과 개선을 즐기는 사람
✓ 자율과 책임 — 지시 없이도 스스로 목표를 세우고 달성하는 사람
✓ 환자 중심 마인드 — 모든 의사결정의 기준이 암환자에게 도움이 되는가

【맞지 않는 사람】
✗ 대기업 스타일의 명확한 분업과 지시를 선호하는 사람
✗ 헬스케어/의료에 관심 없이 그냥 마케팅/개발 업무만 하고 싶은 사람
✗ 성장보다 안정을 우선시하는 사람
✗ 빠른 변화와 불확실성을 힘들어하는 사람

【우리의 일하는 방식】
- 작은 팀이라 한 사람의 영향력이 크다
- 열방약국(암환자 전문 약국)과 실제 환자 데이터·상담을 공유하며 제품 개발
- 콘텐츠, 연구, 유통, 마케팅이 유기적으로 연결된 통합 운영
- 대표가 현장에서 함께 일하는 플랫 구조
`;

async function analyzeResume(jd, candidate) {
  const prompt = `당신은 큐라엘(CURAEL) 전담 HR 전문가 AI입니다. 아래 회사 정보와 채용 공고를 바탕으로 후보자 적합도를 정밀 평가하세요.

${CURAEL_CULTURE}

=== 채용 공고 (포지션별 JD) ===
${jd}

=== 후보자 ===
이름: ${candidate.name}${candidate.age ? ` (${candidate.age}세)` : ""}
${candidate.resume || ""}${candidate.files?.length ? "\n\n첨부 파일도 함께 분석하세요." : ""}

【컬쳐핏 평가 기준】
위 큐라엘 컬쳐 기준을 반드시 반영하여 cultureFit 점수를 매기세요.
소수정예 일당백, 환자 중심, 자율과 책임, 빠른 실행 마인드를 중점적으로 평가하세요.

【면접 질문 20개 생성 규칙】
반드시 아래 구성으로 정확히 20개 생성하되, 후보자의 이력서와 약점을 철저히 반영한 맞춤형 질문을 만드세요:

- culture (인성/컬쳐핏): 3개 — 큐라엘 소수정예/일당백/환자중심 문화 적합성
- skill (직무 역량): 5개 — 해당 포지션 실무 능력, 후보자 이력서의 경험 구체적으로 검증
- future (미래/방향성): 2개 — 암환자 시장과 큐라엘 성장 방향에 대한 생각
- killpath (킬패스/단점): 3개 — 후보자의 약점과 리스크를 날카롭게 파고드는 질문. 이력서에서 발견된 공백, 짧은 재직기간, 부족한 역량을 정조준
- growth (자기계발): 2개 — 최근 학습, 성장 의지, 5년 후 커리어 비전
- dataSkill (데이터 실전능력): 3개 — 실제 업무 케이스 기반 실전 능력 검증 (포지션에 맞게 조정)
- execution (실행력): 2개 — 마감 압박, 갈등 상황, 위기 대처 구체적 사례 요구

순수 JSON으로만 응답 (마크다운 없이):
{"totalScore":숫자(0-100),"scores":{"experienceMatch":숫자(0-100),"cultureFit":숫자(0-100),"skillKeywords":숫자(0-100),"stability":숫자(0-100)},"verdict":"추천"|"검토필요"|"부적합","strengths":["강점1","강점2","강점3"],"weaknesses":["약점1","약점2"],"keywords":[{"word":"키워드","type":"positive"|"negative"|"neutral"}],"interviewQuestions":{"culture":["질문1","질문2","질문3"],"skill":["질문1","질문2","질문3","질문4","질문5"],"future":["질문1","질문2"],"killpath":["질문1","질문2","질문3"],"growth":["질문1","질문2"],"dataSkill":["질문1","질문2","질문3"],"execution":["질문1","질문2"]},"summary":"2-3문장 요약"}`;

  const rich = (candidate.files || []).filter(f => f.kind === "pdf" || f.kind === "image");
  const content = rich.length > 0
    ? [...rich.map(f => f.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.b64 } }
        : { type: "image", source: { type: "base64", media_type: f.type.includes("png") ? "image/png" : "image/jpeg", data: f.b64 } }),
       { type: "text", text: prompt }]
    : prompt;

  const data = await callAI({ messages: [{ role: "user", content }] });
  return JSON.parse(data.content.map(b => b.text || "").join("").replace(/```json|```/g, "").trim());
}

async function scoreInterview(jd, name, transcript, questions) {
  const allQ = questions ? [...(questions.culture||[]),...(questions.skill||[]),...(questions.future||[]),...(questions.killpath||[]),...(questions.growth||[]),...(questions.dataSkill||[]),...(questions.execution||[])] : [];
  const prompt = `당신은 큐라엘(CURAEL) 전담 면접관 AI입니다.
${CURAEL_CULTURE}
채용 포지션 JD: ${jd.slice(0, 300)}
후보자: ${name}
준비된 질문: ${allQ.join(" / ") || "자유 면접"}

=== 지금까지의 면접 녹취록 ===
${transcript}

위 녹취록을 실시간 평가하세요. 큐라엘 컬쳐핏(일당백, 환자 중심, 자율과 책임)을 중점 반영하세요.
순수 JSON으로만:
{"liveScore":숫자(0-100),"dimensions":{"communication":숫자,"expertise":숫자,"motivation":숫자,"problemSolving":숫자,"culture":숫자},"highlights":["인상적인 발언 요약1","인상적인 발언 요약2"],"concerns":["우려 포인트1"],"nextQuestion":"지금 상황에서 가장 적절한 다음 질문","oneliner":"현재까지 한줄 평가"}`;
  const data = await callAI({ messages: [{ role: "user", content: prompt }] });
  return JSON.parse(data.content.map(b => b.text || "").join("").replace(/```json|```/g, "").trim());
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportCandidatePDF(candidate, position) {
  const a = candidate.analysis;
  if (!a) return;
  const rc = ROLE_COLORS[position?.colorIdx || 0];

  const verdictColor = { "추천": "#10B981", "검토필요": "#F59E0B", "부적합": "#EF4444" }[a.verdict] || "#94A3B8";

  const scoreBar = (label, score) => {
    const color = scHex(score);
    return `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:13px;color:#555">${label}</span>
          <span style="font-size:13px;font-weight:700;color:${color}">${score}점</span>
        </div>
        <div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${score}%;background:${color};border-radius:3px"></div>
        </div>
      </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>HireL 면접 리포트 — ${candidate.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; }
  h2 { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
  .section { margin-bottom: 28px; }
  .chip { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  @media print { body { padding: 20px; } button { display:none; } }
</style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e5e7eb">
    <div>
      <div style="font-size:11px;color:#9ca3af;font-weight:600;letter-spacing:1px;margin-bottom:6px">HIRERL 면접 분석 리포트</div>
      <h1>${candidate.name}</h1>
      <div style="margin-top:6px;display:flex;gap:10px;align-items:center">
        ${candidate.age ? `<span style="font-size:13px;color:#6b7280">${candidate.age}세</span>` : ""}
        <span style="font-size:12px;color:${rc.accent};background:${rc.accent}18;border:1px solid ${rc.accent}40;padding:2px 10px;border-radius:12px;font-weight:600">${position?.name || ""}</span>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:48px;font-weight:800;color:${scHex(a.totalScore)};line-height:1">${a.totalScore}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:2px">종합 적합도</div>
      <div style="margin-top:6px">
        <span class="chip" style="background:${verdictColor}18;border:1px solid ${verdictColor}40;color:${verdictColor}">${a.verdict}</span>
      </div>
    </div>
  </div>

  <!-- Scores -->
  <div class="section grid2">
    <div>
      <h2>점수 세부 분석</h2>
      ${scoreBar("직무 경험 매칭", a.scores.experienceMatch)}
      ${scoreBar("가치관/문화 적합도", a.scores.cultureFit)}
      ${scoreBar("역량 키워드 분석", a.scores.skillKeywords)}
      ${scoreBar("이직 패턴/안정성", a.scores.stability)}
    </div>
    <div>
      <div style="margin-bottom:20px">
        <h2>AI 종합 요약</h2>
        <p style="font-size:13px;color:#374151;line-height:1.7">${a.summary}</p>
      </div>
      <div>
        <h2>면접 추천 여부</h2>
        <p style="font-size:14px;line-height:1.7;color:${verdictColor};font-weight:700">${a.verdict}</p>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">
          ${a.verdict === "추천" ? "채용 면접 적극 권장" : a.verdict === "검토필요" ? "추가 검토 후 면접 진행 권장" : "현 포지션 부적합 판단"}
        </p>
      </div>
    </div>
  </div>

  <!-- Strengths / Weaknesses -->
  <div class="section grid2">
    <div>
      <h2>강점</h2>
      ${a.strengths?.map(s => `<div style="display:flex;gap:8px;margin-bottom:8px;font-size:13px;color:#374151"><span style="color:#10B981;font-weight:700">✓</span>${s}</div>`).join("") || ""}
    </div>
    <div>
      <h2>약점 / 우려사항</h2>
      ${a.weaknesses?.map(w => `<div style="display:flex;gap:8px;margin-bottom:8px;font-size:13px;color:#374151"><span style="color:#F59E0B;font-weight:700">△</span>${w}</div>`).join("") || ""}
    </div>
  </div>

  <!-- Keywords -->
  <div class="section">
    <h2>역량 키워드 분석</h2>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${a.keywords?.map(kw => {
        const colors = { positive: { bg:"#d1fae5", border:"#6ee7b7", text:"#065f46" }, negative: { bg:"#fee2e2", border:"#fca5a5", text:"#7f1d1d" }, neutral: { bg:"#dbeafe", border:"#93c5fd", text:"#1e3a8a" } };
        const c = colors[kw.type] || colors.neutral;
        return `<span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;background:${c.bg};border:1px solid ${c.border};color:${c.text}">${kw.word}</span>`;
      }).join("") || ""}
    </div>
    <div style="margin-top:10px;display:flex;gap:16px;font-size:11px;color:#9ca3af">
      <span>🟢 JD 매칭 키워드</span><span>🔵 관련 역량</span><span>🔴 부족/불일치</span>
    </div>
  </div>

  <!-- Interview Questions -->
  <div class="section">
    <h2>AI 추천 면접 질문 (10개)</h2>
    ${(() => {
      const iq = a.interviewQuestions;
      if (!iq) return "";
      if (Array.isArray(iq)) {
        return iq.map((q, i) => `<div style="display:flex;gap:12px;padding:12px 16px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;margin-bottom:9px"><span style="min-width:24px;height:24px;border-radius:6px;background:#eff6ff;color:#3B82F6;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">Q${i+1}</span><span style="font-size:13px;color:#374151;line-height:1.6;padding-top:3px">${q}</span></div>`).join("");
      }
      const sections = [["🧡 인성/컬쳐핏", iq.culture||[], "#F59E0B"], ["💼 직무 역량", iq.skill||[], "#3B82F6"], ["🚀 미래/방향성", iq.future||[], "#8B5CF6"]];
      return sections.map(([label, qs, color]) => `
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:8px;padding:2px 8px;background:${color}18;border-radius:5px;display:inline-block">${label}</div>
          ${qs.map(q => `<div style="display:flex;gap:12px;padding:10px 14px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;margin-bottom:7px"><span style="min-width:20px;height:20px;border-radius:5px;background:${color}18;color:${color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">Q</span><span style="font-size:13px;color:#374151;line-height:1.6">${q}</span></div>`).join("")}
        </div>`).join("");
    })()}
  </div>

  <!-- Team Checklist -->
  <div class="section">
    <h2>팀 검토 체크리스트</h2>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px">
      ${["이력서 내용 확인 완료", "포지션 JD 부합 여부 검토", "면접 질문 검토 및 추가 확인사항 정리", "1차 면접 일정 조율", "처우 조건 사전 확인", "최종 합격/불합격 결정"].map(item => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">
          <div style="width:18px;height:18px;border-radius:4px;border:1.5px solid #d1d5db;flex-shrink:0"></div>
          <span style="font-size:13px;color:#374151">${item}</span>
        </div>`).join("")}
    </div>
  </div>

  <!-- Comments area -->
  <div class="section">
    <h2>면접관 코멘트</h2>
    <div style="min-height:120px;border:1.5px dashed #d1d5db;border-radius:8px;padding:14px">
      <span style="font-size:12px;color:#9ca3af">면접 후 코멘트를 여기에 기록하세요...</span>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:#9ca3af">Generated by HireL · ${new Date().toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric" })}</span>
    <span style="font-size:11px;color:#9ca3af">🔒 내부 열람용</span>
  </div>

  <script>window.onload=()=>window.print();</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Ring({ score, size = 80, stroke = 7, color = C.accent, label }) {
  const r = (size - stroke * 2) / 2, ci = 2 * Math.PI * r, d = (score / 100) * ci;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${d} ${ci}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 5px ${color})` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size * .22, fontWeight: 700, color: C.text, fontFamily: "'DM Mono',monospace" }}>{score}</span>
        </div>
      </div>
      {label && <span style={{ fontSize: 10, color: C.sub, textAlign: "center", lineHeight: 1.3, maxWidth: size + 14 }}>{label}</span>}
    </div>
  );
}
function Bar({ label, score }) {
  const c = sc(score);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: C.sub }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: "'DM Mono',monospace" }}>{score}점</span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: c, borderRadius: 3, transition: "width 1.2s ease", boxShadow: `0 0 7px ${c}80` }} />
      </div>
    </div>
  );
}
function Tag({ text, type = "neutral" }) {
  const m = { positive: { bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.3)", text: C.green }, negative: { bg: "rgba(239,68,68,.1)", border: "rgba(239,68,68,.25)", text: C.red }, neutral: { bg: "rgba(59,130,246,.1)", border: "rgba(59,130,246,.25)", text: C.accent } };
  const c = m[type] || m.neutral;
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, border: `1px solid ${c.border}`, color: c.text, marginRight: 6, marginBottom: 6 }}>{text}</span>;
}
function Spin({ label = "AI 분석 중..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "34px 0" }}>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, animation: "pulse 1.2s ease infinite", animationDelay: `${i * .2}s` }} />)}</div>
      <span style={{ fontSize: 13, color: C.sub }}>{label}</span>
    </div>
  );
}

// ─── File Upload ──────────────────────────────────────────────────────────────
function UploadZone({ onReady }) {
  const [drag, setDrag] = useState(false), [proc, setProc] = useState(false), [files, setFiles] = useState([]);
  const ref = useRef();
  const process = async (raw) => {
    setProc(true); const results = [];
    for (const f of Array.from(raw)) {
      try {
        const t = f.type;
        if (t === "application/pdf") results.push({ kind: "pdf", b64: await fileToBase64(f), name: f.name, size: f.size, type: t });
        else if (t.startsWith("image/")) results.push({ kind: "image", b64: await fileToBase64(f), name: f.name, size: f.size, type: t });
        else if (t.includes("word") || f.name.endsWith(".docx")) results.push({ kind: "text", text: await docxText(f), name: f.name, size: f.size, type: t });
        else results.push({ kind: "text", text: await fileToText(f), name: f.name, size: f.size, type: t });
      } catch (e) { console.error(e); }
    }
    setFiles(results); onReady(results); setProc(false);
  };
  const remove = (i) => { const n = files.filter((_, j) => j !== i); setFiles(n); onReady(n); };
  return (
    <div>
      <div onClick={() => ref.current?.click()} onDrop={e => { e.preventDefault(); setDrag(false); process(e.dataTransfer.files); }} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        style={{ border: `2px dashed ${drag ? C.accent : C.borderL}`, borderRadius: 11, padding: "22px 18px", textAlign: "center", cursor: "pointer", background: drag ? C.glow : "transparent", transition: "all .2s" }}>
        <input ref={ref} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" multiple hidden onChange={e => process(e.target.files)} />
        {proc ? <Spin label="파일 읽는 중..." /> : (<>
          <div style={{ fontSize: 26, marginBottom: 7 }}>☁</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>드래그 또는 클릭</div>
          <div style={{ fontSize: 12, color: C.sub }}>PDF · Word · TXT · 이미지</div>
        </>)}
      </div>
      {files.length > 0 && <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
        {files.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: C.card, borderRadius: 8, padding: "8px 11px", border: `1px solid ${C.green}40` }}>
            <span style={{ fontSize: 16 }}>{fileIcon(f.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{fmtSize(f.size)}</div>
            </div>
            <span style={{ fontSize: 11, color: C.green }}>✓</span>
            <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── Interview Room ───────────────────────────────────────────────────────────
function InterviewRoom({ candidate, position, onBack }) {
  const rc = ROLE_COLORS[position?.colorIdx || 0];
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [liveScore, setLiveScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [scoring, setScoring] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [notes, setNotes] = useState([]);
  const [lastScoredLen, setLastScoredLen] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(null);
  const recogRef = useRef(null);
  const timerRef = useRef(null);
  const txRef = useRef("");
  const scoringRef = useRef(false);
  const lastScoredRef = useRef(0);
  useEffect(() => { txRef.current = transcript; }, [transcript]);
  useEffect(() => { scoringRef.current = scoring; }, [scoring]);

  const doScore = async (tx) => {
    if (!tx || tx.trim().split(" ").length < 15 || scoringRef.current) return;
    if (tx.length - lastScoredRef.current < 80) return; // 80자 이상 새로 쌓였을 때만
    scoringRef.current = true;
    setScoring(true);
    try {
      const r = await scoreInterview(position?.jd || "", candidate.name, tx, candidate.analysis?.interviewQuestions);
      setLiveScore(r);
      setHistory(p => [...p.slice(-19), { score: r.liveScore }]);
      lastScoredRef.current = tx.length;
      setLastScoredLen(tx.length);
    } catch (e) { console.error(e); }
    scoringRef.current = false;
    setScoring(false);
  };

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome 브라우저에서 마이크 권한을 허용해주세요."); return; }
    const r = new SR(); r.lang = "ko-KR"; r.continuous = true; r.interimResults = true;
    let silenceId = null;
    r.onresult = (e) => {
      let fin = "", int = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + " ";
        else int += e.results[i][0].transcript;
      }
      if (fin) {
        setTranscript(p => { const n = p + fin; txRef.current = n; return n; });
        // 침묵 감지 타이머 — 말이 끊기면 4초 후 자동 평가
        clearTimeout(silenceId);
        silenceId = setTimeout(() => { doScore(txRef.current); }, 4000);
      }
      setInterim(int);
    };
    r.onend = () => { if (recogRef.current === r) r.start(); };
    r.start(); recogRef.current = r; setRecording(true);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
  };
  const stop = () => {
    recogRef.current?.stop(); recogRef.current = null;
    clearInterval(timerRef.current);
    setRecording(false); setInterim("");
    // 녹음 종료 시 최종 평가
    if (txRef.current.trim().length > 30) doScore(txRef.current);
  };
  const addNote = () => { if (!noteInput.trim()) return; setNotes(p => [...p, { text: noteInput, t: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) }]); setNoteInput(""); };
  useEffect(() => () => { recogRef.current?.stop(); clearInterval(timerRef.current); }, []);

  const IS = { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const BP = (bg) => ({ background: bg || `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

  // 면접 질문 파싱 (구조화된 형태 or 구버전 배열 모두 지원)
  const iq = candidate.analysis?.interviewQuestions;
  const questions = iq && typeof iq === "object" && !Array.isArray(iq) ? iq : null;
  const legacyQ = Array.isArray(iq) ? iq : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 13px", color: C.sub, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← 나가기</button>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${rc.accent}25`, border: `1px solid ${rc.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: rc.accent }}>{candidate.name[0]}</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{candidate.name}</h2>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 14, background: `${rc.accent}20`, border: `1px solid ${rc.accent}40`, color: rc.accent, fontWeight: 600 }}>{position?.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.sub }}>{recording ? "🔴 녹음 중 — 말이 끊기면 자동 평가" : "대기 중"}</span>
            {scoring && <span style={{ fontSize: 11, color: C.accent, display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, animation: "pulse 1s ease infinite" }} />AI 실시간 평가 중...</span>}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: C.card, border: `1px solid ${recording ? "#ef444460" : C.border}`, borderRadius: 9, padding: "7px 16px", fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: recording ? C.red : C.sub, letterSpacing: 2 }}>{fmtTime(elapsed)}</div>
          {!recording
            ? <button onClick={start} style={{ ...BP(`linear-gradient(135deg,${C.green},${C.teal})`), display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff", display: "inline-block" }} />녹음 시작</button>
            : <button onClick={stop} style={{ ...BP(`linear-gradient(135deg,${C.red},#b91c1c)`), display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: "#fff", display: "inline-block" }} />녹음 중지</button>}
          {candidate.analysis && (
            <button onClick={() => exportCandidatePDF(candidate, position)} style={{ ...BP(`linear-gradient(135deg,#374151,#1f2937)`), display: "flex", alignItems: "center", gap: 7 }}>
              📄 PDF 저장</button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 370px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 구조화된 10개 질문 */}
          {(questions || legacyQ) && (
            <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 12 }}>💬 면접 질문 {questions ? "10개" : ""}</div>
              {questions ? (<>
                {[["🧡 인성/컬쳐핏", questions.culture||[], C.amber], ["💼 직무 역량", questions.skill||[], C.accent], ["🚀 미래/방향성", questions.future||[], C.purple]].map(([label, qs, color]) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 7, padding: "3px 8px", background: `${color}15`, borderRadius: 6, display: "inline-block" }}>{label}</div>
                    {qs.map((q, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, padding: "9px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 6 }}>
                        <span style={{ minWidth: 20, height: 20, borderRadius: 5, background: `${color}20`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>Q</span>
                        <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{q}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>) : legacyQ.map((q, i) => (
                <div key={i} style={{ display: "flex", gap: 9, padding: "9px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 7 }}>
                  <span style={{ minWidth: 20, height: 20, borderRadius: 5, background: C.glow, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>Q{i + 1}</span>
                  <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{q}</span>
                </div>
              ))}
              {liveScore?.nextQuestion && <div style={{ marginTop: 9, padding: "9px 12px", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.3)", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: C.purple, fontWeight: 600 }}>✨ AI 추천 다음 질문</span>
                <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>{liveScore.nextQuestion}</div>
              </div>}
            </div>
          )}
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${recording ? "rgba(59,130,246,.35)" : C.border}`, padding: 18, flex: 1, transition: "border-color .3s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>🎙 실시간 녹취록</span>
                {recording && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, animation: "pulse 1.2s ease infinite" }} />}
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => doScore(transcript)} disabled={scoring || !transcript} style={{ ...BP(), padding: "5px 12px", fontSize: 12, opacity: (!transcript || scoring) ? .4 : 1 }}>{scoring ? "평가 중..." : "⚡ 지금 평가"}</button>
                <button onClick={() => { setTranscript(""); setInterim(""); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 9px", color: C.sub, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>초기화</button>
              </div>
            </div>
            <div style={{ minHeight: 180, maxHeight: 280, overflowY: "auto" }}>
              {transcript ? <p style={{ fontSize: 14, color: C.text, lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>{transcript}<span style={{ color: C.muted, fontStyle: "italic" }}>{interim}</span></p>
                : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, gap: 9 }}>
                  <div style={{ fontSize: 30, opacity: .25 }}>🎤</div>
                  <span style={{ fontSize: 13, color: C.muted }}>{recording ? "말씀하시면 자동으로 텍스트가 기록됩니다" : "녹음을 시작하세요"}</span>
                </div>}
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 10 }}>📝 면접관 메모</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
              <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} placeholder="메모 후 Enter..." style={{ ...IS, flex: 1 }} />
              <button onClick={addNote} style={{ ...BP(), padding: "9px 14px" }}>추가</button>
            </div>
            {notes.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "8px 11px", background: C.surface, borderRadius: 7, border: `1px solid ${C.border}`, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace" }}>{n.t}</span>
                <span style={{ fontSize: 12, color: C.sub, flex: 1 }}>{n.text}</span>
                <button onClick={() => setNotes(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${liveScore ? `${sc(liveScore.liveScore)}50` : C.border}`, padding: 20, transition: "border-color .5s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>⚡ 실시간 AI 평점</span>
              {scoring && <span style={{ fontSize: 11, color: C.accent }}>평가 중...</span>}
            </div>
            {liveScore ? (<>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Ring score={liveScore.liveScore} size={96} stroke={9} color={sc(liveScore.liveScore)} /></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                <Ring score={liveScore.dimensions.communication} size={54} stroke={5} color={C.accent} label="소통" />
                <Ring score={liveScore.dimensions.expertise} size={54} stroke={5} color={C.teal} label="전문성" />
                <Ring score={liveScore.dimensions.motivation} size={54} stroke={5} color={C.green} label="의지" />
                <Ring score={liveScore.dimensions.problemSolving} size={54} stroke={5} color={C.amber} label="문제해결" />
                <Ring score={liveScore.dimensions.culture} size={54} stroke={5} color={C.purple} label="문화핏" />
              </div>
              {liveScore.oneliner && <div style={{ padding: "9px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 12, fontStyle: "italic" }}>"{liveScore.oneliner}"</div>}
              {liveScore.highlights?.length > 0 && <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 7 }}>✓ 인상적인 포인트</div>
                {liveScore.highlights.map((h, i) => <div key={i} style={{ fontSize: 12, color: C.sub, padding: "4px 9px", background: "rgba(16,185,129,.06)", borderRadius: 6, border: "1px solid rgba(16,185,129,.2)", marginBottom: 4 }}>{h}</div>)}
              </div>}
              {liveScore.concerns?.length > 0 && <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.amber, marginBottom: 7 }}>△ 확인 필요</div>
                {liveScore.concerns.map((h, i) => <div key={i} style={{ fontSize: 12, color: C.sub, padding: "4px 9px", background: "rgba(245,158,11,.06)", borderRadius: 6, border: "1px solid rgba(245,158,11,.2)", marginBottom: 4 }}>{h}</div>)}
              </div>}
            </>) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 0" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", border: `2px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, opacity: .3 }}>⚡</div>
                <span style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>녹음 후 "지금 평가"를 누르거나<br />자동평점을 켜세요</span>
              </div>
            )}
          </div>
          {history.length > 1 && (
            <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 12 }}>📈 점수 변화</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 8, color: C.muted }}>{h.score}</span>
                    <div style={{ width: "100%", background: sc(h.score), borderRadius: "2px 2px 0 0", height: `${h.score * .54}px`, minHeight: 3 }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {candidate.analysis && (
            <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 12 }}>📋 사전 이력서 분석</div>
              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
                <Ring score={candidate.analysis.scores.experienceMatch} size={50} stroke={4} color={C.accent} label="경험" />
                <Ring score={candidate.analysis.scores.cultureFit} size={50} stroke={4} color={C.teal} label="문화" />
                <Ring score={candidate.analysis.scores.skillKeywords} size={50} stroke={4} color={C.green} label="역량" />
                <Ring score={candidate.analysis.scores.stability} size={50} stroke={4} color={C.amber} label="안정성" />
              </div>
              <div style={{ padding: "8px 11px", background: C.surface, borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{candidate.analysis.summary}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Position Modal ───────────────────────────────────────────────────────────
function PositionModal({ onClose, onSave, existing }) {
  const [name, setName] = useState(existing?.name || "");
  const [jd, setJd] = useState(existing?.jd || "");
  const [colorIdx, setColorIdx] = useState(existing?.colorIdx ?? 0);
  const IS = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: 28, width: 520, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{existing ? "포지션 수정" : "새 포지션 추가"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 6 }}>포지션명</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 마케터, 데이터 사이언티스트" style={{ ...IS, marginBottom: 16 }} />
        <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 6 }}>색상 태그</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {ROLE_COLORS.map((rc, i) => (
            <div key={i} onClick={() => setColorIdx(i)} style={{ width: 28, height: 28, borderRadius: "50%", background: rc.accent, cursor: "pointer", border: `3px solid ${colorIdx === i ? "#fff" : "transparent"}`, transition: "all .2s", boxShadow: colorIdx === i ? `0 0 10px ${rc.accent}` : "none" }} />
          ))}
        </div>
        <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 6 }}>채용 공고 (JD)</label>
        <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="직무명, 주요 업무, 자격 요건, 우리 문화..." rows={10} style={{ ...IS, resize: "vertical", marginBottom: 20 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { if (name && jd) onSave({ name, jd, colorIdx }); }} style={{ flex: 1, background: `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 9, color: "#fff", padding: 11, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: (name && jd) ? 1 : .4 }}>저장</button>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.sub, padding: "11px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
        </div>
      </div>
    </div>
  );
}

// ─── Candidate Card ───────────────────────────────────────────────────────────
function CandidateCard({ c, rc, analyzingIds, vStyle, onSelect, onInterview, onReanalyze, onExportPDF, position }) {
  const busy = analyzingIds.has(c.id);
  const a = c.analysis;
  return (
    <div style={{ background: C.card, borderRadius: 15, border: `1px solid ${C.border}`, padding: 20, cursor: "pointer", position: "relative", transition: "all .22s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = rc.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
      onClick={onSelect}>
      <div style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: rc.accent, boxShadow: `0 0 6px ${rc.accent}` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${rc.accent}25`, border: `1px solid ${rc.accent}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: rc.accent }}>{c.name[0]}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
          <div style={{ fontSize: 11, color: C.sub }}>{c.age ? `${c.age}세` : ""}{c.fileNames?.length > 0 && <span style={{ marginLeft: 5 }}>📎{c.fileNames.length}</span>}</div>
        </div>
        {!busy && a && <div style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 16, fontSize: 11, fontWeight: 700, background: vStyle(a.verdict).bg, border: `1px solid ${vStyle(a.verdict).border}`, color: vStyle(a.verdict).color }}>{a.verdict}</div>}
      </div>
      {busy ? <Spin /> : a ? (<>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Ring score={a.totalScore} size={60} stroke={5} color={rc.accent} />
          <div style={{ flex: 1 }}>
            <Bar label="직무 경험" score={a.scores.experienceMatch} />
            <Bar label="문화 적합도" score={a.scores.cultureFit} />
          </div>
        </div>
        <Bar label="역량 키워드" score={a.scores.skillKeywords} />
        <Bar label="안정성" score={a.scores.stability} />
        <div style={{ marginTop: 11, padding: "9px 11px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{a.summary}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 }}>
          <button onClick={e => { e.stopPropagation(); onInterview(); }} style={{ padding: "8px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${C.purple},${C.pink})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🎤 면접 시작</button>
          <button onClick={e => { e.stopPropagation(); onExportPDF(); }} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>📄 PDF 저장</button>
        </div>
      </>) : (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 9 }}>분석 대기 중</div>
          <button onClick={e => { e.stopPropagation(); onReanalyze(); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", color: C.sub, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>분석 시작</button>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const SAMPLE_POSITIONS = [
  { id: "p1", name: "데이터 사이언티스트", colorIdx: 0, jd: "직무명: 데이터 사이언티스트 (큐라엘)\n\n주요 업무:\n- 암환자 임상 데이터 분석 및 바이오마커 연구\n- 머신러닝 모델 개발\n- 제품 효능 데이터 시각화\n\n자격 요건:\n- Python/R 능숙, SQL 필수\n- 의료/헬스케어 데이터 분석 경험 우대\n\n우리 문화:\n근거 중심, 빠른 실험, 자율과 책임" },
  { id: "p2", name: "마케터", colorIdx: 1, jd: "직무명: 디지털 마케터 (큐라엘 브랜드팀)\n\n주요 업무:\n- 큐라엘몰 및 SNS 채널 운영\n- 암환자 대상 콘텐츠 기획\n- GEO/SEO 최적화\n\n자격 요건:\n- SNS 채널 운영 경험 2년 이상\n- 헬스케어 콘텐츠 경험 우대\n\n우리 문화:\n환자 중심, 빠른 실행, 창의적 실험" },
];
const SAMPLE_CANDIDATES = [
  { id: "c1", positionId: "p1", name: "박서준", age: 30, resume: "컴퓨터공학 석사 (KAIST, 2020)\n현) 네이버 헬스케어 데이터팀 4년\nPython, TensorFlow, SQL 고급\n의료 EMR 데이터 분석 프로젝트 3건", files: [], fileNames: [] },
  { id: "c2", positionId: "p2", name: "김민지", age: 29, resume: "경영학 학사 (이화여대, 2018)\n현) 비타민하우스 디지털마케팅팀 3년\n인스타그램/유튜브 채널 팔로워 12만\nGoogle Ads ROAS 350% 달성", files: [], fileNames: [] },
];

export default function HireL() {
  const [view, setView] = useState("dashboard");
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedPositionId, setSelectedPositionId] = useState("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [interviewCandidateId, setInterviewCandidateId] = useState(null);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", age: "", resume: "", positionId: "", inputMode: "file" });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [toast, setToast] = useState(null);

  // 실시간 공유 상태
  const [roomId, setRoomId] = useState(null);
  const [isRoomHost, setIsRoomHost] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | connected | error
  const pollRef = useRef(null);
  const lastPushRef = useRef(0);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // URL에서 roomId 읽기 (팀원)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get("room");
    if (rid) {
      setRoomId(rid);
      setIsRoomHost(false);
      setSyncEnabled(true);
      setSyncStatus("syncing");
      showToast(`🔗 공유 룸 연결 중... 룸코드: ${rid}`);
    } else {
      try {
        const saved = localStorage.getItem("hirel_data");
        if (saved) { const d = JSON.parse(saved); setPositions(d.positions || []); setCandidates(d.candidates || []); }
        else { setPositions(SAMPLE_POSITIONS); setCandidates(SAMPLE_CANDIDATES); }
      } catch (e) { setPositions(SAMPLE_POSITIONS); setCandidates(SAMPLE_CANDIDATES); }
    }
  }, []);

  // 데이터 Firebase에 올리기
  const pushToRoom = async (rid, data) => {
    try {
      // 용량 최소화: files(PDF base64) 제거, resume 500자 제한
      const slim = {
        positions: data.positions.map(p => ({ id: p.id, name: p.name, colorIdx: p.colorIdx, jd: (p.jd||"").slice(0, 300) })),
        candidates: data.candidates.map(c => ({
          id: c.id, positionId: c.positionId, name: c.name, age: c.age,
          fileNames: c.fileNames || [],
          resume: (c.resume||"").slice(0, 300),
          files: [],
          analysis: c.analysis ? {
            totalScore: c.analysis.totalScore,
            scores: c.analysis.scores,
            verdict: c.analysis.verdict,
            summary: c.analysis.summary,
            strengths: c.analysis.strengths,
            weaknesses: c.analysis.weaknesses,
            keywords: (c.analysis.keywords||[]).slice(0, 10),
            interviewQuestions: c.analysis.interviewQuestions,
          } : null,
        })),
        updatedAt: Date.now(),
      };
      const res = await fetch(`/api/sync?roomId=${rid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slim),
      });
      if (res.ok) setSyncStatus("connected");
      else { console.error("sync push failed:", res.status); setSyncStatus("error"); }
    } catch (e) { console.error("push error:", e); setSyncStatus("error"); }
  };

  // Firebase에서 가져오기
  const pullFromRoom = async (rid) => {
    try {
      const res = await fetch(`/api/sync?roomId=${rid}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.positions && data.candidates) {
        setPositions(data.positions);
        setCandidates(data.candidates);
        setSyncStatus("connected");
      }
    } catch (e) { console.error("pull error:", e); }
  };

  // 룸 생성 (호스트)
  const createRoom = async () => {
    const rid = Math.random().toString(36).slice(2, 8).toUpperCase();
    setRoomId(rid);
    setIsRoomHost(true);
    setSyncEnabled(true);
    setSyncStatus("syncing");
    // 현재 데이터 즉시 업로드
    await pushToRoom(rid, { positions, candidates });
    const shareUrl = `${window.location.origin}?room=${rid}`;
    try { await navigator.clipboard.writeText(shareUrl); } catch(e) {}
    showToast(`✓ 공유 시작! 룸코드: ${rid} — 링크 복사됨`);
  };

  // 호스트: 데이터 변경 시 자동 push (1초 디바운스)
  useEffect(() => {
    if (!syncEnabled || !isRoomHost || !roomId) {
      if (!syncEnabled && (positions.length > 0 || candidates.length > 0)) {
        localStorage.setItem("hirel_data", JSON.stringify({ positions, candidates }));
      }
      return;
    }
    localStorage.setItem("hirel_data", JSON.stringify({ positions, candidates }));
    const now = Date.now();
    if (now - lastPushRef.current < 1000) return; // 1초 디바운스
    lastPushRef.current = now;
    pushToRoom(roomId, { positions, candidates });
  }, [positions, candidates, syncEnabled, isRoomHost, roomId]);

  // 팀원: 2초마다 pull
  useEffect(() => {
    if (syncEnabled && !isRoomHost && roomId) {
      pullFromRoom(roomId);
      pollRef.current = setInterval(() => pullFromRoom(roomId), 2000);
      return () => clearInterval(pollRef.current);
    }
  }, [syncEnabled, isRoomHost, roomId]);

  const stopSync = () => {
    setSyncEnabled(false); setRoomId(null); setIsRoomHost(false);
    setSyncStatus("idle"); clearInterval(pollRef.current);
    window.history.replaceState({}, "", window.location.pathname);
    showToast("공유 종료됨");
  };

  const IS = { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const BP = (bg) => ({ background: bg || `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 9, color: "#fff", padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
  const vStyle = (v) => ({ "추천": { color: C.green, bg: "rgba(16,185,129,.1)", border: "rgba(16,185,129,.3)" }, "검토필요": { color: C.amber, bg: "rgba(245,158,11,.1)", border: "rgba(245,158,11,.3)" }, "부적합": { color: C.red, bg: "rgba(239,68,68,.1)", border: "rgba(239,68,68,.3)" } }[v] || { color: C.sub, bg: C.card, border: C.border });

  const doAnalyze = async (c) => {
    const pos = positions.find(p => p.id === c.positionId);
    if (!pos) { showToast("포지션을 찾을 수 없습니다", "error"); return; }
    setAnalyzingIds(p => new Set(p).add(c.id));
    try {
      const r = await analyzeResume(pos.jd, c);
      setCandidates(p => p.map(x => x.id === c.id ? { ...x, analysis: r } : x));
      showToast(`${c.name} 분석 완료 — ${r.totalScore}점 ${r.verdict}`);
    } catch (e) {
      console.error("분석 오류:", e);
      showToast(`분석 실패: API 키를 확인해주세요`, "error");
    }
    setAnalyzingIds(p => { const s = new Set(p); s.delete(c.id); return s; });
  };

  const addCandidate = () => {
    if (!addForm.name || !addForm.positionId) return;
    let resume = addForm.resume;
    const tf = uploadedFiles.filter(f => f.kind === "text");
    if (tf.length) resume = [resume, ...tf.map(f => f.text)].filter(Boolean).join("\n\n");
    const c = { id: `c${Date.now()}`, positionId: addForm.positionId, name: addForm.name, age: parseInt(addForm.age) || null, resume, files: uploadedFiles.filter(f => f.kind === "pdf" || f.kind === "image"), fileNames: uploadedFiles.map(f => f.name) };
    setCandidates(p => [...p, c]);
    setAddForm({ name: "", age: "", resume: "", positionId: "", inputMode: "file" });
    setUploadedFiles([]); setShowAddCandidate(false);
    doAnalyze(c);
    showToast(`${c.name} 후보자 등록 완료 — AI 분석 시작`);
  };

  const addPosition = (data) => {
    if (editingPosition) { setPositions(p => p.map(x => x.id === editingPosition.id ? { ...x, ...data } : x)); }
    else { const np = { id: `p${Date.now()}`, ...data }; setPositions(p => [...p, np]); setSelectedPositionId(np.id); }
    setShowPositionModal(false); setEditingPosition(null);
  };

  const deletePosition = (pid) => {
    if (!confirm("이 포지션과 모든 후보자 데이터를 삭제합니까?")) return;
    setPositions(p => p.filter(x => x.id !== pid));
    setCandidates(p => p.filter(x => x.positionId !== pid));
    if (selectedPositionId === pid) setSelectedPositionId("all");
  };

  // Team share — JSON export/import
  const exportJSON = () => {
    const data = JSON.stringify({ positions, candidates }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `hirel_${new Date().toLocaleDateString("ko-KR").replace(/\./g, "").replace(/ /g, "")}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("JSON 파일 저장 완료 — 팀원에게 공유하세요");
  };

  const importJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const d = JSON.parse(ev.target.result); setPositions(d.positions || []); setCandidates(d.candidates || []); showToast("데이터 불러오기 완료"); }
      catch { showToast("파일 형식이 올바르지 않습니다", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export all candidates in a position as PDF
  const exportAllPDF = (posId) => {
    const pos = positions.find(p => p.id === posId);
    const pCandidates = candidates.filter(c => c.positionId === posId && c.analysis);
    if (!pCandidates.length) { showToast("분석된 후보자가 없습니다", "error"); return; }
    pCandidates.forEach(c => setTimeout(() => exportCandidatePDF(c, pos), 500));
    showToast(`${pCandidates.length}개 PDF 생성 중...`);
  };

  const sel = candidates.find(c => c.id === selectedCandidateId);
  const interviewCandidate = candidates.find(c => c.id === interviewCandidateId);
  const interviewPosition = positions.find(p => p.id === interviewCandidate?.positionId);
  const filteredCandidates = selectedPositionId === "all" ? candidates : candidates.filter(c => c.positionId === selectedPositionId);
  const grouped = positions.map(pos => ({ pos, cands: [...candidates.filter(c => c.positionId === pos.id)].sort((a, b) => (b.analysis?.totalScore || 0) - (a.analysis?.totalScore || 0)) })).filter(g => g.cands.length > 0);

  const importRef = useRef();

  if (view === "interview" && interviewCandidate) {
    return (
      <>
        <Head><title>HireL — 면접 진행 중</title></Head>
        <div style={{ minHeight: "100vh", background: C.bg }}>
          <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 52, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${C.accent},${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>H</div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>HireL</span>
            <span style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />
            <span style={{ fontSize: 12, color: C.muted }}>면접 진행 중 · {interviewPosition?.name}</span>
          </div>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 28px" }}>
            <InterviewRoom candidate={interviewCandidate} position={interviewPosition} onBack={() => { setView("detail"); setSelectedCandidateId(interviewCandidateId); }} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>HireL — AI 기반 채용 분석</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? C.red : C.green, color: "#fff", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.4)", transition: "all .3s" }}>
          {toast.type === "error" ? "❌ " : "✓ "}{toast.msg}
        </div>
      )}

      <input ref={importRef} type="file" accept=".json" hidden onChange={importJSON} />

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", height: 56, gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${C.accent},${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>H</div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>HireL</span>
            <span style={{ fontSize: 10, color: C.muted, background: C.card, border: `1px solid ${C.border}`, padding: "2px 7px", borderRadius: 18 }}>BETA</span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {[["dashboard", "◫ 대시보드"], ["detail", "◉ 상세 분석"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 500, background: view === v ? C.glow : "transparent", color: view === v ? C.accent : C.sub, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Team share buttons */}
            <button onClick={exportJSON} style={{ ...BP("transparent"), border: `1px solid ${C.borderL}`, color: C.sub, boxShadow: "none", padding: "7px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              📤 팀 공유
            </button>
            <button onClick={() => importRef.current?.click()} style={{ ...BP("transparent"), border: `1px solid ${C.borderL}`, color: C.sub, boxShadow: "none", padding: "7px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              📥 불러오기
            </button>
            {/* 실시간 공유 버튼 */}
            {!syncEnabled ? (
              <button onClick={createRoom} style={{ ...BP(`linear-gradient(135deg,${C.green},${C.teal})`), padding: "7px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, boxShadow: `0 0 14px ${C.green}50` }}>
                🔴 실시간 공유 시작
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: syncStatus === "connected" ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)", border: `1px solid ${syncStatus === "connected" ? "rgba(16,185,129,.3)" : "rgba(245,158,11,.3)"}`, borderRadius: 9, padding: "6px 14px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: syncStatus === "connected" ? C.green : C.amber, animation: "pulse 1.5s ease infinite" }} />
                <span style={{ fontSize: 12, color: syncStatus === "connected" ? C.green : C.amber, fontWeight: 600 }}>
                  {isRoomHost ? `룸: ${roomId}` : syncStatus === "connected" ? "동기화 완료" : "동기화 중..."}
                </span>
                {isRoomHost && (
                  <button onClick={async () => {
                    await pushToRoom(roomId, { positions, candidates });
                    const u = `${window.location.origin}?room=${roomId}`;
                    await navigator.clipboard.writeText(u).catch(()=>{});
                    showToast("링크 복사됨!");
                  }} style={{ background: "none", border: "none", color: C.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>📋 링크 복사</button>
                )}
                <button onClick={stopSync} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            )}
            <button onClick={() => { if(confirm("저장된 데이터를 전부 초기화할까요?")) { localStorage.removeItem("hirel_data"); window.location.reload(); } }} style={{ ...BP("transparent"), border: `1px solid ${C.red}40`, color: C.red, boxShadow: "none", padding: "7px 14px", fontSize: 12 }}>
              🗑 초기화
            </button>
            <button onClick={() => setShowAddCandidate(true)} style={{ ...BP(), padding: "8px 16px", fontSize: 13 }}>+ 후보자</button>
            <button onClick={() => { setEditingPosition(null); setShowPositionModal(true); }} style={{ ...BP("transparent"), border: `1px solid ${C.borderL}`, color: C.accent, boxShadow: "none", padding: "8px 16px", fontSize: 13 }}>+ 포지션</button>
          </div>
        </div>
      </div>

      {/* Position Tab Bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", gap: 2, overflowX: "auto" }}>
          <button onClick={() => setSelectedPositionId("all")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${selectedPositionId === "all" ? C.accent : "transparent"}`, color: selectedPositionId === "all" ? C.accent : C.sub, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", transition: "all .2s" }}>
            전체
            <span style={{ fontSize: 11, background: selectedPositionId === "all" ? C.glow : C.card, border: `1px solid ${selectedPositionId === "all" ? C.accent : C.border}`, color: selectedPositionId === "all" ? C.accent : C.muted, borderRadius: 12, padding: "1px 7px", fontFamily: "'DM Mono',monospace" }}>{candidates.length}</span>
          </button>
          {positions.map(pos => {
            const rc = ROLE_COLORS[pos.colorIdx || 0];
            const cnt = candidates.filter(c => c.positionId === pos.id).length;
            const active = selectedPositionId === pos.id;
            return (
              <div key={pos.id} style={{ display: "flex", alignItems: "center", borderBottom: `2px solid ${active ? rc.accent : "transparent"}`, transition: "all .2s" }}>
                <button onClick={() => setSelectedPositionId(pos.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", color: active ? rc.accent : C.sub, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: rc.accent }} />
                  {pos.name}
                  <span style={{ fontSize: 11, background: active ? rc.glow : C.card, border: `1px solid ${active ? rc.accent : C.border}`, color: active ? rc.accent : C.muted, borderRadius: 12, padding: "1px 7px", fontFamily: "'DM Mono',monospace" }}>{cnt}</span>
                </button>
                <button onClick={() => exportAllPDF(pos.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: "0 4px", opacity: .7 }} title="PDF 일괄 출력">📄</button>
                <button onClick={() => { setEditingPosition(pos); setShowPositionModal(true); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: "0 4px", opacity: .7 }} title="수정">✎</button>
                <button onClick={() => deletePosition(pos.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: "0 10px 0 2px", opacity: .7 }} title="삭제">✕</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 28px" }}>

        {/* Dashboard */}
        {view === "dashboard" && (
          <div>
            {candidates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 14, opacity: .3 }}>◎</div>
                <div style={{ fontSize: 15, color: C.sub, marginBottom: 18 }}>포지션과 후보자를 추가하세요</div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button onClick={() => { setPositions(SAMPLE_POSITIONS); setCandidates(SAMPLE_CANDIDATES); SAMPLE_CANDIDATES.forEach((c, i) => setTimeout(() => doAnalyze(c), i * 900)); }} style={BP()}>샘플 데이터 불러오기</button>
                  <button onClick={() => setShowPositionModal(true)} style={{ ...BP("transparent"), border: `1px solid ${C.borderL}`, color: C.accent, boxShadow: "none" }}>포지션 추가</button>
                </div>
              </div>
            ) : selectedPositionId === "all" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {grouped.map(({ pos, cands }) => {
                  const rc = ROLE_COLORS[pos.colorIdx || 0];
                  return (
                    <div key={pos.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: rc.accent }} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{pos.name}</span>
                        <span style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{cands.length}명</span>
                        <div style={{ flex: 1, height: 1, background: C.border, marginLeft: 4 }} />
                        <button onClick={() => exportAllPDF(pos.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", color: C.sub, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>📄 전체 PDF</button>
                        <button onClick={() => setSelectedPositionId(pos.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", color: C.sub, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>이 포지션만 보기</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                        {cands.map(c => (<CandidateCard key={c.id} c={c} rc={rc} position={pos} analyzingIds={analyzingIds} vStyle={vStyle} onSelect={() => { setSelectedCandidateId(c.id); setActiveTab("overview"); setView("detail"); }} onInterview={() => { setInterviewCandidateId(c.id); setView("interview"); }} onReanalyze={() => doAnalyze(c)} onExportPDF={() => exportCandidatePDF(c, pos)} />))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                {[...filteredCandidates].sort((a, b) => (b.analysis?.totalScore || 0) - (a.analysis?.totalScore || 0)).map(c => {
                  const pos = positions.find(p => p.id === c.positionId);
                  const rc = ROLE_COLORS[pos?.colorIdx || 0];
                  return (<CandidateCard key={c.id} c={c} rc={rc} position={pos} analyzingIds={analyzingIds} vStyle={vStyle} onSelect={() => { setSelectedCandidateId(c.id); setActiveTab("overview"); setView("detail"); }} onInterview={() => { setInterviewCandidateId(c.id); setView("interview"); }} onReanalyze={() => doAnalyze(c)} onExportPDF={() => exportCandidatePDF(c, pos)} />);
                })}
              </div>
            )}
          </div>
        )}

        {/* Detail */}
        {view === "detail" && (
          <div>
            {!sel ? (
              <div style={{ textAlign: "center", padding: "70px 0" }}>
                <div style={{ fontSize: 15, color: C.sub, marginBottom: 14 }}>대시보드에서 후보자를 선택하세요</div>
                <button onClick={() => setView("dashboard")} style={BP()}>대시보드로</button>
              </div>
            ) : (() => {
              const c = sel, a = c.analysis, busy = analyzingIds.has(c.id);
              const pos = positions.find(p => p.id === c.positionId);
              const rc = ROLE_COLORS[pos?.colorIdx || 0];
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                    <button onClick={() => setView("dashboard")} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 13px", color: C.sub, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← 목록</button>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: `${rc.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 800, color: rc.accent }}>{c.name[0]}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{c.name}</h2>
                        <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 14, background: `${rc.accent}20`, border: `1px solid ${rc.accent}40`, color: rc.accent, fontWeight: 600 }}>{pos?.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.sub }}>{c.age ? `${c.age}세` : ""}{c.fileNames?.length > 0 && <span style={{ marginLeft: 8 }}>📎{c.fileNames.join(", ")}</span>}</div>
                    </div>
                    {a && !busy && (
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: sc(a.totalScore), fontFamily: "'DM Mono',monospace" }}>{a.totalScore}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>종합 점수</div>
                        </div>
                        <div style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: vStyle(a.verdict).bg, border: `1px solid ${vStyle(a.verdict).border}`, color: vStyle(a.verdict).color }}>{a.verdict}</div>
                        <button onClick={() => exportCandidatePDF(c, pos)} style={{ ...BP(`linear-gradient(135deg,#374151,#1f2937)`), padding: "8px 14px", fontSize: 13 }}>📄 PDF 저장</button>
                        <button onClick={() => { setInterviewCandidateId(c.id); setView("interview"); }} style={{ ...BP(`linear-gradient(135deg,${C.purple},${C.pink})`), padding: "8px 14px", fontSize: 13 }}>🎤 면접 시작</button>
                        <button onClick={() => doAnalyze(c)} style={{ ...BP(), padding: "8px 14px", fontSize: 13 }}>재분석</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 3, marginBottom: 20, background: C.card, padding: 3, borderRadius: 10, width: "fit-content", border: `1px solid ${C.border}` }}>
                    {[["overview", "📊 종합"], ["keywords", "🏷 키워드"], ["interview", "💬 면접 질문"], ["resume", "📄 이력서"]].map(([tab, l]) => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 500, background: activeTab === tab ? C.accent : "transparent", color: activeTab === tab ? "#fff" : C.sub, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>{l}</button>
                    ))}
                  </div>
                  {busy ? <Spin label="AI가 분석하고 있습니다..." /> : !a ? <div style={{ textAlign: "center", padding: "50px 0" }}><button onClick={() => doAnalyze(c)} style={BP()}>AI 분석 시작</button></div> : (<>
                    {activeTab === "overview" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 22 }}>
                          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: C.sub }}>SCORE BREAKDOWN</h3>
                          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 20 }}>
                            <Ring score={a.scores.experienceMatch} label="직무 경험" color={rc.accent} />
                            <Ring score={a.scores.cultureFit} label="문화 적합도" color={C.teal} />
                            <Ring score={a.scores.skillKeywords} label="역량 키워드" color={C.green} />
                            <Ring score={a.scores.stability} label="안정성" color={C.amber} />
                          </div>
                          <div style={{ height: 1, background: C.border, margin: "0 0 18px" }} />
                          <Bar label="직무 경험 매칭" score={a.scores.experienceMatch} />
                          <Bar label="가치관/문화 적합도" score={a.scores.cultureFit} />
                          <Bar label="역량 키워드 분석" score={a.scores.skillKeywords} />
                          <Bar label="이직 패턴/안정성" score={a.scores.stability} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 18 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>✦ AI 요약</h3>
                            <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, margin: 0 }}>{a.summary}</p>
                          </div>
                          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 16 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>강점</h3>
                            {a.strengths?.map((s, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: C.green }}>✓</span><span style={{ fontSize: 13, color: C.sub }}>{s}</span></div>)}
                          </div>
                          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 16 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>약점 / 우려사항</h3>
                            {a.weaknesses?.map((w, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: C.amber }}>△</span><span style={{ fontSize: 13, color: C.sub }}>{w}</span></div>)}
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === "keywords" && (
                      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 24 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>역량 키워드 분석</h3>
                        <p style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>JD 매칭 여부에 따라 색상 구분</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{a.keywords?.map((kw, i) => <Tag key={i} text={kw.word} type={kw.type} />)}</div>
                      </div>
                    )}
                    {activeTab === "interview" && (
                      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                          <div><h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>AI 추천 면접 질문 10개</h3><p style={{ fontSize: 12, color: C.sub, margin: 0 }}>큐라엘 컬쳐핏 기반 맞춤 생성</p></div>
                          <button onClick={() => { setInterviewCandidateId(c.id); setView("interview"); }} style={{ ...BP(`linear-gradient(135deg,${C.purple},${C.pink})`), padding: "8px 16px", fontSize: 13 }}>🎤 면접 시작</button>
                        </div>
                        {(() => {
                          const iq = a.interviewQuestions;
                          if (iq && typeof iq === "object" && !Array.isArray(iq)) {
                            return [["🧡 인성/컬쳐핏", iq.culture||[], C.amber], ["💼 직무 역량", iq.skill||[], C.accent], ["🚀 미래/방향성", iq.future||[], C.purple]].map(([label, qs, color]) => (
                              <div key={label} style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8, padding: "3px 9px", background: `${color}15`, borderRadius: 6, display: "inline-block" }}>{label}</div>
                                {qs.map((q, i) => (
                                  <div key={i} style={{ display: "flex", gap: 12, padding: "11px 14px", borderRadius: 9, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 7 }}>
                                    <span style={{ minWidth: 22, height: 22, borderRadius: 5, background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>Q</span>
                                    <span style={{ fontSize: 13, lineHeight: 1.6, paddingTop: 2 }}>{q}</span>
                                  </div>
                                ))}
                              </div>
                            ));
                          }
                          return Array.isArray(iq) ? iq.map((q, i) => (
                            <div key={i} style={{ display: "flex", gap: 12, padding: "13px 16px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 9 }}>
                              <span style={{ minWidth: 24, height: 24, borderRadius: 6, background: C.glow, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>Q{i + 1}</span>
                              <span style={{ fontSize: 14, lineHeight: 1.6, paddingTop: 2 }}>{q}</span>
                            </div>
                          )) : null;
                        })()}
                      </div>
                    )}
                    {activeTab === "resume" && (
                      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, padding: 24 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>제출된 이력서</h3>
                        {c.fileNames?.length > 0 && <div style={{ marginBottom: 14, display: "flex", gap: 7, flexWrap: "wrap" }}>
                          {c.fileNames.map((fn, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, background: C.surface, borderRadius: 7, padding: "6px 11px", border: `1px solid ${C.border}` }}>
                              <span>{fileIcon(c.files?.[i]?.type || "")}</span>
                              <span style={{ fontSize: 12, color: C.sub }}>{fn}</span>
                              <span style={{ fontSize: 10, color: C.green }}>✓ AI 분석됨</span>
                            </div>
                          ))}
                        </div>}
                        {c.resume ? <pre style={{ fontSize: 13, color: C.sub, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{c.resume}</pre>
                          : <div style={{ color: C.muted, fontSize: 13, padding: "16px 0" }}>📄 파일 업로드로 분석됨</div>}
                      </div>
                    )}
                  </>)}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Add Candidate Modal */}
      {showAddCandidate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: 28, width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>후보자 등록</h3>
              <button onClick={() => setShowAddCandidate(false)} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            {/* 포지션 선택 + 인라인 추가 */}
            <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 8 }}>포지션 선택 *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {positions.map(pos => {
                const rc = ROLE_COLORS[pos.colorIdx || 0];
                const s = addForm.positionId === pos.id;
                return (<button key={pos.id} onClick={() => setAddForm(p => ({ ...p, positionId: pos.id, showNewPos: false }))} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 9, border: `1px solid ${s ? rc.accent : C.border}`, background: s ? rc.glow : C.surface, color: s ? rc.accent : C.sub, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500, transition: "all .15s" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: rc.accent }} />{pos.name}
                </button>);
              })}
              {/* 새 포지션 인라인 추가 버튼 */}
              <button onClick={() => setAddForm(p => ({ ...p, showNewPos: !p.showNewPos, positionId: "" }))}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: `1px dashed ${addForm.showNewPos ? C.accent : C.borderL}`, background: addForm.showNewPos ? C.glow : "transparent", color: addForm.showNewPos ? C.accent : C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
                + 새 포지션
              </button>
            </div>

            {/* 새 포지션 인라인 폼 */}
            {addForm.showNewPos && (
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.accent}40`, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 12 }}>✦ 새 포지션 만들기</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 10 }}>
                  <input value={addForm.newPosName || ""} onChange={e => setAddForm(p => ({ ...p, newPosName: e.target.value }))} placeholder="포지션명 (예: 마케터)" style={{ ...IS }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    {ROLE_COLORS.map((rc, i) => (
                      <div key={i} onClick={() => setAddForm(p => ({ ...p, newPosColorIdx: i }))} style={{ width: 22, height: 22, borderRadius: "50%", background: rc.accent, cursor: "pointer", border: `2px solid ${(addForm.newPosColorIdx ?? 0) === i ? "#fff" : "transparent"}`, flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
                <textarea value={addForm.newPosJd || ""} onChange={e => setAddForm(p => ({ ...p, newPosJd: e.target.value }))} placeholder="채용 공고 (JD) 입력..." rows={5} style={{ ...IS, resize: "vertical", marginBottom: 10 }} />
                <button onClick={() => {
                  if (!addForm.newPosName || !addForm.newPosJd) return;
                  const np = { id: `p${Date.now()}`, name: addForm.newPosName, jd: addForm.newPosJd, colorIdx: addForm.newPosColorIdx ?? 0 };
                  setPositions(p => [...p, np]);
                  setAddForm(p => ({ ...p, positionId: np.id, showNewPos: false, newPosName: "", newPosJd: "", newPosColorIdx: 0 }));
                  showToast(`포지션 "${np.name}" 추가됨`);
                }} style={{ ...BP(), width: "100%", fontSize: 13, padding: "9px", opacity: (addForm.newPosName && addForm.newPosJd) ? 1 : .4 }}>
                  포지션 저장 후 선택
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 16 }}>
              <div><label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 5 }}>이름 *</label><input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="홍길동" style={IS} /></div>
              <div><label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 5 }}>나이</label><input value={addForm.age} onChange={e => setAddForm(p => ({ ...p, age: e.target.value }))} placeholder="30" type="number" style={IS} /></div>
            </div>
            <div style={{ display: "flex", background: C.surface, borderRadius: 8, padding: 3, border: `1px solid ${C.border}`, marginBottom: 13 }}>
              {[["file", "📎 파일 업로드"], ["text", "✏️ 텍스트 입력"]].map(([m, l]) => (
                <button key={m} onClick={() => setAddForm(p => ({ ...p, inputMode: m }))} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, background: addForm.inputMode === m ? C.accent : "transparent", color: addForm.inputMode === m ? "#fff" : C.sub, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>{l}</button>
              ))}
            </div>
            {addForm.inputMode === "file" && <UploadZone onReady={setUploadedFiles} />}
            {addForm.inputMode === "text" && <textarea value={addForm.resume} onChange={e => setAddForm(p => ({ ...p, resume: e.target.value }))} placeholder="이력서 내용 붙여넣기..." rows={7} style={{ ...IS, resize: "vertical" }} />}
            <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
              <button onClick={addCandidate} disabled={!addForm.name || !addForm.positionId || (addForm.inputMode === "file" && !uploadedFiles.length) || (addForm.inputMode === "text" && !addForm.resume)}
                style={{ ...BP(), flex: 1, opacity: (!addForm.name || !addForm.positionId) ? .4 : 1 }}>✦ AI 분석 시작</button>
              <button onClick={() => setShowAddCandidate(false)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.sub, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {showPositionModal && <PositionModal existing={editingPosition} onClose={() => { setShowPositionModal(false); setEditingPosition(null); }} onSave={addPosition} />}
    </>
  );
}
