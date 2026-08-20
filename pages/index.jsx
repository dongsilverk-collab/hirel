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
  bg:"#F7F8FA", surface:"#F9FAFB", card:"#FFFFFF",
  border:"#E5E7EB", borderL:"#D1D5DB",
  accent:"#2563EB", glow:"rgba(37,99,235,0.08)",
  teal:"#0284C7", green:"#059669", amber:"#D97706", red:"#DC2626",
  purple:"#7C3AED", pink:"#DB2777",
  text:"#111827", sub:"#6B7280", muted:"#9CA3AF",
};
const ROLE_COLORS = [
  { accent:"#2563EB", glow:"rgba(37,99,235,.10)" },
  { accent:"#059669", glow:"rgba(5,150,105,.10)" },
  { accent:"#7C3AED", glow:"rgba(124,58,237,.10)" },
  { accent:"#D97706", glow:"rgba(217,119,6,.10)" },
  { accent:"#DB2777", glow:"rgba(219,39,119,.10)" },
  { accent:"#0284C7", glow:"rgba(2,132,199,.10)" },
];

// ─── 지원 채널 ────────────────────────────────────────────────────────────────
const CHANNELS = ["사람인", "잡코리아", "그룹바이", "원티드", "리퍼럴", "직접지원", "기타"];
const CHANNEL_COLORS = { 사람인: "#2563EB", 잡코리아: "#4F46E5", 그룹바이: "#059669", 원티드: "#0284C7", 리퍼럴: "#DB2777", 직접지원: "#7C3AED", 기타: "#6B7280" };
function ChannelBadge({ channel, small }) {
  const ch = CHANNELS.includes(channel) ? channel : "기타";
  const col = CHANNEL_COLORS[ch];
  return <span style={{ display: "inline-block", fontSize: small ? 9 : 10, fontWeight: 700, color: col, background: `${col}18`, border: `1px solid ${col}40`, padding: small ? "1px 6px" : "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{ch}</span>;
}

// ─── 모바일 감지 (768px 미만 → 2단 그리드를 1단으로) ──────────────────────────
function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return m;
}

// ─── 파이프라인 단계 (순서 고정, "탈락"은 맨 끝 별도 컬럼) ─────────────────────
const STAGES = ["서류검토", "포트폴리오확인", "면접제의", "면접", "과제", "처우협의", "합격", "탈락"];
const STAGE_COLORS = { 서류검토: "#6B7280", 포트폴리오확인: "#7C3AED", 면접제의: "#0284C7", 면접: "#2563EB", 과제: "#D97706", 처우협의: "#DB2777", 합격: "#059669", 탈락: "#64748B" };

// ─── 큐라엘 v2 평가축 (마케터 전용, 각 0~5) ────────────────────────────────────
const V2_AXES = [
  ["content", "소재·콘텐츠 직접 제작력", 3],
  ["perfLoop", "소재 성과 개선 감각", 2.5],
  ["healthFood", "식품·건기식·심의 경험", 2],
  ["multiChannel", "신규 채널 개척", 1.5],
  ["croData", "상세페이지 CVR·데이터", 1.5],
  ["tenure", "근속 안정성", 2],
];
// (content*3+perfLoop*2.5+healthFood*2+multiChannel*1.5+croData*1.5+tenure*2)/62.5*100, 반올림 1자리
function v2WeightedTotal(v2) {
  if (!v2) return null;
  const sum = V2_AXES.reduce((acc, [key, , w]) => acc + (Number(v2[key]) || 0) * w, 0);
  return Math.round((sum / 62.5) * 100 * 10) / 10;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function fileToBase64(f){return new Promise((r,j)=>{const x=new FileReader();x.onload=()=>r(x.result.split(",")[1]);x.onerror=j;x.readAsDataURL(f)});}
function fileToText(f){return new Promise((r,j)=>{const x=new FileReader();x.onload=()=>r(x.result);x.onerror=j;x.readAsText(f,"UTF-8")});}
async function docxText(f){if(!mammoth)return"";const ab=await f.arrayBuffer();return(await mammoth.extractRawText({arrayBuffer:ab})).value;}
// ─── PDF text extraction (pdf.js, browser-only, CDN) — base64 대신 텍스트만 전송해 413 방지 ───
function loadPdfJs(){
  if(typeof window==="undefined")return Promise.resolve(null);
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(window.__pdfjsLoading)return window.__pdfjsLoading;
  window.__pdfjsLoading=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(window.pdfjsLib);};
    s.onerror=()=>reject(new Error("pdf.js 로드 실패"));
    document.head.appendChild(s);
  });
  return window.__pdfjsLoading;
}
async function pdfText(f){
  const lib=await loadPdfJs();
  if(!lib)return"";
  const ab=await f.arrayBuffer();
  const pdf=await lib.getDocument({data:ab}).promise;
  let out="";
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const tc=await page.getTextContent();
    out+=tc.items.map(it=>it.str).join(" ")+"\n";
  }
  return out.trim();
}
function fileIcon(t=""){return t.includes("pdf")?"📄":t.includes("word")||t.includes("docx")?"📝":t.startsWith("image")?"🖼":"📃";}
function fmtSize(b){return b<1024?b+" B":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";}
function fmtTime(s){return`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
const sc=(s)=>s>=75?C.green:s>=50?C.accent:s>=30?C.amber:C.red;
const scHex=(s)=>s>=75?"#059669":s>=50?"#2563EB":s>=30?"#D97706":"#DC2626";

// ─── AI call (via /api/chat proxy) ───────────────────────────────────────────
async function callAI(body) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 9000, ...body }),
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

async function analyzeResume(jd, candidate, positionName) {
  const isMarketer = (positionName || "").includes("마케터");
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

【점수 출력 규칙 — 반드시 준수】
- scores 객체의 키는 반드시 정확히 이 6개: experienceMatch / cultureFit / skillKeywords / stability / portfolioMatch / growthPotential
- 6개 모두 실제 평가 숫자(0~100)로 채울 것 (null, undefined, 빈값 절대 금지)
- totalScore는 6개 점수의 가중 평균으로 계산할 것
- portfolioMatch: 건기식/헬스케어 특화 디자인 결과물(패키지·라벨·상세페이지) 실무 경험 점수
- growthPotential: 1인 리드 포지션 적합성, 자기주도 학습·확장 역량 점수
${isMarketer ? `
【큐라엘 마케터 v2 평가축 — 반드시 포함】
이 포지션은 마케터이므로 scores와는 별도로 "v2Scores" 객체를 응답 JSON에 반드시 추가하세요. 6개 축 모두 0~5 사이 숫자로 채울 것:
- content: 소재·콘텐츠 직접 제작력
- perfLoop: 메타·네이버·구글 소재 성과 개선 감각
- healthFood: 식품·건기식·심의 경험
- multiChannel: 신규 채널 개척
- croData: 상세페이지 CVR·데이터
- tenure: 근속 안정성
` : ""}
반드시 순수 JSON만 출력하세요. 설명이나 마크다운 없이 { 로 시작하는 JSON만 반환:
{"totalScore":72,"scores":{"experienceMatch":65,"cultureFit":80,"skillKeywords":70,"stability":75,"portfolioMatch":60,"growthPotential":75},"verdict":"추천","strengths":["강점1","강점2","강점3"],"weaknesses":["약점1","약점2"],"keywords":[{"word":"키워드","type":"positive"}],"interviewQuestions":{"culture":["질문1","질문2","질문3"],"skill":["질문1","질문2","질문3","질문4","질문5"],"future":["질문1","질문2"],"killpath":["질문1","질문2","질문3"],"growth":["질문1","질문2"],"dataSkill":["질문1","질문2","질문3"],"execution":["질문1","질문2"]},"summary":"요약"${isMarketer ? `,"v2Scores":{"content":3,"perfLoop":3,"healthFood":2,"multiChannel":3,"croData":3,"tenure":4}` : ""}}`;

  const rich = (candidate.files || []).filter(f => f.kind === "pdf" || f.kind === "image");
  const content = rich.length > 0
    ? [...rich.map(f => f.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.b64 } }
        : { type: "image", source: { type: "base64", media_type: f.type.includes("png") ? "image/png" : "image/jpeg", data: f.b64 } }),
       { type: "text", text: prompt }]
    : prompt;

  const data = await callAI({ messages: [{ role: "user", content }] });
  const raw1 = data.content.map(b => b.text || "").join("");
  const m1 = raw1.match(/\{[\s\S]*\}/);
  if (!m1) throw new Error("JSON 없음");
  return JSON.parse(m1[0]);
}

async function scoreInterview(jd, name, transcript, questions, qList) {
  const allQ = questions ? [...(questions.culture||[]),...(questions.skill||[]),...(questions.future||[]),...(questions.killpath||[]),...(questions.growth||[]),...(questions.dataSkill||[]),...(questions.execution||[])] : [];
  const qBlock = (qList && qList.length)
    ? qList.map(q => `[${q.key}] ${q.text}`).join("\n")
    : (allQ.join(" / ") || "자유 면접");
  const prompt = `당신은 큐라엘(CURAEL) 전담 면접관 AI입니다.
${CURAEL_CULTURE}
채용 포지션 JD: ${jd.slice(0, 300)}
후보자: ${name}
준비된 질문 목록 (각 줄 맨 앞 [대괄호] 안이 그 질문의 key):
${qBlock}

=== 지금까지의 면접 녹취록 ===
${transcript}

위 녹취록을 실시간 평가하세요. 큐라엘 컬쳐핏(일당백, 환자 중심, 자율과 책임)을 중점 반영하세요.
추가로: 녹취록에서 특정 질문에 대한 후보자의 답변이 실제로 확인되는 경우에만, 그 질문의 key 그대로 1~5점과 근거 한 줄을 "questionScores" 배열에 담으세요. 답변이 확인되지 않은 질문은 배열에서 제외하세요. 확인된 질문이 없으면 빈 배열 []로 두세요.
순수 JSON으로만:
{"liveScore":숫자(0-100),"dimensions":{"communication":숫자,"expertise":숫자,"motivation":숫자,"problemSolving":숫자,"culture":숫자},"highlights":["인상적인 발언 요약1","인상적인 발언 요약2"],"concerns":["우려 포인트1"],"nextQuestion":"지금 상황에서 가장 적절한 다음 질문","oneliner":"현재까지 한줄 평가","questionScores":[{"key":"skill-0","score":4,"evidence":"근거 한 줄"}]}`;
  const data = await callAI({ messages: [{ role: "user", content: prompt }] });
  const raw2 = data.content.map(b => b.text || "").join("");
  const m2 = raw2.match(/\{[\s\S]*\}/);
  if (!m2) throw new Error("JSON 없음");
  return JSON.parse(m2[0]);
}

// ─── 면접 종료: 전체 녹취록 종합 피드백 (합격/보류/불합격 추천) ──────────────────
async function finalizeInterview(jd, name, transcript, questions) {
  const allQ = questions ? [...(questions.culture||[]),...(questions.skill||[]),...(questions.future||[]),...(questions.killpath||[]),...(questions.growth||[]),...(questions.dataSkill||[]),...(questions.execution||[])] : [];
  const prompt = `당신은 큐라엘(CURAEL) 전담 면접관 AI입니다.
${CURAEL_CULTURE}
채용 포지션 JD: ${(jd||"").slice(0, 500)}
후보자: ${name}
준비된 질문: ${allQ.join(" / ") || "자유 면접"}

=== 면접 전체 녹취록 ===
${transcript || "(녹취 없음)"}

위 면접 전체를 종합 평가하세요. 큐라엘 컬쳐핏(일당백, 환자 중심, 자율과 책임, 빠른 실행)을 중점 반영하세요.
aiVerdict는 반드시 "합격" / "보류" / "불합격" 중 하나로만 출력하세요.

또한 면접에서 실제로 드러난 역량을 바탕으로 아래 6개 항목 점수를 0~100으로 "재평가"하세요. 이력서만 보고 과소/과대평가됐던 부분을 면접 내용으로 보정하는 것이 목적입니다. 면접에서 판단 근거가 없는 항목은 기존 추정과 비슷하게 두세요.
- experienceMatch(직무 경험), cultureFit(문화 적합도), skillKeywords(역량 키워드), stability(안정성), portfolioMatch(포트폴리오), growthPotential(성장 가능성)

순수 JSON으로만 출력:
{"aiScore":숫자(0-100),"aiVerdict":"합격|보류|불합격","summary":"3~4문장 종합 평가","strengths":["강점1","강점2","강점3"],"concerns":["우려1","우려2"],"oneliner":"한줄 총평","revisedScores":{"experienceMatch":80,"cultureFit":75,"skillKeywords":85,"stability":70,"portfolioMatch":60,"growthPotential":72}}`;
  const data = await callAI({ messages: [{ role: "user", content: prompt }] });
  const raw = data.content.map(b => b.text || "").join("");
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("JSON 없음");
  return JSON.parse(m[0]);
}

// ─── 면접관 신원 (브라우저별 고정 id + 이름) ─────────────────────────────────────
function getEvaluator() {
  if (typeof window === "undefined") return { id: "", name: "" };
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem("hirel_evaluator") || "null"); } catch (e) {}
  if (!raw || !raw.id) {
    raw = { id: "ev_" + Math.random().toString(36).slice(2, 9), name: (raw && raw.name) || "" };
    try { localStorage.setItem("hirel_evaluator", JSON.stringify(raw)); } catch (e) {}
  }
  return raw;
}
function setEvaluatorName(name) {
  if (typeof window === "undefined") return;
  const ev = getEvaluator(); ev.name = name;
  try { localStorage.setItem("hirel_evaluator", JSON.stringify(ev)); } catch (e) {}
}
// 다수결 집계 (동점이면 "보류")
function tallyDecisions(evals) {
  const t = { 합격: 0, 보류: 0, 불합격: 0 };
  const list = Object.values(evals || {});
  list.forEach(e => { if (t[e.decision] != null) t[e.decision]++; });
  const total = list.length;
  let result = "보류";
  if (total > 0) {
    const max = Math.max(t.합격, t.보류, t.불합격);
    const top = ["합격", "보류", "불합격"].filter(k => t[k] === max);
    result = top.length === 1 ? top[0] : "보류";
  }
  return { tally: t, total, result };
}
const DEC_STYLE = {
  합격: { c: "#047857", bg: "rgba(16,185,129,.10)", b: "rgba(16,185,129,.35)" },
  보류: { c: "#B45309", bg: "rgba(245,158,11,.10)", b: "rgba(245,158,11,.35)" },
  불합격: { c: "#B91C1C", bg: "rgba(239,68,68,.10)", b: "rgba(239,68,68,.35)" },
};
// 사람 표 우선 결정: 사람 다수가 명확하면 그대로(AI는 참고), 사람이 동점/0명일 때만 AI가 타이브레이크
function decideResult(humanEvals, aiVote) {
  const ht = { 합격: 0, 보류: 0, 불합격: 0 };
  Object.values(humanEvals || {}).forEach(e => { if (ht[e.decision] != null) ht[e.decision]++; });
  const humanTotal = Object.values(humanEvals || {}).length;
  const maxH = Math.max(ht.합격, ht.보류, ht.불합격);
  const topH = ["합격", "보류", "불합격"].filter(k => ht[k] === maxH && maxH > 0);
  if (topH.length === 1) return topH[0];
  if (aiVote && aiVote.decision) {
    if (humanTotal === 0) return aiVote.decision;
    const t2 = { ...ht }; if (t2[aiVote.decision] != null) t2[aiVote.decision]++;
    const max2 = Math.max(t2.합격, t2.보류, t2.불합격);
    const top2 = ["합격", "보류", "불합격"].filter(k => t2[k] === max2);
    return top2.length === 1 ? top2[0] : "보류";
  }
  return "보류";
}
function buildFinal(humanEvals, aiVote) {
  const boardEvals = aiVote ? { ...humanEvals, __ai__: aiVote } : { ...humanEvals };
  const { tally, total } = tallyDecisions(boardEvals);
  return {
    result: decideResult(humanEvals, aiVote),
    tally, total,
    votes: Object.entries(boardEvals).map(([id, v]) => ({ name: v.name, decision: v.decision, comment: v.comment || "", isAI: id === "__ai__" })),
    decidedAt: Date.now(),
  };
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
      ${scoreBar("포트폴리오 적합도", a.scores.portfolioMatch ?? 0)}
      ${scoreBar("성장 가능성", a.scores.growthPotential ?? 0)}
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
      const sections = [["🧡 인성/컬쳐핏", iq.culture||[], "#F59E0B"], ["💼 직무 역량", iq.skill||[], "#3B82F6"], ["🚀 미래/방향성", iq.future||[], "#8B5CF6"], ["⚠️ 킬패스/단점", iq.killpath||[], "#EF4444"], ["💡 자기계발", iq.growth||[], "#10B981"], ["📊 데이터 실전능력", iq.dataSkill||[], "#0EA5E9"], ["⚡ 실행력", iq.execution||[], "#F97316"]];
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

// ─── 채용 종합 리포트 (인쇄/PDF) ─────────────────────────────────────────────────
function exportRecruitmentReport(candidates, positions) {
  const posName = (id) => positions.find(p => p.id === id)?.name || "미지정";
  const passed = candidates.filter(c => c.finalDecision?.result === "합격");
  const hold = candidates.filter(c => c.finalDecision?.result === "보류");
  const rejected = candidates.filter(c => c.finalDecision?.result === "불합격");
  const interviewed = candidates.filter(c => c.interviewFeedback || c.finalDecision);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  const dc = (r) => r === "합격" ? "#059669" : r === "보류" ? "#d97706" : r === "불합격" ? "#dc2626" : "#6b7280";

  const passCards = passed.map(c => {
    const fb = c.interviewFeedback, a = c.analysis;
    const votes = (c.finalDecision?.votes || []).filter(v => v.comment);
    return `<div style="border:1px solid #e5e7eb;border-left:4px solid #059669;border-radius:10px;padding:18px;margin-bottom:14px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:16px;font-weight:700;color:#111827">${esc(c.name)}</span>
        <span style="font-size:12px;color:#6b7280">${esc(posName(c.positionId))}${c.age ? " · " + c.age + "세" : ""}</span>
        <span style="margin-left:auto;font-size:12px;font-weight:700;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:3px 12px;border-radius:14px">합격 (${c.finalDecision.tally?.합격 ?? 0}/${c.finalDecision.total ?? 0})</span>
      </div>
      ${a ? `<div style="font-size:12px;color:#6b7280;margin-bottom:8px">이력서 ${a.totalScore}점 · AI 사전판정 ${esc(a.verdict)}${fb ? " · 면접 " + fb.aiScore + "점" : ""}</div>` : ""}
      ${fb?.summary ? `<div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:10px"><b style="color:#111827">AI 종합평:</b> ${esc(fb.summary)}</div>` : ""}
      ${fb?.strengths?.length ? `<div style="font-size:12px;color:#374151;margin-bottom:8px"><b>강점:</b> ${fb.strengths.map(esc).join(" · ")}</div>` : ""}
      ${votes.length ? `<div style="margin-top:8px"><div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:5px">면접관 코멘트</div>${votes.map(v => `<div style="font-size:12px;color:#4b5563;padding:6px 10px;background:${v.isAI ? "#f5f3ff" : "#f9fafb"};border:1px solid ${v.isAI ? "#ddd6fe" : "#f0f0f0"};border-radius:6px;margin-bottom:4px"><b style="color:${v.isAI ? "#6d28d9" : "#111827"}">${v.isAI ? "🤖 AI 면접관" : esc(v.name || "면접관")}</b> <span style="color:${dc(v.decision)}">[${esc(v.decision)}]</span> ${esc(v.comment)}</div>`).join("")}</div>` : ""}
    </div>`;
  }).join("") || `<div style="color:#9ca3af;font-size:13px;padding:14px">아직 합격 확정된 후보가 없습니다.</div>`;

  const rows = candidates.map(c => {
    const a = c.analysis, r = c.finalDecision?.result;
    return `<tr>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#111827">${esc(c.name)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#6b7280">${esc(posName(c.positionId))}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#6b7280">${esc(c.channel || "기타")}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#374151">${a ? a.totalScore : "-"}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280">${a ? esc(a.verdict) : "미분석"}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${dc(r)}">${r ? esc(r) : "미정"}</td>
    </tr>`;
  }).join("");

  // 채널별 통계 (후보 수 · 면접 수 · 합격 수)
  const channelStats = CHANNELS.map(ch => {
    const list = candidates.filter(c => (c.channel || "기타") === ch);
    return {
      ch,
      total: list.length,
      interviewed: list.filter(c => c.interviewFeedback || c.finalDecision).length,
      passed: list.filter(c => c.finalDecision?.result === "합격").length,
    };
  }).filter(s => s.total > 0);
  const channelRows = channelStats.map(s => `<tr>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;color:${CHANNEL_COLORS[s.ch] || "#6b7280"}">${esc(s.ch)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#374151">${s.total}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#2563eb">${s.interviewed}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#059669;font-weight:700">${s.passed}</td>
    </tr>`).join("") || `<tr><td colspan="4" style="padding:9px 10px;color:#9ca3af">후보가 없습니다.</td></tr>`;

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>HireL 채용 종합 리포트</title>
  <style>body{font-family:'Malgun Gothic',sans-serif;color:#111827;margin:0;padding:36px;background:#fff}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 12px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:9px 10px;background:#f9fafb;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:12px}.kpi{display:flex;gap:10px;margin:16px 0}.kb{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:14px;text-align:center}.kn{font-size:24px;font-weight:800}.kl{font-size:11px;color:#6b7280;margin-top:3px}@media print{body{padding:18px}}</style>
  </head><body>
  <div style="font-size:11px;color:#9ca3af;font-weight:600;letter-spacing:1px;margin-bottom:6px">HIRERL 채용 종합 리포트</div>
  <h1>채용 종합 리포트</h1>
  <div style="font-size:12px;color:#6b7280">생성일 ${new Date().toLocaleDateString("ko-KR")} · 총 후보 ${candidates.length}명 · 면접 완료 ${interviewed.length}명</div>
  <div class="kpi">
    <div class="kb"><div class="kn" style="color:#111827">${candidates.length}</div><div class="kl">전체 후보</div></div>
    <div class="kb"><div class="kn" style="color:#2563eb">${interviewed.length}</div><div class="kl">면접 완료</div></div>
    <div class="kb"><div class="kn" style="color:#059669">${passed.length}</div><div class="kl">합격</div></div>
    <div class="kb"><div class="kn" style="color:#d97706">${hold.length}</div><div class="kl">보류</div></div>
    <div class="kb"><div class="kn" style="color:#dc2626">${rejected.length}</div><div class="kl">불합격</div></div>
  </div>
  <h2>📊 채널별 통계</h2>
  <table><thead><tr><th>채널</th><th style="text-align:center">후보 수</th><th style="text-align:center">면접 수</th><th style="text-align:center">합격 수</th></tr></thead><tbody>${channelRows}</tbody></table>
  <h2>✅ 최종 합격자 — 합격 사유</h2>
  ${passCards}
  <h2>전체 후보 현황</h2>
  <table><thead><tr><th>이름</th><th>포지션</th><th>채널</th><th style="text-align:center">이력서점수</th><th style="text-align:center">AI 사전판정</th><th style="text-align:center">최종결정</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}
function Ring({ score, size = 80, stroke = 7, color = C.accent, label }) {
  score = score ?? 0;
  const r = (size - stroke * 2) / 2, ci = 2 * Math.PI * r, d = (score / 100) * ci;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${d} ${ci}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size * .22, fontWeight: 700, color: C.text, fontFamily: "'DM Mono',monospace" }}>{score}</span>
        </div>
      </div>
      {label && <span style={{ fontSize: 10, color: C.sub, textAlign: "center", lineHeight: 1.3, maxWidth: size + 14 }}>{label}</span>}
    </div>
  );
}
function Bar({ label, score, revised }) {
  score = score ?? 0;
  const has = revised != null && revised !== score;
  const base = score, rev = has ? revised : score;
  const baseC = sc(base), revC = sc(rev);
  const up = has && rev > base, down = has && rev < base;
  const boost = "#7C3AED";
  const delta = rev - base;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.sub }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {has && <span style={{ fontSize: 10, fontWeight: 700, color: up ? boost : C.red, background: up ? "rgba(139,92,246,.15)" : "rgba(239,68,68,.12)", padding: "1px 6px", borderRadius: 8 }}>{delta > 0 ? `+${delta}` : delta} 면접</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: has ? revC : baseC, fontFamily: "'DM Mono',monospace" }}>{rev}점</span>
        </span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden", display: "flex" }}>
        {up ? (<>
          <div style={{ height: "100%", width: `${base}%`, background: baseC, transition: "width 1.2s ease" }} />
          <div style={{ height: "100%", width: `${rev - base}%`, background: boost, transition: "width 1.2s ease" }} />
        </>) : down ? (<>
          <div style={{ height: "100%", width: `${rev}%`, background: revC, transition: "width 1.2s ease" }} />
          <div style={{ height: "100%", width: `${base - rev}%`, background: "rgba(239,68,68,.25)", transition: "width 1.2s ease" }} />
        </>) : (
          <div style={{ height: "100%", width: `${score}%`, background: baseC, borderRadius: 3, transition: "width 1.2s ease" }} />
        )}
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
function UploadZone({ onReady, maxFiles = 3, onLimit }) {
  const [drag, setDrag] = useState(false), [proc, setProc] = useState(false), [files, setFiles] = useState([]);
  const ref = useRef();
  const process = async (raw) => {
    let incoming = Array.from(raw);
    const room = Math.max(0, maxFiles - files.length);
    if (incoming.length > room) { incoming = incoming.slice(0, room); onLimit && onLimit(); }
    if (!incoming.length) return;
    setProc(true); const results = [];
    for (const f of incoming) {
      try {
        const t = f.type;
        if (t === "application/pdf") {
          let ptext = "";
          try { ptext = await pdfText(f); } catch (e) { console.error("PDF 텍스트 추출 실패:", e); }
          if (ptext.replace(/\s/g, "").length >= 40) {
            // 텍스트 PDF → 텍스트만 사용 (base64 미전송 → 413 방지). kind:"text"라 addCandidate에서 자동으로 이력서에 합쳐짐
            results.push({ kind: "text", text: ptext, name: f.name, size: f.size, type: t });
          } else if (f.size < 3 * 1024 * 1024) {
            // 스캔본 등 텍스트 추출 실패 + 3MB 미만 → base64 폴백 (4.5MB 한도 내)
            results.push({ kind: "pdf", b64: await fileToBase64(f), name: f.name, size: f.size, type: t });
          } else {
            // 텍스트 없음 + 용량 큼 → 413 방지 위해 전송 불가, 안내만
            results.push({ kind: "text", text: `(⚠ ${f.name}: 텍스트가 없는 스캔/이미지 PDF이고 용량이 커서 첨부할 수 없습니다. 텍스트가 들어있는 PDF로 다시 올려주세요.)`, name: f.name, size: f.size, type: t });
          }
        }
        else if (t.startsWith("image/")) results.push({ kind: "image", b64: await fileToBase64(f), name: f.name, size: f.size, type: t });
        else if (t.includes("word") || f.name.endsWith(".docx")) results.push({ kind: "text", text: await docxText(f), name: f.name, size: f.size, type: t });
        else results.push({ kind: "text", text: await fileToText(f), name: f.name, size: f.size, type: t });
      } catch (e) { console.error(e); }
    }
    const next = [...files, ...results].slice(0, maxFiles);
    setFiles(next); onReady(next); setProc(false);
  };
  const remove = (i) => { const n = files.filter((_, j) => j !== i); setFiles(n); onReady(n); };
  return (
    <div>
      <div onClick={() => ref.current?.click()} onDrop={e => { e.preventDefault(); setDrag(false); process(e.dataTransfer.files); }} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        style={{ border: `2px dashed ${drag ? C.accent : C.borderL}`, borderRadius: 11, padding: "22px 18px", textAlign: "center", cursor: "pointer", background: drag ? C.glow : "transparent", transition: "all .2s" }}>
        <input ref={ref} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" multiple hidden onChange={e => { process(e.target.files); e.target.value = ""; }} />
        {proc ? <Spin label="파일 읽는 중..." /> : (<>
          <div style={{ fontSize: 26, marginBottom: 7 }}>☁</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>드래그 또는 클릭</div>
          <div style={{ fontSize: 12, color: C.sub }}>PDF · Word · TXT · 이미지 · 최대 {maxFiles}개</div>
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

// ─── 질문별 채점: 섹션 정의 + 헬퍼 ─────────────────────────────────────────────
const Q_SECTION_DEFS = [
  ["culture", "🧡 인성/컬쳐핏", C.amber],
  ["skill", "💼 직무 역량", C.accent],
  ["future", "🚀 미래/방향성", C.purple],
  ["killpath", "⚠️ 킬패스/단점", C.red],
  ["growth", "💡 자기계발", C.green],
  ["dataSkill", "📊 데이터 실전능력", C.teal],
  ["execution", "⚡ 실행력", "#F97316"],
];
// ─── 면접키트 v2: 후보별 킷 질문 (합격 신호 / Red Flag) + Gray Area 룰 ─────────
// 룰: ❌ Red Flag 답변 2개 이상 또는 ⚠ 애매(Gray) 답변 3개 이상 → 탈락 권고
const GRAY_RULE = { red: 2, gray: 3 };
const KIT_COMMON = [
  { text: "(조건 선고지 — 최초반) 저희는 ①3개월 계약 후 전환 ②팀원 0명, 본인이 1호 ③연봉 상한 5,500입니다. 이 세 가지가 괜찮으신가요?", pass: "세 조건 모두 수용 + 이유가 구체적", red: "조건부 수용인데 이유가 모호 / '일단 들어가서 조정' 뉘앙스" },
  { text: "저희 자사몰(curaelmall.com)이나 제품을 보고 오셨나요? 첫인상은요?", pass: "제품·리뷰·상세페이지까지 구체적 관찰 1개 이상", red: "'아직 못 봤다' — 지원 동기 약함" },
];
const KIT_QUESTIONS = {
  "오세현": [
    { text: "오비랩을 올해 2월에 나오신 걸로 되어 있는데, 퇴사 계기와 그 이후는 어떻게 보내셨나요? (프로필 '재직중' 표기 불일치도 자연스럽게 확인)", pass: "사유가 구체적·일관, 공백기에 한 일을 실물로 설명", red: "회사 탓 반복 / 불일치를 얼버무림 / 공백기 설명이 추상적" },
    { text: "매출 성장이 12배로도 17배로도 나오는데, 정확한 숫자·기간과 본인 기여 부분을 분리해 주세요.", pass: "기준 차이를 즉시 설명하고 본인 기여를 '이건 팀, 이건 나'로 분리", red: "숫자가 또 바뀜 / 기여 분리 불가" },
    { text: "AI 소재 CTR 2.5배 — 암 환우·가족이 보는 브랜드에서 '진짜 사람의 진심' 톤을 AI로 낼 수 있다고 보세요?", pass: "AI 한계 인정 + 사람 개입 지점(검수·톤 가이드) 설계", red: "'AI가 다 됩니다' 만능주의 / 감수성 없이 효율 얘기만" },
    { text: "리뷰 1만건 마이닝→카피까지 과정을 처음부터 걸어가 주세요. 큐라엘이면 어떤 키워드부터 긁겠어요?", pass: "단계별 도구·판단이 구체적 + 즉석 적용이 그럴듯함", red: "결과 숫자만 반복 / 즉석 질문에 일반론" },
    { text: "상세페이지 이탈 95% 병목에서 소구점을 어떻게 바꿨고 왜 먹혔나요?", pass: "가설→변경→수치 검증이 한 흐름", red: "'왜'와 '검증'이 없음" },
    { text: "블로그 주 2~3건, 인스타 운영 같은 반복 업무가 이 자리의 30%입니다. 지루하지 않겠어요?", pass: "솔직한 인정 + 본인의 지속 장치(루틴화·자동화)", red: "'다 좋습니다' 식 무조건 수용" },
    { text: "희망 연봉이 '무관'이던데 실제 기대 레인지는요?", pass: "5,500 이내 구체 답변", red: "회피하거나 면접 후반에 말 바꿈" },
  ],
  "박현철": [
    { text: "(최초반) 저희 레인지는 4,000~5,500입니다. 그룹바이에 7,000으로 적으셨던데, 이 레인지에서도 이 자리가 의미 있나요?", pass: "수용 + 이유가 구체적(실무 복귀·카테고리 관심)", red: "'일단 들어가서 조정' 뉘앙스 → 정중히 조기 종료" },
    { text: "Anti-aging Club 7개월째인데 움직이시는 이유는요?", pass: "현직의 구조적 이슈를 남 탓 없이 구체적으로", red: "단기 3회(3·4·7개월) 패턴 자각 없음 / 매번 회사 탓" },
    { text: "팀장 직함 없이 광고 계정을 본인 손으로 돌리는 자리입니다. 최근 '직접' 세팅한 캠페인이 언제였나요?", pass: "최근 3개월 내 직접 세팅을 캠페인 구조 수준까지 구체적으로", red: "'팀원 시켜서' / 직접 세팅이 1년 이상 전 / 관리 얘기로 빠짐" },
    { text: "건기식·의료 표현에서 실제 걸러낸 사례 2~3개와, '암 환자의 회복을 돕는다'는 메시지 사용 가능 여부는?", pass: "실사례 + 법적 근거 + 대체 표현 → 심의 게이트 역할 확정", red: "일반론뿐 / 사례를 못 꺼냄" },
    { text: "버핏서울 분기 목표 7회 초과 중 본인이 만든 레버 하나만 깊게 설명해 주세요.", pass: "레버 하나를 수치·과정으로 깊게", red: "7회를 나열만 하고 하나도 깊게 못 들어감" },
    { text: "메타·네이버·구글에 월 1,000만원이면 큐라엘엔 어떻게 배분하고, 첫 달에 뭘 테스트하겠어요?", pass: "근거 있는 배분 + 테스트 설계(소재 수·지표·기간)", red: "매체 나열만 / '해봐야 안다' 회피" },
    { text: "김동은 상무님이 광고를 총괄해 오셨습니다. 역할을 어떻게 나누시겠어요?", pass: "실무는 본인·전략 정렬은 상무, 갈등 시나리오까지 담담하게", red: "서열 정리 집착 / '다 제가' 또는 '시키는 대로' 양극단" },
  ],
  "이찬우": [
    { text: "(핵심 관문) 포트폴리오가 오픈톡·밴드·영상 중심인데, 메타나 네이버 '광고 계정'을 직접 세팅·운영해 본 경험을 구체적으로 말씀해 주세요.", pass: "캠페인 구조·타겟·예산·지표까지 직접 만진 이야기 (규모 작아도 OK)", red: "광고는 대행사/타 부서, 본인은 소재만 / 용어가 겉돎 → ①전환형 부적합, 소재제작 역할 재검토" },
    { text: "앨트웰 3년 6개월 재직 중인데 옮기려는 이유는요? 희망 4,000은 현재 연봉 대비 어떤가요?", pass: "성장·역할 확장의 구체적 사유 + 합리적 인상 폭", red: "현직 불만 나열 / 4,000이 협상용이었다며 말 바꿈" },
    { text: "프로모션 누적 매출 28.31억에서 본인 기여를 분리하면 어디까지인가요?", pass: "기획·소재·채널 중 본인 담당을 분리하고 근거 제시", red: "회사 전체 매출을 본인 성과처럼 말함" },
    { text: "영상 200편+ 중 성과가 가장 좋았던 1편 — 기획부터 성과 수치까지 걸어가 주세요.", pass: "타겟·훅·지표(조회·전환)가 한 흐름, 직접 제작", red: "'많이 만들었다'만 있고 성과 연결이 없음" },
    { text: "AI 이미지·영상 제작을 실무에 어떻게 쓰고 있나요? 큐라엘(암 환우 브랜드) 톤에도 통할까요?", pass: "실제 워크플로우 + 카테고리 감수성(검수·톤 조정)", red: "툴 이름 나열만 / 감수성 질문에 효율 얘기만" },
    { text: "건기식 심의 때문에 걸러본 표현이 있나요?", pass: "실사례 + 대체 표현", red: "건기식 3년 6개월 재직인데 사례가 안 나옴 (감점)" },
  ],
  "박보현": [
    { text: "(포지셔닝 주의: ①전환형이 아니라 'datarize 고도화 시점의 ③CRM 풀 카드'인지 검증하는 면접) RFM·K-Means 세그멘테이션을 실무에서 어떻게 썼고, 매출이 어떻게 달라졌나요?", pass: "분석→캠페인 실행→성과까지 연결 (분석으로 끝나지 않음)", red: "방법론 설명만 길고 '그래서 뭘 했는지'가 없음" },
    { text: "Make·n8n·Claude Code로 만든 자동화 중 가장 쓸모 있었던 것 하나를 보여주듯 설명해 주세요.", pass: "문제→자동화→절감 효과가 구체적, 직접 만든 증거", red: "튜토리얼 수준 / 실무 적용 증거 없음" },
    { text: "저희는 소재 제작이 업무의 절반입니다. 콘텐츠·소재 경험이 약한데, 이 자리에서 어떻게 기여하시겠어요?", pass: "약점 인정 + CRM·데이터 기여 그림 또는 학습 계획", red: "약점 인정 없이 '다 할 수 있다'" },
    { text: "세타필 캠페인에서 본인 역할과 성과는요? 건기식(식품·심의) 환경 차이는 어떻게 보세요?", pass: "더마→건기식 규제 차이 인지 + 학습 계획", red: "심의 개념 자체가 없음" },
    { text: "언제부터 합류 가능하고, 희망 연봉은요? (→ 조건 기록 카드에 기입)" },
  ],
};
function kitFor(candidate) {
  const own = KIT_QUESTIONS[(candidate?.name || "").trim()];
  return own ? [...KIT_COMMON, ...own] : null;
}
// 질문별 답변 판정(signal: pass/gray/red) 집계 → Gray Area 룰 판정
function signalCounts(candidate) {
  const qs = candidate?.questionScores || {};
  let pass = 0, gray = 0, red = 0;
  Object.values(qs).forEach(e => {
    if (e?.signal === "pass") pass++;
    else if (e?.signal === "gray") gray++;
    else if (e?.signal === "red") red++;
  });
  return { pass, gray, red, fail: red >= GRAY_RULE.red || gray >= GRAY_RULE.gray };
}
function GrayAreaBanner({ candidate }) {
  const { pass, gray, red, fail } = signalCounts(candidate);
  if (!pass && !gray && !red) return null;
  const chip = (label, n, color) => (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}35`, padding: "3px 10px", borderRadius: 12 }}>{label} {n}</span>
  );
  return (
    <div style={{ background: fail ? "#FEF2F2" : C.card, border: `1px solid ${fail ? C.red : C.border}`, borderRadius: 13, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: fail ? C.red : C.sub }}>{fail ? "🚫 탈락 권고 — Gray Area 룰 발동" : "⚖️ 답변 판정 현황"}</span>
      {chip("✅ 신호", pass, C.green)}{chip("⚠ 애매", gray, C.amber)}{chip("❌ Red Flag", red, C.red)}
      <span style={{ fontSize: 11, color: fail ? C.red : C.muted, marginLeft: "auto" }}>
        {fail
          ? (red >= GRAY_RULE.red ? `Red Flag ${GRAY_RULE.red}개 이상` : `애매한 답변 ${GRAY_RULE.gray}개 이상`) + " — “애매하면 불합격”. 뒤집으려면 랩업에서 기록으로 반박"
          : `룰: ❌ ${GRAY_RULE.red}개 이상 또는 ⚠ ${GRAY_RULE.gray}개 이상이면 탈락 권고`}
      </span>
    </div>
  );
}

// AI 생성 질문 + 직접 추가 질문(customQuestions)을 섹션 구조로 합침.
// questionKey: AI 질문 "섹션-인덱스" (예: skill-0) / 직접 추가 "섹션-c고유id" (예: skill-cabc123) / 킷 "kit-인덱스"
function buildQuestionSections(candidate) {
  const iq = candidate?.analysis?.interviewQuestions;
  const custom = candidate?.customQuestions || {};
  const withCustom = (secKey, base) => [
    ...base,
    ...(custom[secKey] || []).map(cq => ({ key: `${secKey}-c${cq.id}`, text: cq.text, custom: true, id: cq.id })),
  ];
  const kit = kitFor(candidate);
  const kitSections = (kit || custom.kit) ? [{
    secKey: "kit", label: "📋 면접키트 v2 · 합격신호/Red Flag", color: C.red,
    items: withCustom("kit", (kit || []).map((q, i) => ({ key: `kit-${i}`, text: q.text, custom: false, pass: q.pass || null, red: q.red || null }))),
  }] : [];
  let base;
  if (iq && typeof iq === "object" && !Array.isArray(iq)) {
    base = Q_SECTION_DEFS.map(([secKey, label, color]) => ({
      secKey, label, color,
      items: withCustom(secKey, (iq[secKey] || []).map((q, i) => ({ key: `${secKey}-${i}`, text: q, custom: false }))),
    }));
  } else if (Array.isArray(iq)) {
    base = [{ secKey: "legacy", label: "💬 면접 질문", color: C.accent, items: withCustom("legacy", iq.map((q, i) => ({ key: `legacy-${i}`, text: q, custom: false }))) }];
  } else {
    // 분석 전 후보: 직접 추가 질문만 담는 섹션 하나
    base = [{ secKey: "extra", label: "✍️ 직접 추가 질문", color: C.accent, items: withCustom("extra", []) }];
  }
  return [...kitSections, ...base];
}

// ─── 질문 카드 한 줄 (접기/펼치기 + 1~5 수동 채점 + 메모 + AI 근거) ─────────────
const SIGNAL_DEFS = [
  ["pass", "✅ 신호", "합격 신호에 부합하는 답변"],
  ["gray", "⚠ 애매", "Gray Area — 애매한 답변 (3개 이상이면 탈락 권고)"],
  ["red", "❌ Red Flag", "Red Flag 답변 (2개 이상이면 탈락 권고)"],
];
const SIGNAL_COLOR = { pass: C.green, gray: C.amber, red: C.red };
const SIGNAL_LABEL = { pass: "✅ 신호", gray: "⚠ 애매", red: "❌ Red Flag" };
function QuestionRow({ item, color, entry, open, onToggle, onManual, onNote, onDelete, onSignal }) {
  const [noteDraft, setNoteDraft] = useState(entry?.note || "");
  useEffect(() => { setNoteDraft(entry?.note || ""); }, [entry?.note]);
  const manual = entry?.manual ?? null;
  const ai = entry?.ai ?? null;
  const signal = entry?.signal ?? null;
  const saveNote = () => { if ((entry?.note || "") !== noteDraft) onNote(noteDraft); };
  return (
    <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${open ? `${color}55` : C.border}`, marginBottom: 6, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", gap: 9, padding: "9px 12px", cursor: "pointer", alignItems: "flex-start" }}>
        <span style={{ minWidth: 20, height: 20, borderRadius: 5, background: `${color}20`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>Q</span>
        <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, flex: 1 }}>{item.text}</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0, paddingTop: 1 }}>
          {signal && <span style={{ fontSize: 10, fontWeight: 700, color: SIGNAL_COLOR[signal], background: `${SIGNAL_COLOR[signal]}15`, border: `1px solid ${SIGNAL_COLOR[signal]}35`, padding: "1px 7px", borderRadius: 9, whiteSpace: "nowrap" }}>{SIGNAL_LABEL[signal]}</span>}
          {item.custom && <span style={{ fontSize: 9, fontWeight: 700, color: C.teal, background: `${C.teal}15`, border: `1px solid ${C.teal}35`, padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>직접 추가</span>}
          {manual != null && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: `${C.accent}15`, border: `1px solid ${C.accent}35`, padding: "1px 7px", borderRadius: 9, whiteSpace: "nowrap" }}>내 {manual}점</span>}
          {ai != null && <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, background: `${C.purple}15`, border: `1px solid ${C.purple}35`, padding: "1px 7px", borderRadius: 9, whiteSpace: "nowrap" }}>AI {ai}점</span>}
          {item.custom && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="질문 삭제" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: "0 2px", lineHeight: 1 }}>✕</button>}
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 12px 11px 41px" }}>
          {(item.pass || item.red) && (
            <div style={{ marginBottom: 8, padding: "8px 11px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11.5, lineHeight: 1.6 }}>
              {item.pass && <div style={{ color: C.green }}><b>✅ 합격 신호</b> · {item.pass}</div>}
              {item.red && <div style={{ color: C.red }}><b>❌ Red Flag</b> · {item.red}</div>}
            </div>
          )}
          {onSignal && (
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: C.muted, marginRight: 3 }}>답변 판정</span>
              {SIGNAL_DEFS.map(([key, label, tip]) => {
                const on = signal === key;
                const col = SIGNAL_COLOR[key];
                return (
                  <button key={key} title={tip} onClick={() => onSignal(on ? null : key)}
                    style={{ padding: "4px 11px", borderRadius: 14, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: on ? col : C.card, border: `1px solid ${on ? col : C.borderL}`, color: on ? "#fff" : C.sub, transition: "all .12s" }}>{label}</button>
                );
              })}
              {signal && <span style={{ fontSize: 10, color: C.muted }}>재클릭 시 해제</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 3 }}>내 채점</span>
            {[1, 2, 3, 4, 5].map(n => {
              const on = manual != null && n <= manual;
              return (
                <button key={n} onClick={() => onManual(manual === n ? null : n)}
                  style={{ width: 26, height: 26, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: on ? C.accent : C.card, border: `1px solid ${on ? C.accent : C.borderL}`, color: on ? "#fff" : C.sub, transition: "all .12s" }}>{n}</button>
              );
            })}
            {manual != null && <span style={{ fontSize: 10, color: C.muted }}>같은 점수 재클릭 시 해제</span>}
          </div>
          <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} onBlur={saveNote}
            onKeyDown={e => { if (e.key === "Enter") { saveNote(); e.currentTarget.blur(); } }}
            placeholder="한 줄 메모 (Enter 또는 포커스 아웃 시 저장)"
            style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          {entry?.aiEvidence && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>🤖 AI 근거 · {entry.aiEvidence}</div>}
        </div>
      )}
    </div>
  );
}

// ─── 질문별 점수 요약 표 (섹션 평균 포함) — 합의 화면·후보 상세 공용 ────────────
function QuestionScoreSummary({ candidate, title }) {
  const qs = candidate?.questionScores || {};
  const sections = buildQuestionSections(candidate)
    .map(s => ({ ...s, items: s.items.filter(it => { const e = qs[it.key]; return e && (e.manual != null || e.ai != null || e.signal); }) }))
    .filter(s => s.items.length > 0);
  if (!sections.length) return null;
  const avg = (vals) => vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
  const cell = { padding: "7px 10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, textAlign: "left", verticalAlign: "top", color: C.text };
  return (
    <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 12 }}>{title || "📝 질문별 채점 요약"}</div>
      <div style={{ marginBottom: 12 }}><GrayAreaBanner candidate={candidate} /></div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...cell, color: C.muted, fontSize: 11, fontWeight: 600 }}>질문</th>
            <th style={{ ...cell, color: C.muted, fontSize: 11, fontWeight: 600, width: 76, textAlign: "center" }}>판정</th>
            <th style={{ ...cell, color: C.accent, fontSize: 11, fontWeight: 600, width: 56, textAlign: "center" }}>내 점수</th>
            <th style={{ ...cell, color: C.purple, fontSize: 11, fontWeight: 600, width: 56, textAlign: "center" }}>AI 점수</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(s => {
            const mAvg = avg(s.items.map(it => qs[it.key]?.manual).filter(v => v != null));
            const aAvg = avg(s.items.map(it => qs[it.key]?.ai).filter(v => v != null));
            return [
              <tr key={`${s.secKey}__h`}>
                <td colSpan={4} style={{ ...cell, background: `${s.color}0D` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
                  <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>
                    섹션 평균{mAvg != null ? ` 내 ${mAvg}점` : ""}{mAvg != null && aAvg != null ? " ·" : ""}{aAvg != null ? ` AI ${aAvg}점` : ""}
                  </span>
                </td>
              </tr>,
              ...s.items.map(it => {
                const e = qs[it.key] || {};
                return (
                  <tr key={it.key}>
                    <td style={cell}>
                      <div style={{ lineHeight: 1.5 }}>{it.text}{it.custom && <span style={{ fontSize: 9, fontWeight: 700, color: C.teal, background: `${C.teal}15`, border: `1px solid ${C.teal}35`, padding: "0px 5px", borderRadius: 7, marginLeft: 6, whiteSpace: "nowrap" }}>직접 추가</span>}</div>
                      {e.note && <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>✎ {e.note}</div>}
                      {e.aiEvidence && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>🤖 {e.aiEvidence}</div>}
                    </td>
                    <td style={{ ...cell, textAlign: "center", fontWeight: 700, color: e.signal ? SIGNAL_COLOR[e.signal] : C.muted, whiteSpace: "nowrap" }}>{e.signal ? SIGNAL_LABEL[e.signal] : "—"}</td>
                    <td style={{ ...cell, textAlign: "center", fontWeight: 700, color: e.manual != null ? C.accent : C.muted }}>{e.manual != null ? `${e.manual}점` : "—"}</td>
                    <td style={{ ...cell, textAlign: "center", fontWeight: 700, color: e.ai != null ? C.purple : C.muted }}>{e.ai != null ? `${e.ai}점` : "—"}</td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── EVP 오프닝 대본 카드 (트레이드오프 선언문 + 어트랙션 멘트) ─────────────
const EVP_TRADEOFF = [
  "시작 전에 저희 조건을 먼저 말씀드리겠습니다. 세 가지입니다.",
  "하나, 3개월 계약 후 정규 전환 구조입니다. 서로를 검증하는 기간이고, 판단 기준은 입사 첫날 문서로 드립니다.",
  "둘, 마케팅팀은 팀원이 0명입니다. 본인이 1호이고, 처음엔 손이 많이 가는 실무의 자리입니다.",
  "셋, 연봉 상한은 5,500입니다. 시장 최고 대우는 아닙니다.",
  "이 세 가지를 듣고도 흥미가 있으시면, 저희가 드릴 수 있는 것을 말씀드리겠습니다.",
];
const EVP_ATTRACTION = [
  "저희 고객은 암 환우와 그 가족입니다. 마케팅 메시지 하나가 실제로 누군가의 회복기 식탁을 바꿉니다.",
  "이 자리는 1호 마케터입니다. 결재 라인 없이 대표와 바로 일하고, 성과를 내면 팀은 본인을 중심으로 만들어집니다.",
  "AI 소재 생성·리뷰 마이닝·자동 리포팅까지 툴은 저희가 만들어 두고 있습니다. 실무자가 잡무에 시간을 쓰지 않게 하는 게 대표인 제 일입니다.",
];
function EvpScriptCard() {
  const [open, setOpen] = useState("tradeoff"); // "tradeoff" | "attraction" | null
  const sec = (key, icon, title, when, lines, color) => (
    <div style={{ marginBottom: open === key ? 10 : 4 }}>
      <div onClick={() => setOpen(p => p === key ? null : key)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "7px 10px", background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{icon} {title}</span>
        <span style={{ fontSize: 10.5, color: C.muted }}>{when}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>{open === key ? "▲ 접기" : "▼ 대본 보기"}</span>
      </div>
      {open === key && (
        <div style={{ padding: "10px 12px", borderLeft: `3px solid ${color}`, margin: "6px 0 0 4px" }}>
          {lines.map((l, i) => <p key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: "0 0 7px 0" }}>&ldquo;{l}&rdquo;</p>)}
        </div>
      )}
    </div>
  );
  return (
    <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 8 }}>🗣 EVP 오프닝 대본 <span style={{ fontWeight: 400, fontSize: 11, color: C.muted }}>· 숨기면 입사 후 터진다 — 먼저 밝히면 기대 관리</span></div>
      {sec("tradeoff", "⚖️", "트레이드오프 선언문", "면접 시작 직후 그대로 읽기 · 반응은 킷 1번 질문에 판정", EVP_TRADEOFF, C.amber)}
      {sec("attraction", "✨", "어트랙션 멘트", "면접 마무리 5분 · 후보 유형별 강조(실무형→전권·속도 / 미션형→환우 / 성장형→팀 빌딩)", EVP_ATTRACTION, C.accent)}
    </div>
  );
}

// ─── 온보딩 모드 (합격자 3개월 추적: 돕는 기간 + 검증하는 기간) ────────────────
// 원본 문서: Y:\본부\인사\마케터채용\온보딩_킷.md
const OB_MILESTONES = [
  ["d1_doc", "기대치 문서 합의 — 역할·3개월 기대 수준·전환 기준을 문서로 같이 읽고 합의", "대표", 0, 2],
  ["d1_card35", "35CARD 작성·리뷰 미팅 — 3대 과업·5대 해결과제 합의 (입사 첫날 11시, 상무)", "대표+인사", 0, 3],
  ["d1_setup", "계정·툴·행정 셋업 + 웰컴키트·근로계약서·보안서약서 (입사 첫날 시간표)", "인사", 0, 3],
  ["w1_daily", "Week 1 데일리 싱크 — 매일 15~30분 (오늘 한 일·막힌 것·내일 할 일)", "대표", 0, 9],
  ["w2_rel", "관계 지도 미팅 — 상무·유튜브 담당·디자이너·인사 각 1회 연결", "인사", 3, 14],
  ["w2_win", "'첫 작은 성공' 과제 완료 — 전환형: 소재 1건 라이브 / 광고운영: 계정 감사 / CRM: 세그먼트 1개 실행", "대표", 7, 18],
  ["m1_retro", "Month 1 회고 60~90분 — 35CARD 기반 1:1 (과업·과제 진척 + 기대 vs 실행 갭)", "대표+인사", 25, 38],
  ["m2_auto", "Month 2 자율성 이양 — 주 1회 60분 전환 + ⚠ Gray Area 신호는 반드시 이 시점에 포착", "대표", 35, 58],
  ["m2_retro", "Month 2 회고 — 35CARD 기반 1:1 + 전환 판단 예고 (판단 기준 재고지)", "대표+인사", 55, 68],
  ["m3_judge", "Month 3 첫 주 전환 판단 — 3축 채점 + 최종 질문 → 셀프 리더십 PT로 수료", "대표+인사", 60, 75],
];
// ─── 35CARD: 3대 과업 + 5대 해결과제 (입사 첫날 작성 → 월 1회 1:1 미팅의 기준 문서) ──
const C35_MARKETER_TEMPLATE = {
  tasks: [
    { role: "퍼포먼스 마케팅 및 광고 콘텐츠 운영", detail: "메타·네이버 GFA·클립·토스·틱톡 등 채널별 특성에 맞는 광고 콘텐츠를 기획·제작하고, 소구점별 A/B 테스트와 지표 기반 예산 조정으로 ROAS 지속 개선" },
    { role: "인플루언서·체험단·서포터즈 운영 (소스 확보 허브)", detail: "건강·웰니스·암환우 분야 인플루언서 시딩·공동구매, 레뷰 체험단(베지셀·그린진·숨촉촉)·서포터즈(월 10명)로 후기·UGC 상시 확보 → 광고 소재·상세페이지·매거진 재활용" },
    { role: "온드미디어 운영 및 브랜드 스토리텔링", detail: "인스타그램 정기 운영, 블로그·자사몰 매거진에 암환자·보호자가 신뢰할 스토리텔링 콘텐츠 발행, 자사몰 프로모션 기획으로 유입→구매·상담 전환" },
  ],
  goals: [
    { title: "광고 채널별 고효율 소재 체계 구축 (메타·GFA·클립·토스·틱톡)", vision: "채널별 검증된 소재 포맷 확보, 주력 캠페인 ROAS 손익분기 안정 상회, 저효율 소재 정리 루틴 정착", idea: "채널별 소재 차별화(숏폼 후킹/신뢰형 배너/혜택형) → A/B 테스트 → 예산 재배분. 심의 가이드 준수", when: "입사 ~ 1개월" },
    { title: "레뷰 체험단 정례화 (베지셀·그린진·숨촉촉)", vision: "3개 제품 체험단 월 단위 정례화, 네이버 검색 구좌를 자사 후기가 점유", idea: "제품별 캘린더 → 모집·선정·가이드 프로세스화 → 핵심 키워드 선점형 후기 → 우수 후기 재활용", when: "1~2개월" },
    { title: "서포터즈·인플루언서 소스 파이프라인 구축", vision: "서포터즈 월 10명 안착, UGC 상시 생산, 소스가 광고·매거진·상세페이지로 재활용되는 선순환", idea: "리워드+자율성 설계 → 검증 인플루언서 풀 → 시딩(인지)·공구(매출) 단계 연계", when: "1~3개월" },
    { title: "자사몰 프로모션 기획·운영", vision: "큐라엘몰 월별 프로모션 정례화, 유입→구매 전환·객단가·재구매율 개선", idea: "시즌·출시 연계 캘린더 → 참여형 이벤트·혜택 설계 → 상세페이지 A/B 연계 동선 최적화", when: "2~4개월" },
    { title: "온드미디어·매거진 스토리텔링 체계화", vision: "'암환우 영양 관리는 큐라엘' 신뢰 포지션 형성, 검색·SNS 인지도 성장", idea: "콘텐츠 시리즈 기획(환우 식단 루틴 등) → 인스타=공감형/블로그·매거진=정보형 역할 분담 → 체험단 소스 재가공", when: "3~6개월 (지속)" },
  ],
};
const OB_RETROS = [["m1", "Month 1 회고"], ["m2", "Month 2 회고"], ["m3", "Month 3 회고 (전환 전 최종)"]];
const OB_AXES = [
  ["competence", "역량", "기대치 문서의 Month1~3 기대 수준을 실물로 달성했는가"],
  ["culture", "컬처핏", "기대 행동(나쁜 소식 먼저·24시간 내 도움 요청·고객 중심·2주 실험)을 사례로 적을 수 있는가"],
  ["growth", "성장 속도", "같은 피드백을 반복하게 했는가 — 피드백 후 행동이 바뀌었는가"],
];
const OB_VERDICTS = [["convert", "✅ 전환 확정", "#059669"], ["part", "🤝 이별 (관대한 조건)", "#64748B"], ["gray", "⚠ 애매 → 전환하지 않음", "#D97706"]];
function obDays(startDate) {
  if (!startDate) return null;
  const d = Math.floor((Date.now() - new Date(startDate + "T00:00:00").getTime()) / 86400000);
  return d < 0 ? null : d;
}
function OnboardingView({ candidates, positions, onUpdate, showToast }) {
  const isMobile = useIsMobile();
  const list = candidates.filter(c => c.onboarding || ["합격", "처우협의"].includes(c.stage));
  const [selId, setSelId] = useState(null);
  const [obTab, setObTab] = useState("ms");
  const [c35Edit, setC35Edit] = useState(false);
  const c = list.find(x => x.id === selId) || list[0];
  const removeOb = (x) => {
    if (x.onboarding && !confirm(`${x.name}의 온보딩 기록을 삭제하고 목록에서 뺄까요?`)) return;
    onUpdate(x.id, { onboarding: null });
    if (["합격", "처우협의"].includes(x.stage)) {
      showToast && showToast(`${x.name}은 아직 '${x.stage}' 단계라 목록에 남습니다 — 보드에서 단계를 옮기면 사라져요`);
    } else {
      showToast && showToast(`${x.name} — 온보딩에서 제외됨`);
    }
    if (selId === x.id) setSelId(null);
  };
  const ob = c?.onboarding || {};
  const patch = (p) => c && onUpdate(c.id, { onboarding: { ...ob, ...p } });
  const day = obDays(ob.startDate);
  const msState = (m) => {
    const [key, , , start, due] = m;
    const done = ob.milestones?.[key]?.done;
    if (done) return "done";
    if (day == null) return "upcoming";
    if (day > due) return "overdue";
    if (day >= start) return "current";
    return "upcoming";
  };
  const doneN = OB_MILESTONES.filter(m => ob.milestones?.[m[0]]?.done).length;
  const overdueN = OB_MILESTONES.filter(m => msState(m) === "overdue").length;
  const toggleMs = (key) => {
    const cur = ob.milestones?.[key]?.done;
    patch({ milestones: { ...(ob.milestones || {}), [key]: cur ? { done: false } : { done: true, at: Date.now() } } });
  };
  const setRetro = (rk, field, val) => patch({ retros: { ...(ob.retros || {}), [rk]: { ...(ob.retros?.[rk] || {}), [field]: val, at: Date.now() } } });
  const setTr = (p) => patch({ transition: { ...(ob.transition || {}), ...p, at: Date.now() } });
  const tr = ob.transition || {};
  const c35 = ob.card35 || {};
  const setC35 = (p) => patch({ card35: { ...c35, ...p, at: Date.now() } });
  const setC35Task = (i, f, v) => { const t = [...(c35.tasks || [{}, {}, {}])]; t[i] = { ...(t[i] || {}), [f]: v }; setC35({ tasks: t }); };
  const setC35Goal = (i, f, v) => { const g = [...(c35.goals || [{}, {}, {}, {}, {}])]; g[i] = { ...(g[i] || {}), [f]: v }; setC35({ goals: g }); };
  // 미작성이면 대표 작성본(구글시트 35CARD)을 자동 표시. '수정' 누르는 순간 이 후보 데이터로 저장.
  const c35Filled = !!(c35.tasks || c35.goals);
  const c35v = c35Filled ? c35 : C35_MARKETER_TEMPLATE;
  const startC35Edit = () => {
    if (!c35Filled) setC35({ ...C35_MARKETER_TEMPLATE, tv: (c35.tv || 0) + 1 });
    setC35Edit(true);
  };
  const resetC35Template = () => {
    if (!confirm("작성 내용을 버리고 기본 템플릿(대표 작성본)으로 되돌릴까요?")) return;
    setC35({ ...C35_MARKETER_TEMPLATE, tv: (c35.tv || 0) + 1 });
  };
  const INP = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 10px", fontSize: 12.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const TA = (v, ph, onBlur, rows) => (
    <textarea defaultValue={v || ""} placeholder={ph} rows={rows || 3} onBlur={e => onBlur(e.target.value)}
      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 11px", fontSize: 12.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} />
  );
  const OWNER_COL = { "대표": C.accent, "인사": C.pink, "대표+인사": C.purple };
  if (!list.length) return (
    <div style={{ textAlign: "center", padding: "70px 0", color: C.muted }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.sub }}>온보딩 대상이 없습니다</div>
      <div style={{ fontSize: 12.5, marginTop: 6 }}>보드에서 후보를 <b>처우협의</b> 또는 <b>합격</b> 단계로 이동하면 여기에 나타납니다.<br />온보딩은 돕는 기간이자 검증하는 기간 — 합격 통보 전에 시작 준비를 마치세요.</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {list.map(x => {
          const on = x.id === c.id;
          const xd = obDays(x.onboarding?.startDate);
          return (
            <button key={x.id} onClick={() => { setSelId(x.id); setC35Edit(false); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px 8px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", background: on ? C.glow : C.card, border: `1px solid ${on ? C.accent : C.border}`, color: on ? C.accent : C.sub, fontSize: 13, fontWeight: on ? 700 : 500 }}>
              {x.name} {xd != null ? `· D+${xd}` : "· 시작 전"}
              <span onClick={e => { e.stopPropagation(); removeOb(x); }} title="온보딩에서 제외 (기록 삭제)" style={{ color: C.muted, fontSize: 12, lineHeight: 1, padding: "2px 3px", borderRadius: 5 }}>✕</span>
            </button>
          );
        })}
      </div>
      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{c.name} <span style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>{positions.find(p => p.id === c.positionId)?.name || ""}</span></div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>온보딩 = 돕는 기간 + 검증하는 기간 · 애매하면 전환하지 않는다</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: C.sub }}>입사일{" "}
              <input type="date" value={ob.startDate || ""} onChange={e => patch({ startDate: e.target.value })}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "6px 9px", fontSize: 12.5, fontFamily: "inherit", outline: "none" }} />
            </label>
            {day != null && <span style={{ fontSize: 16, fontWeight: 800, color: C.accent, fontFamily: "'DM Mono',monospace" }}>D+{day}</span>}
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>진행 {doneN}/{OB_MILESTONES.length}</span>
            {overdueN > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: C.red, background: "#FEF2F2", border: `1px solid ${C.red}40`, padding: "3px 10px", borderRadius: 12 }}>⚠ 지연 {overdueN}건 — 인사팀 확인 필요</span>}
            <button onClick={() => removeOb(c)} title="온보딩 기록을 삭제하고 목록에서 제외" style={{ height: 30, padding: "0 11px", borderRadius: 8, background: "transparent", border: `1px solid ${C.red}40`, color: C.red, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✕ 온보딩 제외</button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["ms", "📍 마일스톤 · 기대치"], ["c35", "🗂 35CARD"], ["retro", "🗓 회고 · 전환 판단"]].map(([k, l]) => (
          <button key={k} onClick={() => setObTab(k)} style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${obTab === k ? C.accent : C.border}`, background: obTab === k ? C.glow : C.card, color: obTab === k ? C.accent : C.sub, fontSize: 13, fontWeight: obTab === k ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{l}</button>
        ))}
      </div>
      <div key={c.id}>
        {obTab === "ms" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 10 }}>📍 3개월 마일스톤 <span style={{ fontWeight: 400, fontSize: 11, color: C.muted }}>· 지연(빨강)은 그 주에 반드시 해소</span></div>
            {OB_MILESTONES.map(m => {
              const [key, label, owner] = m;
              const st = msState(m);
              return (
                <div key={key} onClick={() => toggleMs(key)} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: st === "overdue" ? "#FEF2F2" : st === "current" ? C.glow : "transparent", border: `1px solid ${st === "overdue" ? `${C.red}40` : st === "current" ? `${C.accent}30` : "transparent"}`, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, lineHeight: "18px" }}>{st === "done" ? "✅" : st === "overdue" ? "🔴" : "⬜"}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: st === "done" ? C.muted : C.text, lineHeight: 1.55, textDecoration: st === "done" ? "line-through" : "none" }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: OWNER_COL[owner] || C.muted, background: `${OWNER_COL[owner] || C.muted}15`, padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap" }}>{owner}</span>
                  {st === "overdue" && <span style={{ fontSize: 10, fontWeight: 800, color: C.red, whiteSpace: "nowrap" }}>지연</span>}
                </div>
              );
            })}
          </div>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 4 }}>📄 기대치 문서 <span style={{ fontWeight: 400, fontSize: 11, color: C.muted }}>· Day 1에 같이 읽고 합의 — 입력하면 자동 저장</span></div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>기대(리더 작성)는 여기, 실행 계획은 본인이 Week1 안에 회신 — 갭을 첫 주에 가시화</div>
            {TA(ob.expectations?.role, "역할·책임: 이 자리의 미션 / 업무 비율 / 하지 않는 일 (예: 소재 40%·매체 30%·콘텐츠 30%, 팀 관리는 없음)", v => patch({ expectations: { ...(ob.expectations || {}), role: v } }))}
            <div style={{ height: 6 }} />
            {TA(ob.expectations?.m1, "Month 1 기대: 예) 온보딩 완료 + 소재 4건 라이브 + 기존 계정 구조 파악", v => patch({ expectations: { ...(ob.expectations || {}), m1: v } }), 2)}
            <div style={{ height: 6 }} />
            {TA(ob.expectations?.m2, "Month 2 기대: 예) 본인 가설로 소재-성과 루프 1사이클 완주, 수치 보고", v => patch({ expectations: { ...(ob.expectations || {}), m2: v } }), 2)}
            <div style={{ height: 6 }} />
            {TA(ob.expectations?.m3, "Month 3 기대: 예) 주력 채널 1개를 개입 없이 운영 → 전환 판단", v => patch({ expectations: { ...(ob.expectations || {}), m3: v } }), 2)}
          </div>
        </div>
        )}
        {obTab === "c35" && (
        <div style={{ maxWidth: 880 }}>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.sub }}>🗂 35CARD — {c.name}</span>
              <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>· 입사 첫날 리뷰 미팅 → 월 1회 1:1의 기준 문서</span>
              {!c35Edit ? (
                <button onClick={startC35Edit} style={{ padding: "7px 16px", borderRadius: 8, background: `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✎ 수정</button>
              ) : (<>
                <button onClick={resetC35Template} style={{ padding: "6px 11px", borderRadius: 8, background: "transparent", border: `1px solid ${C.borderL}`, color: C.sub, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>템플릿으로 초기화</button>
                <button onClick={() => setC35Edit(false)} style={{ padding: "7px 16px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✓ 완료</button>
              </>)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
              {c35Filled || c35Edit
                ? "3대 과업(역할 정의) + 5대 해결과제(90일 목표) — 입사 첫날 본인과 같이 확정하고, 매월 회고에서 이 카드로 진척 점검"
                : "지금 보이는 내용은 대표님이 작성하신 기준 카드(시트 원본)입니다 — ✎ 수정을 누르면 이 후보 전용으로 저장되고 자유롭게 고칠 수 있습니다"}
            </div>
            {!c35Edit ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, marginBottom: 8 }}>3대 과업</div>
                {(c35v.tasks || []).map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "10px 12px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}` }}>
                    <span style={{ minWidth: 22, height: 22, borderRadius: 6, background: C.glow, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{t.role || "—"}</div>
                      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{t.detail || ""}</div>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, margin: "14px 0 8px" }}>5대 해결과제</div>
                {(c35v.goals || []).map((g, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: "10px 12px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ minWidth: 22, height: 22, borderRadius: 6, background: C.glow, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>{g.title || "—"}</span>
                      {g.when && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.teal, background: `${C.teal}15`, border: `1px solid ${C.teal}35`, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{g.when}</span>}
                    </div>
                    {g.vision && <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginLeft: 30 }}><b style={{ color: C.green }}>달성 모습</b> · {g.vision}</div>}
                    {g.idea && <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginLeft: 30, marginTop: 2 }}><b style={{ color: C.purple }}>방법</b> · {g.idea}</div>}
                  </div>
                ))}
              </div>
            ) : (
            <div key={`c35-${c35.tv || 0}`}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>3대 과업</div>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <input defaultValue={c35.tasks?.[i]?.role || ""} placeholder={`과업 ${i + 1} — 역할 (예: 퍼포먼스 마케팅 및 광고 콘텐츠 운영)`} onBlur={e => setC35Task(i, "role", e.target.value)} style={{ ...INP, fontWeight: 600, marginBottom: 4 }} />
                  {TA(c35.tasks?.[i]?.detail, "핵심 내용 — 무엇을 어떻게 해서 어떤 지표를 움직이는가", v => setC35Task(i, "detail", v), 2)}
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, margin: "12px 0 6px" }}>5대 해결과제</div>
              {[0, 1, 2, 3, 4].map(i => {
                const g = c35.goals?.[i] || {};
                return (
                  <details key={i} open={i === 0} style={{ marginBottom: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 11px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: g.title ? C.text : C.muted }}>
                      과제 {i + 1} · {g.title || "제목 미작성 — 펼쳐서 작성"} {g.when && <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 500 }}>({g.when})</span>}
                    </summary>
                    <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                      <input defaultValue={g.title || ""} placeholder="제목" onBlur={e => setC35Goal(i, "title", e.target.value)} style={{ ...INP, fontWeight: 600 }} />
                      {TA(g.vision, "달성되었을 때 모습 — 무엇이 어떻게 되어 있는가", v => setC35Goal(i, "vision", v), 2)}
                      {TA(g.idea, "해결 아이디어 — 어떤 순서·방법으로", v => setC35Goal(i, "idea", v), 2)}
                      <input defaultValue={g.when || ""} placeholder="시기 (예: 입사 ~ 1개월)" onBlur={e => setC35Goal(i, "when", e.target.value)} style={INP} />
                    </div>
                  </details>
                );
              })}
            </div>
            )}
          </div>
        </div>
        )}
        {obTab === "retro" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {OB_RETROS.map(([rk, label]) => {
            const r = ob.retros?.[rk] || {};
            const filled = r.leader || r.self || r.actions;
            return (
              <div key={rk} style={{ background: C.card, borderRadius: 13, border: `1px solid ${filled ? `${C.green}50` : C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 8 }}>🗓 {label} {filled && <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓ 기록됨</span>}</div>
                {TA(r.leader, "리더: ① 잘하고 있는 것(사례) ② 더 잘할 수 있는 것(사례) ③ 다음 달 새로 시도할 것", v => setRetro(rk, "leader", v))}
                <div style={{ height: 6 }} />
                {TA(r.self, "본인: ① 스스로의 회고 ② 도움이 필요한 것(사람·권한·도구) ③ 회사·리더에게 요청", v => setRetro(rk, "self", v))}
                <div style={{ height: 6 }} />
                {TA(r.actions, "합의한 액션 아이템: 누가 / 무엇을 / 언제까지 (+ 다음 달 기대 수준 조정)", v => setRetro(rk, "actions", v), 2)}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, borderRadius: 13, border: `2px solid ${tr.verdict ? (OB_VERDICTS.find(v => v[0] === tr.verdict)?.[2] || C.border) : C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 3 }}>⚖️ Month 3 전환 판단 <span style={{ fontWeight: 400, fontSize: 11, color: C.muted }}>· Month 3 첫 주에 — 만료 직전이면 늦다</span></div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>최종 질문: &ldquo;이 사람에게 광고비와 브랜드를 믿고 맡기는 모습이 상상되는가?&rdquo;</div>
            {OB_AXES.map(([ak, label, desc]) => (
              <div key={ak} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{label}</span>
                  <span style={{ fontSize: 10.5, color: C.muted, flex: 1 }}>{desc}</span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const on = tr[ak] != null && n <= tr[ak];
                    return <button key={n} onClick={() => setTr({ [ak]: tr[ak] === n ? null : n })} style={{ width: 30, height: 26, borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: on ? C.accent : C.surface, border: `1px solid ${on ? C.accent : C.borderL}`, color: on ? "#fff" : C.sub }}>{n}</button>;
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0 8px" }}>
              {OB_VERDICTS.map(([vk, label, col]) => {
                const on = tr.verdict === vk;
                return <button key={vk} onClick={() => setTr({ verdict: on ? null : vk })} style={{ padding: "8px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: on ? col : C.surface, border: `1px solid ${on ? col : C.borderL}`, color: on ? "#fff" : C.sub }}>{label}</button>;
              })}
            </div>
            {tr.verdict === "gray" && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#D97706", marginBottom: 8 }}>⚠ Gray Area 룰: &lsquo;3개월 더 보자&rsquo;는 결정 회피 — 전환하지 않는 것이 원칙 (관대한 조건으로 이별)</div>}
            {TA(tr.note, "판단 근거 메모: 어떤 사례·기록이 이 판정을 뒷받침하는가", v => setTr({ note: v }), 2)}
          </div>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─── 🎭 면접 시뮬레이션: AI가 지원자 역할 연기 (이력서·경력 그라운딩) ──────────
function SimRoom({ candidate, position, onBack }) {
  const isMobile = useIsMobile();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight); }, [msgs, busy]);
  const bi = CAREER_BUILTIN[(candidate.name || "").trim()];
  const careerTxt = bi ? [bi.header, ...bi.rows.map(r => r.gap ? `(${r.label})` : `${r.company} · ${r.role} · ${r.period} · ${r.dur}${r.work ? ` — ${r.work}` : ""}`), "요약: " + (bi.note || "")].join("\n") : "";
  const kitQs = (kitFor(candidate) || []).map(q => q.text);
  const sysPrompt = `당신은 큐라엘(암 환우·회복기 환자 대상 건강식품 회사, 약사 대표, 마케팅팀 팀원 0명)의 마케터 채용에 지원한 지원자 "${candidate.name}" 역할을 연기합니다. 지원 포지션: ${position?.name || "마케터"}.

[지원자 정보 — 아래 내용만이 사실의 근거입니다]
${bi?.birth ? `출생: ${bi.birth}년생` : ""}${bi?.edu ? ` / 학력: ${bi.edu}` : ""}
경력:
${careerTxt || "(경력 상세 데이터 없음)"}
이력서 요약:
${(candidate.resume || "").slice(0, 1500)}

[연기 규칙 — 반드시 지킬 것]
1. 한국어 존댓말 면접 답변체. 실제 면접자처럼 2~6문장, 근거 있는 수치·사례를 인용.
2. 위 정보에 근거가 있는 내용만 사실처럼 답한다. 근거 없는 내용을 답해야 하면 문장 끝에 "〔추정 — 이력서 근거 없음, 실제 면접에서 확인〕"을 붙인다.
3. 약점 질문(짧은 근속·공백기·연봉 갭·직접 운영 경험 부족 등)에는 실제 지원자들이 흔히 쓰는 방어 패턴으로 현실감 있게 답한다 — 미화하거나 이상적으로 답하지 말 것.
4. 답변 마지막 줄에 "💡면접관 팁: (이 답변에서 파고들 꼬리질문 1개)"를 붙인다.`;
  const ask = async (q) => {
    const text = (q || "").trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "q", text }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const apiMsgs = next.map(m => ({ role: m.role === "q" ? "user" : "assistant", content: m.text }));
      const r = await callAI({ system: sysPrompt, messages: apiMsgs, max_tokens: 1200 });
      const answer = (r?.content || []).map(b => b?.text || "").join("").trim();
      setMsgs(p => [...p, { role: "a", text: answer || "(응답 없음)" }]);
    } catch (e) {
      setMsgs(p => [...p, { role: "a", text: "⚠ AI 호출 실패 — 잠시 후 다시 시도해 주세요" }]);
    }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 13px", color: C.sub, cursor: "pointer", fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap" }}>← 나가기</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🎭 {candidate.name} · 예상 답변 시뮬레이션</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>AI가 이력서·경력만 근거로 지원자를 연기합니다 — 근거 없는 답은 〔추정〕 표시 · <b>실제 면접 대체가 아니라 리허설용</b></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "300px 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 14, maxHeight: isMobile ? 220 : "calc(100vh - 220px)", overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8 }}>📋 킷 질문 — 클릭하면 바로 물어봅니다</div>
          {kitQs.length ? kitQs.map((q, i) => (
            <div key={i} onClick={() => ask(q)} style={{ fontSize: 11.5, color: C.text, lineHeight: 1.5, padding: "7px 9px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 5, cursor: busy ? "wait" : "pointer", opacity: busy ? .5 : 1 }}>{q}</div>
          )) : <div style={{ fontSize: 11.5, color: C.muted }}>킷 질문 없음 — 오른쪽에 직접 입력</div>}
        </div>
        <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16, display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div ref={logRef} style={{ flex: 1, overflowY: "auto", maxHeight: "calc(100vh - 320px)", minHeight: 300, paddingRight: 4 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: "60px 0" }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>🎭</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>왼쪽 킷 질문을 클릭하거나 아래에 질문을 입력하세요</div>
                <div style={{ fontSize: 11.5, marginTop: 5 }}>예: 조건 선고지 반응, 공백기 사유, 연봉 갭 수용 여부를 미리 시험해보세요</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "q" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{ maxWidth: "85%", padding: "9px 13px", borderRadius: m.role === "q" ? "13px 13px 3px 13px" : "13px 13px 13px 3px", background: m.role === "q" ? C.glow : C.surface, border: `1px solid ${m.role === "q" ? `${C.accent}35` : C.border}`, fontSize: 12.5, color: C.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {m.role === "a" && <span style={{ fontWeight: 700, color: C.purple }}>🎭 {candidate.name} · </span>}{m.text}
                </div>
              </div>
            ))}
            {busy && <div style={{ fontSize: 12, color: C.muted, padding: "6px 2px" }}>🎭 {candidate.name} 답변 작성 중...</div>}
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && ask(input)} placeholder="질문 입력 후 Enter (예: 왜 6개월째 쉬고 계신가요?)"
              style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => ask(input)} disabled={busy || !input.trim()} style={{ background: `linear-gradient(135deg,${C.purple},${C.pink})`, border: "none", borderRadius: 9, color: "#fff", padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: (busy || !input.trim()) ? .45 : 1 }}>질문</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Interview Room ───────────────────────────────────────────────────────────
// ─── 면접 조건 기록 (입사 가능 시기·희망 연봉) ─────────────────────────────
const START_PRESETS = ["즉시", "2주 이내", "1개월 이내", "협의 필요"];
const SALARY_PRESETS = ["4,000", "4,500", "5,000", "5,500", "협의"];
function ConditionsCard({ candidate, onUpdate }) {
  const cond = candidate.conditions || {};
  const [custom, setCustom] = useState({ start: "", salary: "" });
  const save = (patch) => onUpdate && onUpdate({ conditions: { ...cond, ...patch, at: Date.now() } });
  const chip = (on) => ({ padding: "5px 11px", borderRadius: 16, border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.glow : C.card, color: on ? C.accent : C.sub, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit" });
  return (
    <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 10 }}>🗓 조건 기록 <span style={{ fontWeight: 400, color: C.muted, fontSize: 11 }}>· 면접 중 클릭해서 기입</span></div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>입사 가능 시기</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {START_PRESETS.map(p => <button key={p} onClick={() => save({ start: cond.start === p ? "" : p })} style={chip(cond.start === p)}>{p}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input value={custom.start} onChange={e => setCustom(s => ({ ...s, start: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && custom.start.trim()) { save({ start: custom.start.trim() }); setCustom(s => ({ ...s, start: "" })); } }} onBlur={() => { if (custom.start.trim()) { save({ start: custom.start.trim() }); setCustom(s => ({ ...s, start: "" })); } }} placeholder="직접 입력 (예: 9월 초) — 입력하면 자동 저장" style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        {cond.start && !START_PRESETS.includes(cond.start) && <span style={{ ...chip(true), cursor: "default" }}>{cond.start}</span>}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>희망 연봉 (만원)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {SALARY_PRESETS.map(p => <button key={p} onClick={() => save({ salary: cond.salary === p ? "" : p })} style={chip(cond.salary === p)}>{p}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={custom.salary} onChange={e => setCustom(s => ({ ...s, salary: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && custom.salary.trim()) { save({ salary: custom.salary.trim() }); setCustom(s => ({ ...s, salary: "" })); } }} onBlur={() => { if (custom.salary.trim()) { save({ salary: custom.salary.trim() }); setCustom(s => ({ ...s, salary: "" })); } }} placeholder="직접 입력 (예: 5,200 또는 4,800~5,300) — 입력하면 자동 저장" style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        {cond.salary && !SALARY_PRESETS.includes(cond.salary) && <span style={{ ...chip(true), cursor: "default" }}>{cond.salary}</span>}
      </div>
      <input value={cond.note || ""} onChange={e => save({ note: e.target.value })} placeholder="조건 메모 (예: 현 직장 인수인계 2주, 스톡옵션 관심)" style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      {(cond.start || cond.salary) && (
        <div style={{ marginTop: 9, fontSize: 12, fontWeight: 600, color: C.green }}>✓ 기록됨 — 입사: {cond.start || "미정"} · 연봉: {cond.salary || "미정"}{cond.salary && !String(cond.salary).includes("협의") && parseInt(String(cond.salary).replace(/[^0-9]/g, "")) > 5500 ? <span style={{ color: C.red, marginLeft: 6 }}>⚠ 상한(5,500) 초과</span> : null}</div>
      )}
    </div>
  );
}

// ─── 녹음 저장 폴더 (File System Access API + IndexedDB 핸들 보관) ─────────────
// 한 번 'Y:\본부\인사\마케터채용\03_면접녹음' 지정해두면 이후 녹음이 그 폴더에 바로 저장됨
function idbKV(mode, key, val) {
  return new Promise((res) => {
    try {
      const rq = indexedDB.open("hirel_fs", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onerror = () => res(null);
      rq.onsuccess = () => {
        try {
          const tx = rq.result.transaction("kv", mode === "get" ? "readonly" : "readwrite");
          const st = tx.objectStore("kv");
          if (mode === "get") { const g = st.get(key); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); }
          else { st.put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => res(null); }
        } catch (e) { res(null); }
      };
    } catch (e) { res(null); }
  });
}
async function ensureRecDirPermission(handle) {
  if (!handle) return false;
  try {
    if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
    return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
  } catch (e) { return false; }
}

// ─── 면접실 이력서 카드: 사람인 형식 경력사항 표 + 원본 PDF 경로 + 원문 ────────
function parseCareerRows(resume) {
  const lines = (resume || "").split("\n");
  const s = lines.findIndex(l => l.trim().startsWith("[경력 이력]"));
  if (s < 0) return null;
  const header = lines[s].replace("[경력 이력]", "").trim();
  const rows = []; let note = "";
  for (let i = s + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("[")) break;
    if (l.startsWith("→")) { note = l.slice(1).trim(); continue; }
    if (!l.startsWith("·")) continue;
    const body = l.slice(1).trim();
    if (body.startsWith("(")) { rows.push({ gap: true, label: body.replace(/^\(|\)$/g, "") }); continue; }
    const parts = body.split("|").map(x => x.trim());
    const dash = (parts[0] || "").split("—").map(x => x.trim());
    rows.push({ company: dash[0] || "", role: dash.slice(1).join(" — "), period: parts[1] || "", dur: parts.slice(2).join(" ") });
  }
  return rows.length ? { header, rows, note } : null;
}
function durMonths(d) {
  const y = /(\d+)\s*년/.exec(d); const m = /(\d+)\s*개월/.exec(d);
  return (y ? +y[1] * 12 : 0) + (m ? +m[1] : 0);
}
// "2026.02" 형식 → 오늘까지 경과 개월 수 (현재 무직 기간 자동 계산)
function monthsSince(ym) {
  const [y, m] = String(ym).split(".").map(Number);
  if (!y || !m) return 0;
  const d = new Date();
  return Math.max(0, (d.getFullYear() - y) * 12 + (d.getMonth() + 1 - m));
}
// 면접 후보 경력사항 내장 데이터 (이력서 PDF 정독 기반) — 이력서 텍스트에 [경력 이력]이 없어도 표시
const CAREER_BUILTIN = {
  "오세현": {
    birth: 1993, edu: "성사고 졸업(문과, 2012) — 프로필상 대학 학력 미기재 · 면접 확인",
    header: "표기 6년 — ⚠ 최근 3개사 연속 단기",
    rows: [
      { current: true, company: "현재 무직", role: "오비랩 퇴사 후 구직 중", since: "2026.02" },
      { company: "오비랩(OviLab)", role: "Growth & Tech Lead", period: "2025.06~2026.02", dur: "9개월 ⚠", work: "AI 소재 제작(CTR 2.5배)·ROAS 1,928%·광고비 -63%, 리뷰 1만건 마이닝→카피, 로컬 LLM 에이전트 자작" },
      { gap: true, label: "공백 2025.03~2025.06 · 3개월" },
      { company: "비오스드림", role: "Growth Marketing Lead", period: "2024.02~2025.03", dur: "1년 1개월", work: "B2B→D2C 피봇 주도(매출 12배 주장 — 수치 검증 필요), 테크니컬 SEO 인프라, CRM 리텐션 루프" },
      { company: "아이마이미마인(IMYMEMINE)", role: "Commerce Operation Manager", period: "2023.10~2024.02", dur: "5개월 ⚠", work: "고관여 커머스 운영 — BigQuery 퍼널 분석으로 상세페이지 이탈 95% 병목 발견→CVR 2.5배" },
      { company: "대한금융지원센터", role: "Digital Marketer", period: "2019.11~2023.10", dur: "4년 ★", work: "디지털 마케팅 — GA4·SQL 데이터 리드 확보, 반복 리포팅 100% 자동화" },
    ],
    note: "안정 근속은 첫 회사 4년뿐. 이후 5개월→1년1개월→9개월 반복 — 면접 검증 1순위",
  },
  "박현철": {
    birth: 1990, edu: "중앙대학교 광고홍보학 학사 (2009~2018)",
    header: "총 9년 (8개사) — ⚠ 단기 3회 + 현직 7개월째 이직 시도",
    rows: [
      { company: "Anti-aging Club", role: "팀장 / 헬스케어", period: "2025.11~재직중", dur: "7개월", work: "헬스케어 브랜드 마케팅 총괄 — 광고→상담→재방문 풀퍼널, 의료광고 심의 리스크 대응, Moloco 테스트" },
      { company: "(주)버핏서울", role: "영업기획실 / 마케팅 PM", period: "2022.09~2025.11", dur: "3년 3개월 ★", work: "월 1억+ 셀프서브 직접 운영, 분기 매출 목표 7회 초과, CAC/LTV·코호트·UTM 체계 구축" },
      { company: "Biginsight", role: "팀장 / Adops", period: "2022.05~2022.08", dur: "4개월 ⚠", work: "광고 운영(Adops) 팀장" },
      { company: "taggers.io", role: "Business Group Leader", period: "2020.07~2022.05", dur: "1년 11개월", work: "광고 CRM SaaS — 솔루션 기획·상품 세일즈·어카운트 매니징 총괄" },
      { company: "(주)세븐헌드레드", role: "캠페인팀 대리", period: "2020.04~2020.06", dur: "3개월 ⚠", work: "광고 캠페인 운영" },
      { company: "(주)에코마케팅", role: "계약직 / 구글전문그룹", period: "2019.05~2019.11", dur: "7개월", work: "구글 광고 전문그룹 — 월 30억 규모 대행 구조 경험" },
      { company: "HS애드 · 한컴", role: "인턴 2회", period: "2014.03~2015.06", dur: "8개월·4개월", work: "광고 대행 인턴 (MMS·캠페인)" },
    ],
    note: "버핏서울 3년3개월(분기 목표 7회 초과)이 유일한 장기. 3·4·7개월 단기 사유를 개별 확인",
  },
  "이찬우": {
    birth: 1990, edu: "학점은행제 경영학 학사(2022) · 청강문화산업대 이동통신 전문학사",
    header: "6년 (마케팅 실질 약 6년 3개월) — ✅ 4인 중 근속 최상",
    rows: [
      { company: "앨트웰(주)", role: "마케팅 (건기식·생활용품·다이어트)", period: "2023.03~재직중", dur: "3년 6개월 ★", work: "프로모션 기획~손익·매출 분석(누적 28.31억), 교육·홍보 영상 200편+, 오픈톡·밴드 커뮤니티 운영, AI 소재 실무 적용" },
      { gap: true, label: "공백 2022.07~2023.03 · 8개월" },
      { company: "(주)앤알커뮤니케이션", role: "마케팅기획 (화장품·이너뷰티)", period: "2019.11~2022.07", dur: "2년 9개월", work: "신규 사업 TF — 카페·숙박 그랜드 오픈 이벤트, 인플루언서·리뷰 110건+ 유치, 동종업계 정기 리포트 24회+" },
      { company: "(주)삼구아이앤씨", role: "유지보수팀 (비마케팅)", period: "2018.03~2019.06", dur: "1년 4개월", work: "SK하이닉스 협력사 — 반도체 장비 유지보수" },
      { company: "(주)엘지유플러스", role: "영업 (비마케팅)", period: "2014.11~2016.11", dur: "2년 1개월", work: "유·무선 영업, 회원 보상플랜 개정 TFT" },
    ],
    note: "마케팅 경력 전체가 2~3년대 안정 근속. 공백 8개월(2022)만 확인",
  },
  "박보현": {
    birth: 1995, edu: "미국 Univ. of Illinois Urbana-Champaign (Tilton School — 유학 약 10년)",
    header: "3년 (3개사) — 모두 1년 이상, 조기 이탈 패턴 없음",
    rows: [
      { company: "Treasurer", role: "IMC 마케팅·서비스기획", period: "2024.12~재직중", dur: "1년 8개월", work: "온보딩~리텐션 퍼널 재정의, RFM·K-Means 세그먼트, SQL·Looker 대시보드, Make·n8n 자동화" },
      { company: "NextPaper M&C", role: "디지털 마케팅", period: "2023.03~2024.12", dur: "1년 10개월", work: "디지털 IMC 전략·Paid Media, SEO/SEM, 세타필(더마) 캠페인 운영" },
      { company: "FROMHERAS", role: "전략기획", period: "2022.02~2023.03", dur: "1년 1개월", work: "수입·물류 ERP 구축, 상품·서비스 기획" },
    ],
    note: "연차는 짧지만 근속 리듬은 건강. 직전·현직 연속(이직 준비 겹침 여부만 확인)",
  },
};
// 회사명 → 사람인 기업정보 검색 (재무 정보는 검색 결과에서 회사 클릭 → 기업정보·재무 탭)
const saraminCompanyUrl = (name) => {
  const clean = (name || "").replace(/\(주\)|㈜/g, "").split("(")[0].split("·")[0].trim();
  return clean ? `https://www.saramin.co.kr/zf_user/search/company?searchword=${encodeURIComponent(clean)}` : null;
};
function InterviewResumeCard({ candidate }) {
  const [copied, setCopied] = useState(null);
  const career = parseCareerRows(candidate.resume) || CAREER_BUILTIN[(candidate.name || "").trim()] || null;
  const refs = candidate.fileRefs || [];
  const meta = {};
  (candidate.resume || "").split("\n").forEach(l => {
    const m = /^\[(최근 경력|연봉|리스크)\]\s*(.+)/.exec(l.trim());
    if (m) meta[m[1]] = m[2];
  });
  const copy = async (r) => { try { await navigator.clipboard.writeText(r.path || r.name); setCopied(r.name); setTimeout(() => setCopied(null), 1600); } catch (e) {} };
  const cell = { padding: "6px 8px", fontSize: 11.5, borderBottom: `1px solid ${C.border}`, verticalAlign: "top", color: C.text, textAlign: "left" };
  return (
    <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 6 }}>📄 이력서 · 경력사항 <span style={{ fontWeight: 400, fontSize: 10.5, color: C.muted }}>· 면접실에서 바로 확인</span></div>
      {(() => {
        const bi = CAREER_BUILTIN[(candidate.name || "").trim()];
        const birth = bi?.birth;
        const edu = bi?.edu;
        if (!birth && !edu && !candidate.age) return null;
        const chip = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: C.text, background: C.surface, border: `1px solid ${C.border}`, padding: "3px 9px", borderRadius: 9 };
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
            {birth ? <span style={chip}>🎂 {birth}년생 · 만 {new Date().getFullYear() - birth}세</span>
              : candidate.age ? <span style={chip}>🎂 {candidate.age}세</span> : null}
            {edu && <span style={{ ...chip, maxWidth: "100%" }}>🎓 {edu}</span>}
          </div>
        );
      })()}
      {meta["최근 경력"] && <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 8, lineHeight: 1.5 }}>{meta["최근 경력"]}{meta["연봉"] ? ` · 연봉 ${meta["연봉"]}` : ""}</div>}
      {career ? (<>
        {career.header && <div style={{ fontSize: 11, fontWeight: 700, color: career.header.includes("⚠") ? C.red : career.header.includes("✅") ? C.green : C.muted, marginBottom: 6 }}>{career.header}</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <thead><tr>
            <th style={{ ...cell, color: C.muted, fontSize: 10.5, fontWeight: 600 }}>회사 / 직무</th>
            <th style={{ ...cell, color: C.muted, fontSize: 10.5, fontWeight: 600, textAlign: "center", width: 104 }}>재직기간</th>
            <th style={{ ...cell, color: C.muted, fontSize: 10.5, fontWeight: 600, textAlign: "center", width: 70 }}>근속</th>
          </tr></thead>
          <tbody>
            {career.rows.map((r, i) => r.gap ? (
              <tr key={i}><td colSpan={3} style={{ ...cell, color: C.amber, fontStyle: "italic", fontSize: 10.5 }}>… {r.label}</td></tr>
            ) : r.current ? (
              <tr key={i} style={{ background: "#FEF2F2" }}>
                <td style={cell}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: C.red }}>⚠ {r.company}</span>
                  {r.role && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{r.role}</div>}
                </td>
                <td style={{ ...cell, textAlign: "center", fontSize: 10.5, whiteSpace: "nowrap", color: C.sub }}>{r.since}~현재</td>
                <td style={{ ...cell, textAlign: "center" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}35`, padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>공백 {monthsSince(r.since)}개월</span>
                </td>
              </tr>
            ) : (
              <tr key={i}>
                <td style={cell}>
                  {saraminCompanyUrl(r.company)
                    ? <a href={saraminCompanyUrl(r.company)} target="_blank" rel="noreferrer" title="사람인 기업정보(재무·연봉) 검색으로 열기" style={{ fontWeight: 700, fontSize: 12, color: C.accent, textDecoration: "none" }}>{r.company} ↗</a>
                    : <span style={{ fontWeight: 700, fontSize: 12 }}>{r.company}</span>}
                  {r.role && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{r.role}</div>}
                  {r.work && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{r.work}</div>}
                </td>
                <td style={{ ...cell, textAlign: "center", fontSize: 10.5, whiteSpace: "nowrap", color: C.sub }}>{r.period}</td>
                <td style={{ ...cell, textAlign: "center" }}>{(() => {
                  const mo = durMonths(r.dur);
                  const warn = r.dur.includes("⚠") || (mo > 0 && mo < 12);
                  const good = r.dur.includes("★") || r.period.includes("재직");
                  const col = warn ? C.red : good ? C.green : C.sub;
                  return <span style={{ fontSize: 10.5, fontWeight: 700, color: col, background: `${col}12`, border: `1px solid ${col}35`, padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>{r.dur.replace(/[⚠★]/g, "").replace(/퇴사.*$/, "").trim() || "-"}</span>;
                })()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {career.note && <div style={{ fontSize: 11, color: "#B45309", background: "#FFF7E0", border: "1px solid #F1E2B6", borderRadius: 7, padding: "6px 9px", lineHeight: 1.5, marginBottom: 8 }}>💡 {career.note}</div>}
      </>) : (
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>경력 이력 데이터 없음 — 아래 원문·원본 파일 참조</div>
      )}
      {refs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {refs.map((r, i) => (
            <button key={i} onClick={() => copy(r)} title={r.path || r.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: copied === r.name ? C.green : C.sub, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", maxWidth: "100%" }}>
              📎 <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{r.name}</span>{copied === r.name ? " ✓ 경로 복사됨" : ""}
            </button>
          ))}
          <span style={{ fontSize: 10, color: C.muted, alignSelf: "center" }}>클릭=경로 복사 → 탐색기/브라우저에 붙여넣어 원본 PDF 열기</span>
        </div>
      )}
      {candidate.resume && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: C.accent }}>제출된 이력서 원문 보기</summary>
          <div style={{ marginTop: 6, padding: "9px 11px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11.5, color: C.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>{candidate.resume}</div>
        </details>
      )}
    </div>
  );
}

function InterviewRoom({ candidate, position, onBack, onFinish, onUpdate }) {
  const isMobile = useIsMobile();
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
  // ─── 음성 파일 녹음 (STT와 병행, 중지 시 .webm 자동 다운로드) ────────────────
  const mediaRecRef = useRef(null);
  const recChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState("");
  const [audioSaving, setAudioSaving] = useState(false);
  const [recDirName, setRecDirName] = useState("");
  const [savedWhere, setSavedWhere] = useState("");
  const recDirRef = useRef(null);
  useEffect(() => { idbKV("get", "recDir").then(h => { if (h) { recDirRef.current = h; setRecDirName(h.name); } }); }, []);
  const pickRecFolder = async () => {
    try {
      if (!window.showDirectoryPicker) { alert("이 브라우저는 폴더 저장을 지원하지 않습니다 (Chrome/Edge 데스크톱 필요). 녹음은 다운로드 폴더에 저장됩니다."); return; }
      const h = await window.showDirectoryPicker({ mode: "readwrite" });
      recDirRef.current = h; setRecDirName(h.name);
      await idbKV("set", "recDir", h);
    } catch (e) { /* 사용자가 취소 */ }
  };
  const startAudioRec = async () => {
    try {
      // 녹음 시작 시(사용자 클릭 제스처 안에서) 폴더 권한 미리 확보
      if (recDirRef.current) await ensureRecDirPermission(recDirRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        try {
          const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
          if (blob.size > 2000) {
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const fname = `면접녹음_${candidate.name}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.webm`;
            setAudioUrl(p => { if (p) URL.revokeObjectURL(p); return url; });
            setAudioName(fname);
            // 1순위: 지정 폴더(Y:\...\03_면접녹음)에 직접 저장 / 실패 시 다운로드 폴백
            let saved = false;
            const dir = recDirRef.current;
            if (dir && await ensureRecDirPermission(dir)) {
              try {
                const fh = await dir.getFileHandle(fname, { create: true });
                const w = await fh.createWritable();
                await w.write(blob); await w.close();
                saved = true;
                setSavedWhere(`${dir.name} 폴더에 저장됨`);
              } catch (e) { console.warn("폴더 저장 실패 → 다운로드 폴백", e); }
            }
            if (!saved) {
              const a = document.createElement("a");
              a.href = url; a.download = fname; a.click();
              setSavedWhere("다운로드 폴더에 저장됨 — Y:\\본부\\인사\\마케터채용\\03_면접녹음\\으로 이동 보관");
            }
          }
        } catch (e) { console.error(e); }
        audioStreamRef.current?.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
        setAudioSaving(false);
      };
      mr.start(1000);
      mediaRecRef.current = mr;
      setAudioSaving(true);
    } catch (e) { console.warn("음성 녹음 불가(권한 거부?) — 녹취록만 진행", e); }
  };
  const stopAudioRec = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    mediaRecRef.current = null;
  };
  const timerRef = useRef(null);
  const txRef = useRef("");
  const scoringRef = useRef(false);
  const lastScoredRef = useRef(0);
  useEffect(() => { txRef.current = transcript; }, [transcript]);
  useEffect(() => { scoringRef.current = scoring; }, [scoring]);

  // ─── 질문별 채점 상태 ──────────────────────────────────────────────────────
  const qSections = buildQuestionSections(candidate);
  const qList = qSections.flatMap(s => s.items.map(it => ({ key: it.key, text: it.text })));
  const qListRef = useRef(qList);
  useEffect(() => { qListRef.current = qList; });
  const qScoresRef = useRef(candidate.questionScores || {});
  useEffect(() => { qScoresRef.current = candidate.questionScores || {}; }, [candidate.questionScores]);
  const [openQ, setOpenQ] = useState(null);
  const [addQInputs, setAddQInputs] = useState({});

  const patchQScores = (mut) => {
    const next = { ...qScoresRef.current };
    mut(next);
    qScoresRef.current = next;
    onUpdate && onUpdate({ questionScores: next });
  };
  const setManualScore = (key, val) => patchQScores(n => {
    const prev = n[key] || { manual: null, ai: null, aiEvidence: null, note: "" };
    n[key] = { ...prev, manual: val };
  });
  const setQNote = (key, note) => patchQScores(n => {
    const prev = n[key] || { manual: null, ai: null, aiEvidence: null, note: "" };
    n[key] = { ...prev, note };
  });
  const setQSignal = (key, signal) => patchQScores(n => {
    const prev = n[key] || { manual: null, ai: null, aiEvidence: null, note: "" };
    n[key] = { ...prev, signal };
  });
  const addCustomQ = (secKey) => {
    const text = (addQInputs[secKey] || "").trim();
    if (!text || !onUpdate) return;
    const cq = { ...(candidate.customQuestions || {}) };
    cq[secKey] = [...(cq[secKey] || []), { id: Date.now().toString(36), text }];
    onUpdate({ customQuestions: cq });
    setAddQInputs(p => ({ ...p, [secKey]: "" }));
  };
  const delCustomQ = (secKey, id) => {
    if (!onUpdate || id == null) return;
    const cq = { ...(candidate.customQuestions || {}) };
    cq[secKey] = (cq[secKey] || []).filter(x => x.id !== id);
    const next = { ...qScoresRef.current };
    delete next[`${secKey}-c${id}`];
    qScoresRef.current = next;
    onUpdate({ customQuestions: cq, questionScores: next });
  };

  const doScore = async (tx) => {
    if (!tx || tx.trim().split(" ").length < 15 || scoringRef.current) return;
    if (tx.length - lastScoredRef.current < 80) return;
    scoringRef.current = true;
    setScoring(true);
    try {
      const r = await scoreInterview(position?.jd || "", candidate.name, tx, candidate.analysis?.interviewQuestions, qListRef.current);
      setLiveScore(r);
      setHistory(p => [...p.slice(-19), { score: r.liveScore }]);
      lastScoredRef.current = tx.length;
      setLastScoredLen(tx.length);
      // 질문별 AI 점수 병합 (수동 점수는 절대 덮지 않음)
      if (Array.isArray(r.questionScores) && r.questionScores.length && onUpdate) {
        const valid = new Set(qListRef.current.map(q => q.key));
        patchQScores(n => {
          r.questionScores.forEach(s => {
            if (!s || !valid.has(s.key)) return;
            const sc5 = Math.round(Number(s.score));
            if (!(sc5 >= 1 && sc5 <= 5)) return;
            const prev = n[s.key] || { manual: null, ai: null, aiEvidence: null, note: "" };
            n[s.key] = { ...prev, ai: sc5, aiEvidence: (s.evidence ? String(s.evidence).slice(0, 200) : prev.aiEvidence) || null };
          });
        });
      }
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
        clearTimeout(silenceId);
        silenceId = setTimeout(() => { doScore(txRef.current); }, 4000);
      }
      setInterim(int);
    };
    r.onend = () => { if (recogRef.current === r) r.start(); };
    r.start(); recogRef.current = r; setRecording(true);
    startAudioRec();
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
  };
  const stop = () => {
    recogRef.current?.stop(); recogRef.current = null;
    stopAudioRec();
    clearInterval(timerRef.current);
    setRecording(false); setInterim("");
    if (txRef.current.trim().length > 30) doScore(txRef.current);
  };
  const addNote = () => { if (!noteInput.trim()) return; setNotes(p => [...p, { text: noteInput, t: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) }]); setNoteInput(""); };
  useEffect(() => () => { recogRef.current?.stop(); clearInterval(timerRef.current); try { if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop(); } catch (e) {} audioStreamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const IS = { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const BP = (bg) => ({ background: bg || `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, rowGap: 10, marginBottom: 22 }}>
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
            <button onClick={() => exportCandidatePDF(candidate, position)} style={{ ...BP(`linear-gradient(135deg,#64748B,#475569)`), display: "flex", alignItems: "center", gap: 7 }}>
              📄 PDF 저장</button>
          )}
          <button onClick={() => { if (recording) stop(); onFinish && onFinish(transcript); }} style={{ ...BP(`linear-gradient(135deg,${C.purple},${C.pink})`), display: "flex", alignItems: "center", gap: 7 }}>
            🏁 면접 종료 · 평가</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 370px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <EvpScriptCard />
          <GrayAreaBanner candidate={candidate} />
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>💬 면접 질문 · 클릭해서 채점 + 답변 판정(✅/⚠/❌)</span>
              <span style={{ fontSize: 11, color: C.muted }}>총 {qList.length}개</span>
            </div>
            {qSections.map(sec => (
              <div key={sec.secKey} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sec.color, marginBottom: 7, padding: "3px 8px", background: `${sec.color}15`, borderRadius: 6, display: "inline-block" }}>{sec.label}</div>
                {sec.items.map(it => (
                  <QuestionRow key={it.key} item={it} color={sec.color}
                    entry={(candidate.questionScores || {})[it.key]}
                    open={openQ === it.key}
                    onToggle={() => setOpenQ(p => p === it.key ? null : it.key)}
                    onManual={v => setManualScore(it.key, v)}
                    onNote={note => setQNote(it.key, note)}
                    onSignal={sig => setQSignal(it.key, sig)}
                    onDelete={() => delCustomQ(sec.secKey, it.id)} />
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input value={addQInputs[sec.secKey] || ""}
                    onChange={e => { const v = e.target.value; setAddQInputs(p => ({ ...p, [sec.secKey]: v })); }}
                    onKeyDown={e => e.key === "Enter" && addCustomQ(sec.secKey)}
                    placeholder="+ 이 섹션에 질문 추가..."
                    style={{ flex: 1, background: C.card, border: `1px dashed ${C.borderL}`, borderRadius: 7, color: C.text, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  <button onClick={() => addCustomQ(sec.secKey)}
                    style={{ background: `${sec.color}15`, border: `1px solid ${sec.color}40`, borderRadius: 7, color: sec.color, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: (addQInputs[sec.secKey] || "").trim() ? 1 : .45 }}>추가</button>
                </div>
              </div>
            ))}
            {liveScore?.nextQuestion && <div style={{ marginTop: 9, padding: "9px 12px", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.3)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: C.purple, fontWeight: 600 }}>✨ AI 추천 다음 질문</span>
              <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>{liveScore.nextQuestion}</div>
            </div>}
          </div>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${recording ? "rgba(59,130,246,.35)" : C.border}`, padding: 18, flex: 1, transition: "border-color .3s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>🎙 실시간 녹취록</span>
                {recording && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, animation: "pulse 1.2s ease infinite" }} />}
                {audioSaving && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.red, background: "#FEF2F2", border: `1px solid ${C.red}35`, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>● 음성 파일 녹음 중 — 중지하면 자동 저장</span>}
                <button onClick={pickRecFolder} title="녹음 파일을 저장할 폴더 지정 — Y:\본부\인사\마케터채용\03_면접녹음 권장" style={{ fontSize: 10.5, fontWeight: 600, color: recDirName ? C.green : C.sub, background: "transparent", border: `1px solid ${recDirName ? `${C.green}45` : C.borderL}`, padding: "2px 9px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>📁 {recDirName ? `저장: ${recDirName}` : "저장 폴더 지정"}</button>
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => doScore(transcript)} disabled={scoring || !transcript} style={{ ...BP(), padding: "5px 12px", fontSize: 12, opacity: (!transcript || scoring) ? .4 : 1 }}>{scoring ? "평가 중..." : "⚡ 지금 평가"}</button>
                <button onClick={() => { setTranscript(""); setInterim(""); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 9px", color: C.sub, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>초기화</button>
              </div>
            </div>
            {audioUrl && (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 11px", background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 9, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>🎧 녹음 파일 저장됨</span>
                <audio controls src={audioUrl} style={{ height: 30, flex: 1, minWidth: 160 }} />
                <a href={audioUrl} download={audioName} style={{ fontSize: 11, fontWeight: 700, color: C.accent, textDecoration: "none", whiteSpace: "nowrap", border: `1px solid ${C.accent}40`, borderRadius: 7, padding: "4px 10px", background: C.glow }}>다시 다운로드</a>
                <span style={{ fontSize: 10, color: C.muted, width: "100%" }}>{audioName} — {savedWhere || "저장됨"} · (녹음 사실은 면접자에게 사전 고지)</span>
              </div>
            )}
            <div style={{ minHeight: 180, maxHeight: 280, overflowY: "auto" }}>
              {transcript ? <p style={{ fontSize: 14, color: C.text, lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>{transcript}<span style={{ color: C.muted, fontStyle: "italic" }}>{interim}</span></p>
                : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, gap: 9 }}>
                  <div style={{ fontSize: 30, opacity: .25 }}>🎤</div>
                  <span style={{ fontSize: 13, color: C.muted }}>{recording ? "말씀하시면 자동으로 텍스트가 기록됩니다" : "녹음을 시작하세요"}</span>
                </div>}
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
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
          <ConditionsCard candidate={candidate} onUpdate={onUpdate} />
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
          <InterviewResumeCard candidate={candidate} />
          {history.length > 1 && (
            <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
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
            <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 12 }}>📋 사전 이력서 분석</div>
              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
                <Ring score={candidate.analysis.scores.experienceMatch} size={50} stroke={4} color={C.accent} label="경험" />
                <Ring score={candidate.analysis.scores.cultureFit} size={50} stroke={4} color={C.teal} label="문화" />
                <Ring score={candidate.analysis.scores.skillKeywords} size={50} stroke={4} color={C.green} label="역량" />
                <Ring score={candidate.analysis.scores.stability} size={50} stroke={4} color={C.amber} label="안정성" />
                <Ring score={candidate.analysis.scores.portfolioMatch} size={50} stroke={4} color={C.purple} label="포트폴리오" />
                <Ring score={candidate.analysis.scores.growthPotential} size={50} stroke={4} color={C.pink} label="성장" />
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 10px 40px rgba(0,0,0,.12)", padding: 28, width: 520, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{existing ? "포지션 수정" : "새 포지션 추가"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 6 }}>포지션명</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 마케터, 데이터 사이언티스트" style={{ ...IS, marginBottom: 16 }} />
        <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 6 }}>색상 태그</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {ROLE_COLORS.map((rc, i) => (
            <div key={i} onClick={() => setColorIdx(i)} style={{ width: 28, height: 28, borderRadius: "50%", background: rc.accent, cursor: "pointer", border: `3px solid ${colorIdx === i ? "#111827" : "transparent"}`, transition: "all .2s", boxShadow: colorIdx === i ? `0 0 10px ${rc.accent}66` : "none" }} />
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

// ─── Decision / 합의 Room ──────────────────────────────────────────────────────
function DecisionRoom({ candidate, position, isHost, roomId, syncEnabled, genLoading, onSaveFinal, onBack, showToast }) {
  const dcMobile = useIsMobile();
  const fb = candidate.interviewFeedback;
  const a = candidate.analysis;
  const rc = ROLE_COLORS[position?.colorIdx || 0];
  const BP = (bg) => ({ background: bg || `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const IS = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const Card = { background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 18 };

  const [ev, setEv] = useState({ id: "", name: "" });
  const [nameInput, setNameInput] = useState("");
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState("");
  const [evals, setEvals] = useState({});
  const pollRef = useRef(null);
  const lastSavedRef = useRef("");

  useEffect(() => { const e = getEvaluator(); setEv(e); setNameInput(e.name || ""); }, []);

  const fetchEvals = async () => {
    if (!syncEnabled || !roomId) return;
    try {
      const r = await fetch(`/api/eval?roomId=${roomId}&candidateId=${candidate.id}`);
      if (r.ok) {
        const d = await r.json();
        const clean = {};
        Object.entries(d || {}).forEach(([k, v]) => { if (v && typeof v === "object" && ["합격", "보류", "불합격"].includes(v.decision)) clean[k] = v; });
        setEvals(clean);
      }
    } catch (e) { console.error("평가 불러오기 실패:", e); }
  };
  useEffect(() => {
    if (syncEnabled && roomId) { fetchEvals(); pollRef.current = setInterval(fetchEvals, 2500); return () => clearInterval(pollRef.current); }
  }, [syncEnabled, roomId, candidate.id]);

  useEffect(() => { const mine = evals[ev.id]; if (mine) { setDecision(d => d || mine.decision); setComment(c => c || mine.comment || ""); } }, [evals, ev.id]);

  const submit = async () => {
    if (!decision) { showToast("합격 / 보류 / 불합격 중 하나를 선택하세요", "error"); return; }
    const name = (nameInput || "면접관").trim();
    setEvaluatorName(name);
    const payload = { name, decision, comment: (comment || "").trim(), ts: Date.now() };
    if (syncEnabled && roomId) {
      try {
        const r = await fetch(`/api/eval?roomId=${roomId}&candidateId=${candidate.id}&evaluatorId=${ev.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || ("HTTP " + r.status)); }
        setEvals(prev => ({ ...prev, [ev.id]: payload }));
        showToast("평가 제출 완료"); fetchEvals();
      } catch (e) { console.error(e); showToast("제출 실패: " + e.message, "error"); }
    } else {
      const newEvals = { ...evals, [ev.id]: payload };
      setEvals(newEvals);
      const av = (fb && fb.aiVerdict) ? { name: "AI 면접관", decision: fb.aiVerdict, comment: fb.oneliner || fb.summary || "", ts: 0 } : null;
      onSaveFinal(candidate.id, buildFinal(newEvals, av));
    }
  };

  const aiVote = (fb && fb.aiVerdict) ? { name: "AI 면접관", decision: fb.aiVerdict, comment: fb.oneliner || fb.summary || "", ts: 0 } : null;
  const boardEvals = aiVote ? { ...evals, __ai__: aiVote } : { ...evals };
  const { tally, total } = tallyDecisions(boardEvals);
  const result = decideResult(evals, aiVote);
  const rows = Object.entries(boardEvals).map(([id, v]) => ({ id, ...v, isAI: id === "__ai__" })).sort((x, y) => (x.isAI ? -1 : y.isAI ? 1 : (x.ts || 0) - (y.ts || 0)));
  // 표가 바뀌면 후보 카드(finalDecision)를 자동 최신화 — 단독이거나 방장만 저장 가능
  const liveSig = `${result}|${total}|${tally.합격}|${tally.보류}|${tally.불합격}`;
  const savedSig = candidate.finalDecision ? `${candidate.finalDecision.result}|${candidate.finalDecision.total}|${candidate.finalDecision.tally?.합격 || 0}|${candidate.finalDecision.tally?.보류 || 0}|${candidate.finalDecision.tally?.불합격 || 0}` : "";
  useEffect(() => {
    if (!isHost || total === 0) return;
    if (liveSig === savedSig || liveSig === lastSavedRef.current) return;
    lastSavedRef.current = liveSig;
    onSaveFinal(candidate.id, buildFinal(evals, aiVote));
  }, [liveSig, savedSig, isHost, total]);
  const rs = DEC_STYLE[result] || DEC_STYLE.보류;
  const fd = candidate.finalDecision;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, rowGap: 10, marginBottom: 22 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 13px", color: C.sub, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← 나가기</button>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${rc.accent}25`, border: `1px solid ${rc.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: rc.accent }}>{candidate.name[0]}</div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{candidate.name} · 면접 결과</h2>
          <span style={{ fontSize: 12, color: C.sub }}>{position?.name} · {syncEnabled ? "실시간 공동 평가" : "단독 평가"}</span>
        </div>
        {fd && <div style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 16, fontSize: 13, fontWeight: 700, background: (DEC_STYLE[fd.result] || rs).bg, border: `1px solid ${(DEC_STYLE[fd.result] || rs).b}`, color: (DEC_STYLE[fd.result] || rs).c }}>확정: {fd.result}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: dcMobile ? "1fr" : "1fr 380px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={Card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 14 }}>🤖 AI 종합 피드백</div>
            {genLoading ? <Spin label="AI가 면접 전체를 종합 분석 중..." />
              : fb ? (<>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <Ring score={fb.aiScore} size={72} stroke={6} color={(DEC_STYLE[fb.aiVerdict] || {}).c || C.accent} />
                  <div>
                    <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 14, fontSize: 13, fontWeight: 700, background: (DEC_STYLE[fb.aiVerdict] || {}).bg, border: `1px solid ${(DEC_STYLE[fb.aiVerdict] || {}).b}`, color: (DEC_STYLE[fb.aiVerdict] || {}).c }}>AI 추천: {fb.aiVerdict}</div>
                    {fb.oneliner && <div style={{ fontSize: 13, color: C.sub, marginTop: 8, fontStyle: "italic" }}>"{fb.oneliner}"</div>}
                  </div>
                </div>
                {fb.summary && <div style={{ padding: "11px 13px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, lineHeight: 1.7, marginBottom: 14 }}>{fb.summary}</div>}
                {fb.strengths?.length > 0 && <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 7 }}>✓ 강점</div>
                  {fb.strengths.map((s, i) => <div key={i} style={{ fontSize: 13, color: C.sub, padding: "6px 11px", background: "rgba(16,185,129,.06)", borderRadius: 6, border: "1px solid rgba(16,185,129,.2)", marginBottom: 5 }}>{s}</div>)}
                </div>}
                {fb.concerns?.length > 0 && <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 7 }}>△ 우려</div>
                  {fb.concerns.map((s, i) => <div key={i} style={{ fontSize: 13, color: C.sub, padding: "6px 11px", background: "rgba(245,158,11,.06)", borderRadius: 6, border: "1px solid rgba(245,158,11,.2)", marginBottom: 5 }}>{s}</div>)}
                </div>}
              </>) : <div style={{ textAlign: "center", padding: "26px 0", color: C.muted, fontSize: 13, lineHeight: 1.7 }}>면접 화면에서 <b style={{ color: C.sub }}>🏁 면접 종료</b>를 누르면<br />전체 녹취록 기반 AI 종합 피드백이 생성됩니다</div>}
          </div>
          <QuestionScoreSummary candidate={candidate} />
          {a && <div style={Card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 12 }}>📋 사전 이력서 분석</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Ring score={a.totalScore} size={56} stroke={5} color={rc.accent} />
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{a.summary}</div>
            </div>
          </div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={Card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 12 }}>🗳 내 평가</div>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="내 이름 (면접관)" style={{ ...IS, marginBottom: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 10 }}>
              {["합격", "보류", "불합격"].map(d => { const s = DEC_STYLE[d]; const on = decision === d; return (
                <button key={d} onClick={() => setDecision(d)} style={{ padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: on ? s.bg : "transparent", border: `1px solid ${on ? s.b : C.border}`, color: on ? s.c : C.sub }}>{d}</button>
              ); })}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="한줄 코멘트 (선택)" rows={2} style={{ ...IS, resize: "vertical", marginBottom: 10 }} />
            <button onClick={submit} style={{ ...BP(), width: "100%" }}>제출 / 수정</button>
          </div>

          <div style={Card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>👥 합의 보드 ({total}표 · AI 포함)</span>
              <span style={{ padding: "4px 12px", borderRadius: 14, fontSize: 13, fontWeight: 700, background: rs.bg, border: `1px solid ${rs.b}`, color: rs.c }}>결과: {result}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {["합격", "보류", "불합격"].map(d => <div key={d} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 7, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: DEC_STYLE[d].c }}>{tally[d]}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{d}</div>
              </div>)}
            </div>
            {rows.length === 0 ? <div style={{ textAlign: "center", padding: "14px 0", color: C.muted, fontSize: 12 }}>아직 제출된 평가가 없습니다</div>
              : rows.map(r => { const s = DEC_STYLE[r.decision] || {}; return (
                <div key={r.id} style={{ padding: "9px 11px", background: r.isAI ? "rgba(139,92,246,.08)" : C.surface, borderRadius: 7, border: `1px solid ${r.isAI ? "rgba(139,92,246,.35)" : C.border}`, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: r.isAI ? C.purple : C.text }}>{r.isAI ? "🤖 AI 면접관" : (r.name || "면접관")}</span>
                    {r.isAI && <span style={{ fontSize: 9, fontWeight: 700, color: C.purple, background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.3)", padding: "1px 6px", borderRadius: 8 }}>AI</span>}
                    <span style={{ marginLeft: "auto", padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: s.bg, border: `1px solid ${s.b}`, color: s.c }}>{r.decision}</span>
                  </div>
                  {r.comment && <div style={{ fontSize: 12, color: C.sub, marginTop: 5, lineHeight: 1.5 }}>{r.comment}</div>}
                </div>
              ); })}
          </div>

          {isHost && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "4px 0" }}>표가 바뀌면 후보 카드에 자동 반영됩니다 · 사람 표 우선(동점만 AI가 결정)</div>}
          {!isHost && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "4px 0" }}>방장 화면에서 최종 결과가 후보 카드에 반영됩니다</div>}
        </div>
      </div>
    </div>
  );
}

// ─── 채용 종합 리포트 화면 ──────────────────────────────────────────────────────
function ReportView({ candidates, positions, onExport }) {
  const rvMobile = useIsMobile();
  const posName = (id) => positions.find(p => p.id === id)?.name || "미지정";
  const passed = candidates.filter(c => c.finalDecision?.result === "합격");
  const hold = candidates.filter(c => c.finalDecision?.result === "보류");
  const rejected = candidates.filter(c => c.finalDecision?.result === "불합격");
  const interviewed = candidates.filter(c => c.interviewFeedback || c.finalDecision);
  const Card = { background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 18 };
  const kpi = [["전체 후보", candidates.length, C.text], ["면접 완료", interviewed.length, C.accent], ["합격", passed.length, C.green], ["보류", hold.length, C.amber], ["불합격", rejected.length, C.red]];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>채용 종합 리포트</h2>
          <span style={{ fontSize: 12, color: C.sub }}>총 {candidates.length}명 · 면접 완료 {interviewed.length}명 · 합격 {passed.length}명</span>
        </div>
        <button onClick={onExport} style={{ marginLeft: "auto", background: `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📄 PDF / 인쇄</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: rvMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, marginBottom: 22 }}>
        {kpi.map(([l, n, col]) => <div key={l} style={{ ...Card, textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: col }}>{n}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{l}</div>
        </div>)}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 12 }}>✅ 최종 합격자 — 합격 사유</div>
      {passed.length === 0 ? <div style={{ ...Card, color: C.muted, fontSize: 13, marginBottom: 22 }}>아직 합격 확정된 후보가 없습니다. 결정 화면에서 "다수결 결과 확정"을 누르면 여기에 표시돼요.</div>
        : passed.map(c => { const fb = c.interviewFeedback, a = c.analysis; const votes = (c.finalDecision?.votes || []).filter(v => v.comment); const fdr = DEC_STYLE.합격;
          return <div key={c.id} style={{ ...Card, borderLeft: `4px solid ${C.green}`, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{c.name}</span>
              <span style={{ fontSize: 12, color: C.sub }}>{posName(c.positionId)}{c.age ? ` · ${c.age}세` : ""}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: fdr.c, background: fdr.bg, border: `1px solid ${fdr.b}`, padding: "3px 12px", borderRadius: 14 }}>합격 ({c.finalDecision.tally?.합격 ?? 0}/{c.finalDecision.total ?? 0})</span>
            </div>
            {(a || fb) && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{a ? `이력서 ${a.totalScore}점 · AI 사전판정 ${a.verdict}` : ""}{fb ? ` · 면접 ${fb.aiScore}점` : ""}</div>}
            {fb?.summary && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, marginBottom: 10, padding: "10px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}><b style={{ color: C.green }}>AI 종합평</b> · {fb.summary}</div>}
            {fb?.strengths?.length > 0 && <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}><b style={{ color: C.text }}>강점:</b> {fb.strengths.join(" · ")}</div>}
            {votes.length > 0 && <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>면접관 코멘트</div>
              {votes.map((v, i) => { const s = DEC_STYLE[v.decision] || {}; return <div key={i} style={{ fontSize: 12, color: C.sub, padding: "7px 11px", background: v.isAI ? "rgba(139,92,246,.08)" : C.surface, borderRadius: 7, border: `1px solid ${v.isAI ? "rgba(139,92,246,.3)" : C.border}`, marginBottom: 5 }}><b style={{ color: v.isAI ? C.purple : C.text }}>{v.isAI ? "🤖 AI 면접관" : (v.name || "면접관")}</b> <span style={{ color: s.c }}>[{v.decision}]</span> {v.comment}</div>; })}
            </div>}
          </div>;
        })}

      <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, margin: "22px 0 12px" }}>전체 후보 현황</div>
      <div style={{ ...Card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: C.surface }}>
            {["이름", "포지션", "이력서점수", "AI 사전판정", "최종결정"].map((h, i) => <th key={h} style={{ textAlign: i >= 2 ? "center" : "left", padding: "10px 12px", color: C.muted, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {candidates.map(c => { const a = c.analysis, r = c.finalDecision?.result; const s = DEC_STYLE[r] || {}; return <tr key={c.id}>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.text }}>{c.name}</td>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.sub }}>{posName(c.positionId)}</td>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", color: C.sub }}>{a ? a.totalScore : "-"}</td>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", color: C.sub }}>{a ? a.verdict : "미분석"}</td>
              <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", fontWeight: 700, color: r ? s.c : C.muted }}>{r || "미정"}</td>
            </tr>; })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 면접 결과·결정 요약 (카드/상세 공용) ───────────────────────────────────────
function DecisionSummary({ candidate, compact }) {
  const fd = candidate.finalDecision;
  const fb = candidate.interviewFeedback;
  if (!fd && !fb) return compact ? null : (
    <div style={{ fontSize: 12, color: C.muted, padding: "10px 12px", background: C.surface, borderRadius: 8, border: `1px dashed ${C.border}` }}>아직 면접·결정 전입니다. 면접 종료 후 평가하면 결과가 여기 표시돼요.</div>
  );
  const s = fd ? (DEC_STYLE[fd.result] || {}) : {};
  const fbS = fb ? (DEC_STYLE[fb.aiVerdict] || {}) : {};
  const t = (fd && fd.tally) || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 10, marginTop: compact ? 10 : 0 }}>
      {fd && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: compact ? "7px 10px" : "10px 13px", background: s.bg, border: `1px solid ${s.b}`, borderRadius: 8 }}>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: s.c }}>최종 {fd.result}</span>
        <span style={{ marginLeft: "auto", fontSize: compact ? 11 : 12, color: C.sub }}>
          <span style={{ color: DEC_STYLE.합격.c }}>합격 {t.합격 || 0}</span> · <span style={{ color: DEC_STYLE.보류.c }}>보류 {t.보류 || 0}</span> · <span style={{ color: DEC_STYLE.불합격.c }}>불합격 {t.불합격 || 0}</span>
        </span>
      </div>}
      {fb && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: compact ? "7px 10px" : "10px 13px", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.3)", borderRadius: 8 }}>
        <span style={{ fontSize: compact ? 11 : 12, color: C.purple, fontWeight: 600 }}>🤖 AI 면접관 표</span>
        <span style={{ marginLeft: "auto", fontSize: compact ? 12 : 13, fontWeight: 700, color: fbS.c || C.sub }}>{fb.aiVerdict}{fb.aiScore != null ? ` · ${fb.aiScore}점` : ""}</span>
      </div>}
      {!compact && fb?.summary && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, padding: "10px 13px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}><b style={{ color: C.text }}>AI 종합평</b> · {fb.summary}</div>}
      {!compact && fd?.votes?.filter(v => v.comment).length > 0 && <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>면접관 코멘트</div>
        {fd.votes.filter(v => v.comment).map((v, i) => { const vs = DEC_STYLE[v.decision] || {}; return <div key={i} style={{ fontSize: 12, color: C.sub, padding: "7px 11px", background: v.isAI ? "rgba(139,92,246,.08)" : C.surface, borderRadius: 7, border: `1px solid ${v.isAI ? "rgba(139,92,246,.3)" : C.border}`, marginBottom: 5 }}><b style={{ color: v.isAI ? C.purple : C.text }}>{v.isAI ? "🤖 AI 면접관" : (v.name || "면접관")}</b> <span style={{ color: vs.c }}>[{v.decision}]</span> {v.comment}</div>; })}
      </div>}
    </div>
  );
}

// ─── 포트폴리오 확인 체크리스트 (상세 화면 + 보드 "포트폴리오확인" 컬럼 공용) ────
function PortfolioCheck({ candidate, onUpdate, compact }) {
  const pc = candidate.portfolioCheck;
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    const ev = getEvaluator();
    setName((pc && pc.by) || ev.name || "");
    setNote((pc && pc.note) || "");
  }, [candidate.id]);
  const IS2 = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: compact ? "5px 8px" : "8px 11px", fontSize: compact ? 11 : 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  if (pc?.checked) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: compact ? "6px 9px" : "10px 13px", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 8 }}>
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: C.green }}>✓ 포트폴리오 확인됨 ({pc.by || "확인자"} · {pc.at ? new Date(pc.at).toLocaleDateString("ko-KR") : ""})</span>
        {!compact && pc.note && <span style={{ fontSize: 12, color: C.sub }}>· {pc.note}</span>}
        <button onClick={() => onUpdate({ checked: false, by: pc.by || "", at: null, note: pc.note || "" })} style={{ marginLeft: "auto", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: compact ? 10 : 11, fontFamily: "inherit" }}>해제</button>
      </div>
    );
  }
  const check = () => {
    const by = (name || "").trim();
    if (!by) { alert("확인자 이름을 입력하세요"); return; }
    setEvaluatorName(by);
    onUpdate({ checked: true, by, at: Date.now(), note: (note || "").trim() });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: compact ? "7px 8px" : "12px 13px", background: C.surface, border: `1px dashed ${C.borderL}`, borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <input type="checkbox" checked={false} onChange={check} style={{ width: compact ? 13 : 15, height: compact ? 13 : 15, accentColor: C.purple, cursor: "pointer", margin: 0 }} />
        <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: C.sub }}>포트폴리오 확인</span>
      </div>
      <div style={{ display: "flex", gap: 5, flexDirection: compact ? "column" : "row" }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="확인자 이름" style={{ ...IS2, flex: compact ? undefined : "0 0 130px" }} />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (선택)" style={{ ...IS2, flex: 1 }} />
      </div>
    </div>
  );
}

// ─── 첨부 개수 (업로드 파일 + 사내 폴더 경로 참조 합산) ─────────────────────────
const attachCount = (c) => ((c.fileRefs?.length) || 0) + ((c.fileNames?.length) || 0);

// ─── ⭐ 별표(즐겨찾기) 토글 버튼 — 카드/보드/자료실/상세 공용 ─────────────────────
const STAR_COLOR = "#F59E0B";
function StarButton({ on, onToggle, size = 16 }) {
  return (
    <button onClick={e => { e.stopPropagation(); onToggle && onToggle(); }} title={on ? "별표 해제" : "별표 표시"}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: size, lineHeight: 1, color: on ? STAR_COLOR : C.muted, fontFamily: "inherit", transition: "color .15s, transform .15s" }}>
      {on ? "★" : "☆"}
    </button>
  );
}

// ─── 수동 채점 (v2 축 6개) — AI vs 수동 나란히 비교 ─────────────────────────────
function ManualV2Card({ candidate, onSave, showToast }) {
  const ai = candidate.analysis?.v2Scores || null;
  const [draft, setDraft] = useState(() => V2_AXES.reduce((o, [k]) => ({ ...o, [k]: 0 }), {}));
  const [scorer, setScorer] = useState("");
  useEffect(() => {
    const ev = getEvaluator();
    setScorer(candidate.manualScoredBy || ev.name || "");
    const ms = candidate.manualScores || {};
    setDraft(V2_AXES.reduce((o, [k]) => ({ ...o, [k]: Number(ms[k]) || 0 }), {}));
  }, [candidate.id]);
  const aiTotal = ai ? v2WeightedTotal(ai) : null;
  const manualTotal = v2WeightedTotal(draft);
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }));
  const save = () => {
    const by = (scorer || "").trim() || "평가자";
    setEvaluatorName(by);
    onSave({ manualScores: { ...draft }, manualScoredBy: by, manualScoredAt: Date.now() });
    showToast(`수동 채점 저장 — ${manualTotal}점 (${by})`);
  };
  const IS2 = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>🎯 큐라엘 v2 축 — AI vs 수동</h3>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: C.purple, fontWeight: 600 }}>AI 가중총점 <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: aiTotal != null ? sc(aiTotal) : C.muted }}>{aiTotal != null ? aiTotal : "—"}</span></span>
        <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>수동 가중총점 <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: sc(manualTotal) }}>{manualTotal}</span></span>
        {!ai && <span style={{ fontSize: 10, color: C.muted }}>AI 분석 없이도 수동 채점 가능</span>}
      </div>
      {V2_AXES.map(([key, label, w]) => {
        const av = ai ? (Number(ai[key]) || 0) : null;
        const mv = Number(draft[key]) || 0;
        return (
          <div key={key} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 5 }}>x{w}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                <span style={{ color: C.purple }}>AI {av != null ? av : "—"}</span>
                <span style={{ color: C.muted }}> · </span>
                <span style={{ color: C.accent, fontWeight: 700 }}>수동 {mv}</span>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <span style={{ width: 26, fontSize: 9, fontWeight: 700, color: C.purple }}>AI</span>
              <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${((av || 0) / 5) * 100}%`, background: C.purple, borderRadius: 3, transition: "width .4s ease" }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ width: 26, fontSize: 9, fontWeight: 700, color: C.accent }}>수동</span>
              <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(mv / 5) * 100}%`, background: C.accent, borderRadius: 3, transition: "width .2s ease" }} />
              </div>
            </div>
            <input type="range" min={0} max={5} step={0.5} value={mv} onChange={e => set(key, Number(e.target.value))} style={{ width: "100%", accentColor: C.accent, cursor: "pointer", margin: 0 }} />
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 4 }}>
        <input value={scorer} onChange={e => setScorer(e.target.value)} placeholder="채점자 이름" style={{ ...IS2, flex: "0 0 130px" }} />
        <button onClick={save} style={{ flex: 1, background: `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 7, color: "#fff", padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>수동 채점 저장</button>
      </div>
      {candidate.manualScoredAt && (
        <div style={{ fontSize: 10, color: C.muted, marginTop: 7 }}>마지막 저장: {candidate.manualScoredBy || "평가자"} · {new Date(candidate.manualScoredAt).toLocaleString("ko-KR")} · 저장 총점 {candidate.manualScores ? v2WeightedTotal(candidate.manualScores) : "—"}점</div>
      )}
    </div>
  );
}

// ─── 📎 첨부 자료 (D안: 원본은 사내 폴더 보관, 앱은 파일명+경로 안내) ────────────
function FileRefsSection({ candidate, onUpdate, showToast }) {
  const refs = candidate.fileRefs || [];
  const [fname, setFname] = useState("");
  const [fpath, setFpath] = useState("");
  useEffect(() => { setFname(""); setFpath(""); }, [candidate.id]);
  const copyPath = async (p) => {
    try { await navigator.clipboard.writeText(p); showToast("경로 복사됨 — 탐색기 주소창에 붙여넣으세요"); }
    catch (e) { showToast("경로 복사 실패 — 브라우저 권한을 확인하세요", "error"); }
  };
  const add = () => {
    const n = fname.trim(), p = fpath.trim();
    if (!n || !p) { showToast("파일명과 경로를 모두 입력하세요", "error"); return; }
    onUpdate([...refs, { name: n, path: p }]);
    setFname(""); setFpath("");
  };
  const remove = (i) => onUpdate(refs.filter((_, j) => j !== i));
  const IS2 = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 14 }}>
      {refs.length === 0
        ? <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>원본 파일은 사내 폴더에 보관하세요. 파일명과 경로를 등록해두면 팀원이 바로 찾을 수 있어요.</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
          {refs.map((r, i) => (
            <div key={i} title={r.path} style={{ display: "flex", alignItems: "center", gap: 7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", maxWidth: 360 }}>
              <span style={{ fontSize: 13 }}>📎</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <button onClick={() => copyPath(r.path)} style={{ background: C.glow, border: `1px solid ${C.accent}40`, borderRadius: 6, color: C.accent, cursor: "pointer", fontSize: 10, fontWeight: 700, padding: "2px 8px", fontFamily: "inherit", whiteSpace: "nowrap" }}>경로 복사</button>
              <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={fname} onChange={e => setFname(e.target.value)} placeholder="파일명 (예: 포트폴리오.pdf)" style={{ ...IS2, flex: "1 0 160px" }} />
        <input value={fpath} onChange={e => setFpath(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder={"경로 (예: \\\\NAS\\채용\\홍길동\\포트폴리오.pdf)"} style={{ ...IS2, flex: "2 0 200px" }} />
        <button onClick={add} style={{ background: `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 7, color: "#fff", padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>추가</button>
      </div>
    </div>
  );
}

// ─── 🗂 자료실 뷰 (플랫폼 통합 테이블) ──────────────────────────────────────────
function LibraryView({ candidates, positions, onSelect, onToggleStar }) {
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const posName = (id) => positions.find(p => p.id === id)?.name || "미지정";
  const aiScore = (c) => c.analysis?.totalScore ?? null;
  const manualScore = (c) => c.manualScores ? v2WeightedTotal(c.manualScores) : null;
  const toggle = (key) => { if (sortKey === key) setSortDir(d => -d); else { setSortKey(key); setSortDir(key === "name" ? 1 : -1); } };
  const sorted = [...candidates].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name, "ko") * sortDir;
    let va = 0, vb = 0;
    if (sortKey === "star") { va = a.starred ? 1 : 0; vb = b.starred ? 1 : 0; }
    else if (sortKey === "ai") { va = aiScore(a) ?? -1; vb = aiScore(b) ?? -1; }
    else if (sortKey === "manual") { va = manualScore(a) ?? -1; vb = manualScore(b) ?? -1; }
    else if (sortKey === "stage") { va = STAGES.indexOf(a.stage || "서류검토"); vb = STAGES.indexOf(b.stage || "서류검토"); }
    else if (sortKey === "files") { va = attachCount(a); vb = attachCount(b); }
    return (va - vb) * sortDir;
  });
  const channelStats = CHANNELS.map(ch => ({ ch, n: candidates.filter(c => (c.channel || "기타") === ch).length })).filter(s => s.n > 0);
  const pcDone = candidates.filter(c => c.portfolioCheck?.checked).length;
  const manualDone = candidates.filter(c => c.manualScores).length;
  const Card = { background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };
  const th = (label, key, center) => (
    <th key={label} onClick={key ? () => toggle(key) : undefined}
      style={{ textAlign: center ? "center" : "left", padding: "10px 12px", color: sortKey === key ? C.accent : C.muted, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${C.border}`, cursor: key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
      {label}{key && sortKey === key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🗂 자료실</h2>
          <span style={{ fontSize: 12, color: C.sub }}>전체 후보 통합 테이블 · 컬럼 헤더 클릭으로 정렬 · 행 클릭으로 상세 이동</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {channelStats.map(s => (
          <div key={s.ch} style={{ ...Card, padding: "8px 14px", display: "flex", alignItems: "center", gap: 7 }}>
            <ChannelBadge channel={s.ch} small />
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: C.text }}>{s.n}</span>
          </div>
        ))}
        <div style={{ ...Card, padding: "8px 14px", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>✓ 포트폴리오 확인</span>
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: C.green }}>{pcDone}</span>
          <span style={{ fontSize: 11, color: C.muted }}>/ {candidates.length}</span>
        </div>
        <div style={{ ...Card, padding: "8px 14px", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>✎ 수동 채점 완료</span>
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: C.accent }}>{manualDone}</span>
          <span style={{ fontSize: 11, color: C.muted }}>/ {candidates.length}</span>
        </div>
      </div>
      <div style={{ ...Card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.surface }}>
              {th("★", "star", true)}
              {th("이름", "name")}
              {th("채널", null)}
              {th("포지션", null)}
              {th("단계", "stage", true)}
              {th("파일", "files", true)}
              {th("AI 총점", "ai", true)}
              {th("수동 총점", "manual", true)}
              {th("포트폴리오", null, true)}
              {th("최종 판정", null, true)}
            </tr></thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={10} style={{ padding: "26px 12px", textAlign: "center", color: C.muted, fontSize: 13 }}>표시할 후보가 없습니다 — 필터를 확인하세요</td></tr>
              )}
              {sorted.map(c => {
                const stage = c.stage || "서류검토";
                const stCol = STAGE_COLORS[stage] || C.sub;
                const ais = aiScore(c), ms = manualScore(c);
                const fd = c.finalDecision?.result;
                const fds = DEC_STYLE[fd] || {};
                const nFiles = attachCount(c);
                return (
                  <tr key={c.id} onClick={() => onSelect(c.id)} style={{ cursor: "pointer", transition: "background .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.surface; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", width: 36 }}>
                      <StarButton on={!!c.starred} onToggle={() => onToggleStar && onToggleStar(c.id)} size={15} />
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{c.name}{c.age ? <span style={{ fontWeight: 400, color: C.muted, fontSize: 11 }}> · {c.age}세</span> : ""}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}><ChannelBadge channel={c.channel} small /></td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.sub, whiteSpace: "nowrap" }}>{posName(c.positionId)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${stCol}18`, border: `1px solid ${stCol}40`, color: stCol, fontWeight: 600, whiteSpace: "nowrap" }}>{stage}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", color: nFiles > 0 ? C.sub : C.muted, fontSize: 12, whiteSpace: "nowrap" }}>{nFiles > 0 ? `📎${nFiles}` : "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", fontWeight: 700, fontFamily: "'DM Mono',monospace", color: ais != null ? sc(ais) : C.muted }}>{ais != null ? ais : "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", fontWeight: 700, fontFamily: "'DM Mono',monospace", color: ms != null ? sc(ms) : C.muted }}>{ms != null ? ms : "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", color: c.portfolioCheck?.checked ? C.green : C.muted, fontWeight: 700 }}>{c.portfolioCheck?.checked ? "✓" : "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center", fontWeight: 700, color: fd ? fds.c : C.muted, whiteSpace: "nowrap" }}>{fd || "미정"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Candidate Card ───────────────────────────────────────────────────────────
function CandidateCard({ c, rc, analyzingIds, vStyle, onSelect, onInterview, onReanalyze, onExportPDF, onDecision, onToggleStar, onStage, position }) {
  const busy = analyzingIds.has(c.id);
  const a = c.analysis;
  const stage = c.stage || "서류검토";
  const stCol = STAGE_COLORS[stage] || C.sub;
  const QUICK_STAGES = [["서류", "서류검토"], ["면접", "면접"], ["탈락", "탈락"]];
  return (
    <div style={{ background: C.card, borderRadius: 15, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 20, cursor: "pointer", position: "relative", transition: "all .22s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = rc.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
      onClick={onSelect}>
      <div style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: rc.accent, boxShadow: `0 0 6px ${rc.accent}` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${rc.accent}25`, border: `1px solid ${rc.accent}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: rc.accent }}>{c.name[0]}</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
            <StarButton on={!!c.starred} onToggle={onToggleStar} />
            <ChannelBadge channel={c.channel} small />
          </div>
          <div style={{ fontSize: 11, color: C.sub }}>{c.age ? `${c.age}세` : ""}{attachCount(c) > 0 && <span style={{ marginLeft: 5 }}>📎{attachCount(c)}</span>}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ padding: "3px 9px", borderRadius: 16, fontSize: 10, fontWeight: 700, background: `${stCol}18`, border: `1px solid ${stCol}40`, color: stCol, whiteSpace: "nowrap" }}>{stage}</span>
          {c.manualScores && <span style={{ padding: "3px 9px", borderRadius: 16, fontSize: 10, fontWeight: 700, background: C.glow, border: `1px solid ${C.accent}40`, color: C.accent }}>수동 {v2WeightedTotal(c.manualScores)}</span>}
          {c.interviewFeedback && <span style={{ padding: "3px 9px", borderRadius: 16, fontSize: 10, fontWeight: 700, background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.35)", color: C.purple }}>면접 완료</span>}
          {c.finalDecision && <span style={{ padding: "3px 10px", borderRadius: 16, fontSize: 11, fontWeight: 700, background: (DEC_STYLE[c.finalDecision.result] || {}).bg, border: `1px solid ${(DEC_STYLE[c.finalDecision.result] || {}).b}`, color: (DEC_STYLE[c.finalDecision.result] || {}).c }}>{c.finalDecision.result}</span>}
          {!busy && a && <span style={{ padding: "3px 10px", borderRadius: 16, fontSize: 11, fontWeight: 700, background: vStyle(a.verdict).bg, border: `1px solid ${vStyle(a.verdict).border}`, color: vStyle(a.verdict).color }}>{a.verdict}</span>}
        </div>
      </div>
      {busy ? <Spin /> : a ? (<>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Ring score={a.totalScore} size={60} stroke={5} color={rc.accent} />
          <div style={{ flex: 1 }}>
            <Bar label="직무 경험" score={a.scores.experienceMatch} revised={c.interviewFeedback?.revisedScores?.experienceMatch} />
            <Bar label="문화 적합도" score={a.scores.cultureFit} revised={c.interviewFeedback?.revisedScores?.cultureFit} />
          </div>
        </div>
        <Bar label="역량 키워드" score={a.scores.skillKeywords} revised={c.interviewFeedback?.revisedScores?.skillKeywords} />
        <Bar label="안정성" score={a.scores.stability} revised={c.interviewFeedback?.revisedScores?.stability} />
        <Bar label="포트폴리오" score={a.scores.portfolioMatch} revised={c.interviewFeedback?.revisedScores?.portfolioMatch} />
        <Bar label="성장 가능성" score={a.scores.growthPotential} revised={c.interviewFeedback?.revisedScores?.growthPotential} />
        <div style={{ marginTop: 11, padding: "9px 11px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>{a.summary}</div>
        {c.portfolioCheck?.checked && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: C.green }}>✓ 포트폴리오 확인됨 ({c.portfolioCheck.by || "확인자"} · {c.portfolioCheck.at ? new Date(c.portfolioCheck.at).toLocaleDateString("ko-KR") : ""})</div>}
        <DecisionSummary candidate={c} compact />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 }}>
          <button onClick={e => { e.stopPropagation(); onInterview(); }} style={{ padding: "8px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${C.purple},${C.pink})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🎤 면접 시작</button>
          <button onClick={e => { e.stopPropagation(); onExportPDF(); }} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>📄 PDF 저장</button>
        </div>
        <button onClick={e => { e.stopPropagation(); onDecision && onDecision(); }} style={{ width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, border: `1px solid ${c.finalDecision ? (DEC_STYLE[c.finalDecision.result]||{}).b : C.border}`, background: c.finalDecision ? (DEC_STYLE[c.finalDecision.result]||{}).bg : "transparent", color: c.finalDecision ? (DEC_STYLE[c.finalDecision.result]||{}).c : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🗳 합의 · 합격/불합격 결정{c.finalDecision ? ` · ${c.finalDecision.result}` : ""}</button>
      </>) : (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 9 }}>분석 대기 중</div>
          <button onClick={e => { e.stopPropagation(); onReanalyze(); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", color: C.sub, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>분석 시작</button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>단계</span>
        {QUICK_STAGES.map(([label, st]) => {
          const active = stage === st;
          const col = STAGE_COLORS[st] || C.sub;
          return (
            <button key={st} onClick={e => { e.stopPropagation(); onStage && onStage(st); }}
              title={active ? `현재 단계: ${st}` : `${st} 단계로 이동`}
              style={{ flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: active ? col : "transparent", border: `1px solid ${active ? col : C.border}`, color: active ? "#fff" : C.sub, transition: "all .15s" }}>{label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const SAMPLE_POSITIONS = [
  { id: "p1", name: "데이터 사이언티스트", colorIdx: 0, jd: "직무명: 데이터 사이언티스트 (큐라엘)\n\n주요 업무:\n- 암환자 임상 데이터 분석 및 바이오마커 연구\n- 머신러닝 모델 개발\n- 제품 효능 데이터 시각화\n\n자격 요건:\n- Python/R 능숙, SQL 필수\n- 의료/헬스케어 데이터 분석 경험 우대\n\n우리 문화:\n근거 중심, 빠른 실험, 자율과 책임" },
  { id: "p2", name: "마케터", colorIdx: 1, jd: "직무명: 디지털 마케터 (큐라엘 브랜드팀)\n\n주요 업무:\n- 큐라엘몰 및 SNS 채널 운영\n- 암환자 대상 콘텐츠 기획\n- GEO/SEO 최적화\n\n자격 요건:\n- SNS 채널 운영 경험 2년 이상\n- 헬스케어 콘텐츠 경험 우대\n\n우리 문화:\n환자 중심, 빠른 실행, 창의적 실험" },
];
const SAMPLE_CANDIDATES = [
  { id: "c1", positionId: "p1", name: "박서준", age: 30, channel: "직접지원", stage: "서류검토", resume: "컴퓨터공학 석사 (KAIST, 2020)\n현) 네이버 헬스케어 데이터팀 4년\nPython, TensorFlow, SQL 고급\n의료 EMR 데이터 분석 프로젝트 3건", files: [], fileNames: [] },
  { id: "c2", positionId: "p2", name: "김민지", age: 29, channel: "사람인", stage: "서류검토", resume: "경영학 학사 (이화여대, 2018)\n현) 비타민하우스 디지털마케팅팀 3년\n인스타그램/유튜브 채널 팔로워 12만\nGoogle Ads ROAS 350% 달성", files: [], fileNames: [] },
];

export default function HireL() {
  const [view, setView] = useState("dashboard");
  const [dataMenu, setDataMenu] = useState(false);
  const isMobile = useIsMobile();
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedPositionId, setSelectedPositionId] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [interviewCandidateId, setInterviewCandidateId] = useState(null);
  const [decisionCandidateId, setDecisionCandidateId] = useState(null);
  const [genFeedbackFor, setGenFeedbackFor] = useState(null);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", age: "", resume: "", positionId: "", inputMode: "file", channel: "기타" });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [toast, setToast] = useState(null);

  const [roomId, setRoomId] = useState(null);
  const [isRoomHost, setIsRoomHost] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const pollRef = useRef(null);
  const lastPushRef = useRef(0);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get("room");
    if (rid) {
      setRoomId(rid);
      setIsRoomHost(false);
      setSyncEnabled(true);
      setSyncStatus("syncing");
      showToast(`🔗 공유 룸 연결 중... 룸코드: ${rid}`);
      // ✅ FIX: 링크 열자마자 즉시 데이터 pull (빈 화면 방지)
      fetch(`/api/sync?roomId=${rid}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.positions && data.candidates) {
            setPositions(data.positions);
            setCandidates(data.candidates);
            setSyncStatus("connected");
            showToast(`✓ 데이터 동기화 완료 — 룸코드: ${rid}`);
          }
        })
        .catch(e => {
          console.error("초기 pull 실패:", e);
          setSyncStatus("error");
          showToast("동기화 실패 — Firebase 권한을 확인하세요", "error");
        });
    } else {
      try {
        const saved = localStorage.getItem("hirel_data");
        if (saved) { const d = JSON.parse(saved); setPositions(d.positions || []); setCandidates(d.candidates || []); }
        else { setPositions(SAMPLE_POSITIONS); setCandidates(SAMPLE_CANDIDATES); }
      } catch (e) { setPositions(SAMPLE_POSITIONS); setCandidates(SAMPLE_CANDIDATES); }
    }
  }, []);

  const pushToRoom = async (rid, data) => {
    try {
      const slim = {
        positions: data.positions.map(p => ({ id: p.id, name: p.name, colorIdx: p.colorIdx, jd: (p.jd||"") })),
        candidates: data.candidates.map(c => ({
          id: c.id, positionId: c.positionId, name: c.name, age: c.age,
          channel: c.channel || "기타",
          stage: c.stage || "서류검토",
          starred: !!c.starred,
          portfolioCheck: c.portfolioCheck || null,
          conditions: c.conditions || null,
          fileNames: c.fileNames || [],
          fileRefs: c.fileRefs || [],
          manualScores: c.manualScores || null,
          manualScoredBy: c.manualScoredBy || null,
          manualScoredAt: c.manualScoredAt || null,
          questionScores: c.questionScores || null,
          customQuestions: c.customQuestions || null,
          onboarding: c.onboarding || null,
          resume: (c.resume||"").slice(0, 300),
          files: [],
          analysis: c.analysis ? {
            totalScore: c.analysis.totalScore,
            scores: c.analysis.scores,
            v2Scores: c.analysis.v2Scores || null,
            verdict: c.analysis.verdict,
            summary: c.analysis.summary,
            strengths: c.analysis.strengths,
            weaknesses: c.analysis.weaknesses,
            keywords: (c.analysis.keywords||[]).slice(0, 10),
            interviewQuestions: c.analysis.interviewQuestions,
          } : null,
          interviewFeedback: c.interviewFeedback || null,
          finalDecision: c.finalDecision || null,
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

  const createRoom = async () => {
    const rid = Math.random().toString(36).slice(2, 8).toUpperCase();
    setRoomId(rid);
    setIsRoomHost(true);
    setSyncEnabled(true);
    setSyncStatus("syncing");
    await pushToRoom(rid, { positions, candidates });
    const shareUrl = `${window.location.origin}?room=${rid}`;
    try { await navigator.clipboard.writeText(shareUrl); } catch(e) {}
    showToast(`✓ 공유 시작! 룸코드: ${rid} — 링크 복사됨`);
  };

  // ─── ✅ FIX: localStorage 저장 시 files(base64) 제거 + try-catch ───────────
  useEffect(() => {
    // base64 파일 데이터는 localStorage에 저장하지 않음 (5MB 한도 초과 방지)
    const slimCandidates = candidates.map(c => ({ ...c, files: [] }));

    if (!syncEnabled || !isRoomHost || !roomId) {
      if (!syncEnabled && (positions.length > 0 || candidates.length > 0)) {
        try {
          localStorage.setItem("hirel_data", JSON.stringify({ positions, candidates: slimCandidates }));
        } catch (e) {
          console.error("localStorage 저장 실패 (용량 초과):", e);
        }
      }
      return;
    }
    try {
      localStorage.setItem("hirel_data", JSON.stringify({ positions, candidates: slimCandidates }));
    } catch (e) {
      console.error("localStorage 저장 실패 (용량 초과):", e);
    }
    const now = Date.now();
    if (now - lastPushRef.current < 1000) return;
    lastPushRef.current = now;
    pushToRoom(roomId, { positions, candidates });
  }, [positions, candidates, syncEnabled, isRoomHost, roomId]);
  // ─────────────────────────────────────────────────────────────────────────────

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
  const BP = (bg) => ({ background: bg || `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", borderRadius: 9, color: "#fff", padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const vStyle = (v) => ({ "추천": { color: C.green, bg: "rgba(16,185,129,.1)", border: "rgba(16,185,129,.3)" }, "검토필요": { color: C.amber, bg: "rgba(245,158,11,.1)", border: "rgba(245,158,11,.3)" }, "부적합": { color: C.red, bg: "rgba(239,68,68,.1)", border: "rgba(239,68,68,.3)" } }[v] || { color: C.sub, bg: C.card, border: C.border });

  const updateCandidate = (id, patch) => {
    setCandidates(prev => {
      const updated = prev.map(x => x.id === id ? { ...x, ...patch } : x);
      if (syncEnabled && isRoomHost && roomId) { lastPushRef.current = 0; pushToRoom(roomId, { positions, candidates: updated }); }
      return updated;
    });
  };
  const finishInterview = async (cand, pos, transcript) => {
    setDecisionCandidateId(cand.id); setView("decision");
    if (transcript && transcript.trim().length > 10) {
      setGenFeedbackFor(cand.id);
      try {
        const fb = await finalizeInterview(pos?.jd || "", cand.name, transcript, cand.analysis?.interviewQuestions);
        updateCandidate(cand.id, { interviewFeedback: fb });
      } catch (e) { console.error("AI 종합 피드백 오류:", e); showToast("AI 종합 피드백 생성 실패", "error"); }
      setGenFeedbackFor(null);
    }
  };
  const saveFinalDecision = (id, final) => {
    // 최종 결정에 따라 파이프라인 stage 자동 동기화 (합격 → "합격", 불합격 → "탈락")
    const patch = { finalDecision: final };
    if (final.result === "합격") patch.stage = "합격";
    else if (final.result === "불합격") patch.stage = "탈락";
    updateCandidate(id, patch);
    showToast(`최종 결정 저장 — ${final.result}`);
  };

  // 칸반 보드: ◀ ▶ 버튼으로 단계 이동
  const moveStage = (c, dir) => {
    const idx = STAGES.indexOf(c.stage || "서류검토");
    const ni = Math.min(STAGES.length - 1, Math.max(0, idx + dir));
    if (ni !== idx) updateCandidate(c.id, { stage: STAGES[ni] });
  };

  // ⭐ 별표 토글 (카드/보드/자료실/상세 공용)
  const toggleStar = (id) => {
    const cur = candidates.find(x => x.id === id);
    updateCandidate(id, { starred: !(cur && cur.starred) });
  };

  // 카드 퀵 액션: 서류/면접/탈락 단계 즉시 이동 + 토스트
  const quickStage = (c, stage) => {
    if ((c.stage || "서류검토") === stage) return;
    updateCandidate(c.id, { stage });
    showToast(`${c.name} — ${stage} 단계로 이동`);
  };

  const doAnalyzeAndSync = async (c) => {
    const pos = positions.find(p => p.id === c.positionId);
    if (!pos) { showToast("포지션을 찾을 수 없습니다", "error"); return; }
    setAnalyzingIds(p => new Set(p).add(c.id));
    try {
      const r = await analyzeResume(pos.jd, c, pos.name);
      setCandidates(prev => {
        const updated = prev.map(x => x.id === c.id ? { ...x, analysis: r } : x);
        // ✅ 분석 완료 직후 최신 state로 즉시 Firebase push (throttle 우회)
        if (syncEnabled && isRoomHost && roomId) {
          lastPushRef.current = 0;
          pushToRoom(roomId, { positions, candidates: updated });
        }
        return updated;
      });
      showToast(`${c.name} 분석 완료 — ${r.totalScore}점 ${r.verdict}`);
    } catch (e) {
      console.error("분석 오류:", e);
      const msg = e?.message || String(e);
      if (msg.includes("401")) showToast("API 키 오류 (401) — 키를 다시 확인해주세요", "error");
      else if (msg.includes("429")) showToast("크레딧 부족 (429) — 충전이 필요해요", "error");
      else if (msg.includes("JSON")) showToast("AI 응답 파싱 오류 — 다시 시도해주세요", "error");
      else showToast(`분석 실패: ${msg.slice(0, 60)}`, "error");
    }
    setAnalyzingIds(p => { const s = new Set(p); s.delete(c.id); return s; });
  };
  // 하위 호환 alias
  const doAnalyze = doAnalyzeAndSync;

  // "+ 후보자" 클릭 시 포지션 자동 선택: 현재 필터 → "마케터" 포함 첫 포지션 → 첫 포지션
  const openAddCandidate = () => {
    let pid = "";
    if (selectedPositionId !== "all" && positions.some(p => p.id === selectedPositionId)) pid = selectedPositionId;
    else {
      const mk = positions.find(p => (p.name || "").includes("마케터"));
      pid = mk ? mk.id : (positions[0]?.id || "");
    }
    setAddForm(p => ({ ...p, positionId: pid, showNewPos: false }));
    setShowAddCandidate(true);
  };

  const addCandidate = () => {
    if (!addForm.name || !addForm.positionId) return;
    let resume = addForm.resume;
    const tf = uploadedFiles.filter(f => f.kind === "text");
    if (tf.length) resume = [resume, ...tf.map(f => f.text)].filter(Boolean).join("\n\n");
    const c = { id: `c${Date.now()}`, positionId: addForm.positionId, name: addForm.name, age: parseInt(addForm.age) || null, channel: addForm.channel || "기타", stage: "서류검토", resume, files: uploadedFiles.filter(f => f.kind === "pdf" || f.kind === "image"), fileNames: uploadedFiles.map(f => f.name) };
    setCandidates(p => [...p, c]);
    setAddForm({ name: "", age: "", resume: "", positionId: "", inputMode: "file", channel: "기타" });
    setUploadedFiles([]); setShowAddCandidate(false);
    showToast(`${c.name} 후보자 등록 완료 — AI 분석 시작`);
    doAnalyzeAndSync(c);
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
      try {
        const d = JSON.parse(ev.target.result);
        setPositions(d.positions || []);
        // channel/stage/portfolioCheck 등 모든 필드를 스프레드로 보존, 없으면 기본값만 채움
        setCandidates((d.candidates || []).map(c => ({ channel: "기타", stage: "서류검토", ...c })));
        showToast("데이터 불러오기 완료");
      }
      catch { showToast("파일 형식이 올바르지 않습니다", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ─── 대장 양방향 연동: 전체 후보를 채용관리대장 회신용 JSON으로 내보내기 ────────
  const exportLedger = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      candidates: candidates.map(c => {
        const pos = positions.find(p => p.id === c.positionId);
        const v2 = c.analysis?.v2Scores;
        const fb = c.interviewFeedback;
        return {
          name: c.name,
          positionName: pos?.name || "미지정",
          channel: c.channel || "기타",
          stage: c.stage || "서류검토",
          starred: !!c.starred,
          portfolioCheck: c.portfolioCheck || null,
          conditions: c.conditions || null,
          fileRefs: c.fileRefs || [],
          manualScores: c.manualScores || null,
          manualTotal: c.manualScores ? v2WeightedTotal(c.manualScores) : null,
          manualScoredBy: c.manualScoredBy || null,
          questionScores: c.questionScores || null,
          onboarding: c.onboarding || null,
          analysisScore: v2 ? v2WeightedTotal(v2) : (c.analysis?.totalScore ?? null),
          aiVerdict: fb?.aiVerdict || c.analysis?.verdict || null,
          finalDecision: c.finalDecision?.result || null,
          interviewFeedbackSummary: fb?.summary || fb?.oneliner || null,
        };
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hirel_대장회신_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("대장 회신 JSON 저장 완료");
  };

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
  const decisionCandidate = candidates.find(c => c.id === decisionCandidateId);
  const decisionPosition = positions.find(p => p.id === decisionCandidate?.positionId);
  // 채널 필터 (포지션 필터와 AND 조합 — 대시보드/보드 공통) · ★ 별표만 필터 선적용
  const starFiltered = starredOnly ? candidates.filter(c => c.starred) : candidates;
  const channelFiltered = selectedChannel === "all" ? starFiltered : starFiltered.filter(c => (c.channel || "기타") === selectedChannel);
  const filteredCandidates = selectedPositionId === "all" ? channelFiltered : channelFiltered.filter(c => c.positionId === selectedPositionId);
  const grouped = positions.map(pos => ({ pos, cands: [...channelFiltered.filter(c => c.positionId === pos.id)].sort((a, b) => (b.analysis?.totalScore || 0) - (a.analysis?.totalScore || 0)) })).filter(g => g.cands.length > 0);

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
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 28px" }}>
            <InterviewRoom candidate={interviewCandidate} position={interviewPosition} onBack={() => { setView("detail"); setSelectedCandidateId(interviewCandidateId); }} onFinish={(t) => finishInterview(interviewCandidate, interviewPosition, t)} onUpdate={(patch) => updateCandidate(interviewCandidate.id, patch)} />
          </div>
        </div>
      </>
    );
  }

  if (view === "decision" && decisionCandidate) {
    return (
      <>
        <Head><title>HireL — 면접 결과 · 합의</title></Head>
        <div style={{ minHeight: "100vh", background: C.bg }}>
          <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 52, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${C.accent},${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>H</div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>HireL</span>
            <span style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />
            <span style={{ fontSize: 12, color: C.muted }}>면접 결과 · 합의 · {decisionPosition?.name}</span>
          </div>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 28px" }}>
            <DecisionRoom candidate={decisionCandidate} position={decisionPosition} isHost={isRoomHost || !syncEnabled} roomId={roomId} syncEnabled={syncEnabled} genLoading={genFeedbackFor === decisionCandidate.id} onSaveFinal={saveFinalDecision} onBack={() => { setView("detail"); setSelectedCandidateId(decisionCandidateId); }} showToast={showToast} />
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

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? C.red : C.green, color: "#fff", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.15)", transition: "all .3s" }}>
          {toast.type === "error" ? "❌ " : "✓ "}{toast.msg}
        </div>
      )}

      <input ref={importRef} type="file" accept=".json" hidden onChange={importJSON} />

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "0 12px" : "0 28px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", flexWrap: "wrap", minHeight: 56, padding: "8px 0", gap: isMobile ? 10 : 20, rowGap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${C.accent},${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>H</div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>HireL</span>
            <span style={{ fontSize: 10, color: C.muted, background: C.card, border: `1px solid ${C.border}`, padding: "2px 7px", borderRadius: 18 }}>BETA</span>
          </div>
          <div style={{ display: "flex", gap: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {[["dashboard", "대시보드"], ["board", "보드"], ["library", "자료실"], ["detail", "상세 분석"], ["report", "리포트"], ["onboarding", "온보딩"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: view === v ? 700 : 500, whiteSpace: "nowrap", background: view === v ? C.glow : "transparent", color: view === v ? C.accent : C.sub, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {!syncEnabled ? (
              <button onClick={createRoom} style={{ height: 34, padding: "0 13px", borderRadius: 8, background: "transparent", border: `1px solid ${C.green}45`, color: C.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block" }} />공유 시작
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: syncStatus === "connected" ? "rgba(16,185,129,.08)" : "rgba(245,158,11,.08)", border: `1px solid ${syncStatus === "connected" ? "rgba(16,185,129,.3)" : "rgba(245,158,11,.3)"}`, borderRadius: 8, padding: "0 11px", height: 34, whiteSpace: "nowrap" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: syncStatus === "connected" ? C.green : C.amber, animation: "pulse 1.5s ease infinite" }} />
                <span style={{ fontSize: 12, color: syncStatus === "connected" ? C.green : C.amber, fontWeight: 600 }}>
                  {isRoomHost ? `룸 ${roomId}` : syncStatus === "connected" ? "동기화" : "동기화 중"}
                </span>
                {isRoomHost && (
                  <button onClick={async () => {
                    await pushToRoom(roomId, { positions, candidates });
                    const u = `${window.location.origin}?room=${roomId}`;
                    await navigator.clipboard.writeText(u).catch(()=>{});
                    showToast("링크 복사됨!");
                  }} style={{ background: "none", border: "none", color: C.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: 0 }}>링크 복사</button>
                )}
                <button onClick={stopSync} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
              </div>
            )}
            <div style={{ position: "relative" }}>
              <button onClick={() => setDataMenu(v => !v)} style={{ height: 34, padding: "0 13px", borderRadius: 8, background: dataMenu ? C.glow : "transparent", border: `1px solid ${dataMenu ? C.accent : C.borderL}`, color: dataMenu ? C.accent : C.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>데이터 ▾</button>
              {dataMenu && (<>
                <div onClick={() => setDataMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 110 }} />
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, boxShadow: "0 10px 30px rgba(0,0,0,.13)", padding: 6, minWidth: 185 }}>
                  {[
                    ["📊 대장 내보내기", () => exportLedger(), C.text],
                    ["📤 팀 공유 (JSON 저장)", () => exportJSON(), C.text],
                    ["📥 불러오기", () => importRef.current?.click(), C.text],
                  ].map(([l, fn, col]) => (
                    <button key={l} onClick={() => { setDataMenu(false); fn(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", color: col, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{l}</button>
                  ))}
                  <div style={{ height: 1, background: C.border, margin: "5px 6px" }} />
                  <button onClick={() => { setDataMenu(false); if (confirm("저장된 데이터를 전부 초기화할까요?")) { localStorage.removeItem("hirel_data"); window.location.reload(); } }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", color: C.red, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>🗑 전체 초기화</button>
                </div>
              </>)}
            </div>
            <button onClick={() => { setEditingPosition(null); setShowPositionModal(true); }} style={{ height: 34, padding: "0 13px", borderRadius: 8, background: "transparent", border: `1px solid ${C.borderL}`, color: C.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ 포지션</button>
            <button onClick={openAddCandidate} style={{ height: 34, padding: "0 16px", borderRadius: 8, background: `linear-gradient(135deg,${C.accent},${C.teal})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,.12)" }}>+ 후보자</button>
          </div>
        </div>
      </div>

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
        {(view === "dashboard" || view === "board" || view === "library") && (
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 0 10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>채널</span>
            <button onClick={() => setSelectedChannel("all")} style={{ padding: "3px 11px", borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: selectedChannel === "all" ? C.glow : "transparent", border: `1px solid ${selectedChannel === "all" ? C.accent : C.border}`, color: selectedChannel === "all" ? C.accent : C.sub }}>
              전체 <span style={{ fontFamily: "'DM Mono',monospace" }}>{candidates.length}</span>
            </button>
            {CHANNELS.map(ch => {
              const col = CHANNEL_COLORS[ch];
              const cnt = candidates.filter(c => (c.channel || "기타") === ch).length;
              const on = selectedChannel === ch;
              return (
                <button key={ch} onClick={() => setSelectedChannel(on ? "all" : ch)} style={{ padding: "3px 11px", borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: on ? `${col}20` : "transparent", border: `1px solid ${on ? col : C.border}`, color: on ? col : C.sub }}>
                  {ch} <span style={{ fontFamily: "'DM Mono',monospace", color: on ? col : C.muted }}>{cnt}</span>
                </button>
              );
            })}
            <span style={{ width: 1, height: 14, background: C.border, margin: "0 4px" }} />
            <button onClick={() => setStarredOnly(s => !s)} style={{ padding: "3px 11px", borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: starredOnly ? `${STAR_COLOR}20` : "transparent", border: `1px solid ${starredOnly ? STAR_COLOR : C.border}`, color: starredOnly ? STAR_COLOR : C.sub }}>
              ★ 별표만 <span style={{ fontFamily: "'DM Mono',monospace", color: starredOnly ? STAR_COLOR : C.muted }}>{candidates.filter(c => c.starred).length}</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 28px" }}>
        {view === "report" && (
          <ReportView candidates={candidates} positions={positions} onExport={() => exportRecruitmentReport(candidates, positions)} />
        )}
        {view === "onboarding" && (
          <OnboardingView candidates={candidates} positions={positions} onUpdate={updateCandidate} showToast={showToast} />
        )}
        {view === "sim" && (() => {
          const c = candidates.find(x => x.id === selectedCandidateId);
          if (!c) return <div style={{ color: C.muted, padding: "40px 0", textAlign: "center" }}>후보를 먼저 선택하세요</div>;
          return <SimRoom candidate={c} position={positions.find(p => p.id === c.positionId)} onBack={() => setView("detail")} />;
        })()}
        {view === "library" && (
          <LibraryView candidates={filteredCandidates} positions={positions} onSelect={(id) => { setSelectedCandidateId(id); setActiveTab("overview"); setView("detail"); }} onToggleStar={toggleStar} />
        )}
        {view === "board" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>파이프라인 보드</h2>
                <span style={{ fontSize: 12, color: C.sub }}>총 {filteredCandidates.length}명 · ◀ ▶ 버튼으로 단계를 이동하세요</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", overflowX: "auto", paddingBottom: 16 }}>
              {STAGES.map(stage => {
                const col = STAGE_COLORS[stage] || C.sub;
                const isFail = stage === "탈락";
                const cands = filteredCandidates.filter(c => (c.stage || "서류검토") === stage);
                return (
                  <div key={stage}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const cid = e.dataTransfer.getData("text/plain");
                      if (!cid) return;
                      const cand = candidates.find(x => x.id === cid);
                      if (cand && (cand.stage || "서류검토") !== stage) {
                        updateCandidate(cid, { stage });
                        showToast(`${cand.name} — ${stage} 단계로 이동`);
                      }
                    }}
                    style={{ width: 232, minWidth: 232, flexShrink: 0, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 245px)", background: isFail ? "rgba(100,116,139,.08)" : C.surface, borderRadius: 12, border: `1px solid ${isFail ? C.border : `${col}35`}`, padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, padding: "2px 4px", flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: isFail ? C.muted : C.text }}>{stage}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{cands.length}</span>
                    </div>
                    <div style={{ overflowY: "auto", flex: 1, minHeight: 36, marginRight: -4, paddingRight: 4 }}>
                    {cands.length === 0 && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "14px 0" }}>비어 있음</div>}
                    {cands.map(c => {
                      const pos = positions.find(p => p.id === c.positionId);
                      const rc = ROLE_COLORS[pos?.colorIdx || 0];
                      const idx = STAGES.indexOf(c.stage || "서류검토");
                      const arrowBtn = (disabled) => ({ flex: 1, padding: "4px 0", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: disabled ? C.muted : C.sub, cursor: disabled ? "default" : "pointer", fontSize: 11, fontFamily: "inherit", opacity: disabled ? .35 : 1 });
                      return (
                        <div key={c.id} draggable
                          onDragStart={e => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; }}
                          style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: "10px 11px", marginBottom: 8, cursor: "grab" }}
                          onClick={() => { setSelectedCandidateId(c.id); setActiveTab("overview"); setView("detail"); }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</span>
                            <StarButton on={!!c.starred} onToggle={() => toggleStar(c.id)} size={14} />
                            {c.analysis && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: sc(c.analysis.totalScore), fontFamily: "'DM Mono',monospace" }}>{c.analysis.totalScore}</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: `${rc.accent}20`, border: `1px solid ${rc.accent}40`, color: rc.accent, fontWeight: 600 }}>{pos?.name || "미지정"}</span>
                            <ChannelBadge channel={c.channel} small />
                            {c.manualScores && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: C.glow, border: `1px solid ${C.accent}40`, color: C.accent, whiteSpace: "nowrap" }}>수동 {v2WeightedTotal(c.manualScores)}</span>}
                            {attachCount(c) > 0 && <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>📎{attachCount(c)}</span>}
                          </div>
                          {c.portfolioCheck?.checked && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: C.green, marginBottom: 6 }}>✓ 포트폴리오 확인됨 ({c.portfolioCheck.by || "확인자"} · {c.portfolioCheck.at ? new Date(c.portfolioCheck.at).toLocaleDateString("ko-KR") : ""})</div>
                          )}
                          {stage === "포트폴리오확인" && !c.portfolioCheck?.checked && (
                            <div onClick={e => e.stopPropagation()} style={{ marginBottom: 7 }}>
                              <PortfolioCheck candidate={c} compact onUpdate={pc => updateCandidate(c.id, { portfolioCheck: pc })} />
                            </div>
                          )}
                          <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 5 }}>
                            <button disabled={idx <= 0} onClick={() => moveStage(c, -1)} style={arrowBtn(idx <= 0)} title="이전 단계">◀</button>
                            <button disabled={idx >= STAGES.length - 1} onClick={() => moveStage(c, 1)} style={arrowBtn(idx >= STAGES.length - 1)} title="다음 단계">▶</button>
                            {!isFail && (
                              <button onClick={() => { updateCandidate(c.id, { stage: "탈락" }); showToast(`${c.name} — 탈락 처리됨`); }}
                                style={{ ...arrowBtn(false), flex: "0 0 auto", padding: "4px 9px", color: C.red, borderColor: `${C.red}50` }} title="바로 불합격 (탈락으로 이동)">불합격</button>
                            )}
                            {isFail && (
                              <button onClick={() => { updateCandidate(c.id, { stage: "서류검토" }); showToast(`${c.name} — 서류검토로 복구`); }}
                                style={{ ...arrowBtn(false), flex: "0 0 auto", padding: "4px 9px", color: C.teal, borderColor: `${C.teal}50` }} title="탈락 취소 (서류검토로 복구)">복구</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                        {cands.map(c => (<CandidateCard key={c.id} c={c} rc={rc} position={pos} analyzingIds={analyzingIds} vStyle={vStyle} onSelect={() => { setSelectedCandidateId(c.id); setActiveTab("overview"); setView("detail"); }} onInterview={() => { setInterviewCandidateId(c.id); setView("interview"); }} onReanalyze={() => doAnalyze(c)} onExportPDF={() => exportCandidatePDF(c, pos)} onDecision={() => { setDecisionCandidateId(c.id); setView("decision"); }} onToggleStar={() => toggleStar(c.id)} onStage={(st) => quickStage(c, st)} />))}
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
                  return (<CandidateCard key={c.id} c={c} rc={rc} position={pos} analyzingIds={analyzingIds} vStyle={vStyle} onSelect={() => { setSelectedCandidateId(c.id); setActiveTab("overview"); setView("detail"); }} onInterview={() => { setInterviewCandidateId(c.id); setView("interview"); }} onReanalyze={() => doAnalyze(c)} onExportPDF={() => exportCandidatePDF(c, pos)} onDecision={() => { setDecisionCandidateId(c.id); setView("decision"); }} onToggleStar={() => toggleStar(c.id)} onStage={(st) => quickStage(c, st)} />);
                })}
              </div>
            )}
          </div>
        )}

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
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, rowGap: 10, marginBottom: 24 }}>
                    <button onClick={() => setView("dashboard")} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 13px", color: C.sub, cursor: "pointer", fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>← 목록</button>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: `${rc.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 800, color: rc.accent, flexShrink: 0 }}>{c.name[0]}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 9, rowGap: 5 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, whiteSpace: "nowrap" }}>{c.name}</h2>
                        <StarButton on={!!c.starred} onToggle={() => toggleStar(c.id)} size={20} />
                        <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 14, background: `${rc.accent}20`, border: `1px solid ${rc.accent}40`, color: rc.accent, fontWeight: 600, whiteSpace: "nowrap" }}>{pos?.name}</span>
                        <ChannelBadge channel={c.channel} />
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: `${STAGE_COLORS[c.stage || "서류검토"]}18`, border: `1px solid ${STAGE_COLORS[c.stage || "서류검토"]}40`, color: STAGE_COLORS[c.stage || "서류검토"], fontWeight: 600, whiteSpace: "nowrap" }}>{c.stage || "서류검토"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.sub }}>{c.age ? `${c.age}세` : ""}{attachCount(c) > 0 && <span style={{ marginLeft: 8 }}>📎{attachCount(c)} · {[...(c.fileNames || []), ...((c.fileRefs || []).map(r => r.name))].join(", ")}</span>}</div>
                    </div>
                    {a && !busy && (
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, rowGap: 8 }}>
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: sc(a.totalScore), fontFamily: "'DM Mono',monospace" }}>{a.totalScore}</div>
                          <div style={{ fontSize: 11, color: C.sub, whiteSpace: "nowrap" }}>종합 점수</div>
                        </div>
                        <div style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: vStyle(a.verdict).bg, border: `1px solid ${vStyle(a.verdict).border}`, color: vStyle(a.verdict).color, whiteSpace: "nowrap" }}>{a.verdict}</div>
                        <button onClick={() => exportCandidatePDF(c, pos)} style={{ ...BP(`linear-gradient(135deg,#64748B,#475569)`), padding: "8px 14px", fontSize: 13 }}>📄 PDF 저장</button>
                        <button onClick={() => { setInterviewCandidateId(c.id); setView("interview"); }} style={{ ...BP(`linear-gradient(135deg,${C.purple},${C.pink})`), padding: "8px 14px", fontSize: 13 }}>🎤 면접 시작</button>
                        <button onClick={() => setView("sim")} title="AI가 이 후보를 연기 — 예상 답변 리허설" style={{ ...BP("transparent"), border: `1px solid ${C.purple}45`, color: C.purple, boxShadow: "none", padding: "8px 14px", fontSize: 13 }}>🎭 시뮬레이션</button>
                        <button onClick={() => doAnalyze(c)} style={{ ...BP(), padding: "8px 14px", fontSize: 13 }}>재분석</button>
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 8 }}>📁 포트폴리오 확인</div>
                    <PortfolioCheck candidate={c} onUpdate={pc => updateCandidate(c.id, { portfolioCheck: pc })} />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 8 }}>📎 첨부 자료 <span style={{ fontWeight: 400, color: C.muted }}>· 원본은 사내 폴더 보관, 여기엔 경로만</span></div>
                    <FileRefsSection candidate={c} onUpdate={fr => updateCandidate(c.id, { fileRefs: fr })} showToast={showToast} />
                    <div style={{ marginTop: 12 }}>
                      <ConditionsCard candidate={c} onUpdate={patch => updateCandidate(c.id, patch)} />
                    </div>
                  </div>
                  {a && !busy && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>🗳 면접 결과 · 합의</span>
                        <button onClick={() => { setDecisionCandidateId(c.id); setView("decision"); }} style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", color: C.sub, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>합의·결정 화면 열기 →</button>
                      </div>
                      <DecisionSummary candidate={c} />
                      <div style={{ marginTop: 10 }}>
                        <QuestionScoreSummary candidate={c} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 3, marginBottom: 20, background: C.card, padding: 3, borderRadius: 10, width: "fit-content", border: `1px solid ${C.border}` }}>
                    {[["overview", "📊 종합"], ["keywords", "🏷 키워드"], ["interview", "💬 면접 질문"], ["resume", "📄 이력서"]].map(([tab, l]) => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 500, background: activeTab === tab ? C.accent : "transparent", color: activeTab === tab ? "#fff" : C.sub, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>{l}</button>
                    ))}
                  </div>
                  {busy ? <Spin label="AI가 분석하고 있습니다..." /> : !a ? (
                    <div>
                      <div style={{ textAlign: "center", padding: "26px 0" }}><button onClick={() => doAnalyze(c)} style={BP()}>AI 분석 시작</button></div>
                      <div style={{ maxWidth: 560 }}>
                        <ManualV2Card candidate={c} onSave={patch => updateCandidate(c.id, patch)} showToast={showToast} />
                      </div>
                    </div>
                  ) : (<>
                    {activeTab === "overview" && (
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                        <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 22 }}>
                          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: C.sub }}>SCORE BREAKDOWN</h3>
                          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 20 }}>
                            <Ring score={a.scores.experienceMatch} label="직무 경험" color={rc.accent} />
                            <Ring score={a.scores.cultureFit} label="문화 적합도" color={C.teal} />
                            <Ring score={a.scores.skillKeywords} label="역량 키워드" color={C.green} />
                            <Ring score={a.scores.stability} label="안정성" color={C.amber} />
                            <Ring score={a.scores.portfolioMatch} label="포트폴리오" color={C.purple} />
                            <Ring score={a.scores.growthPotential} label="성장가능성" color={C.pink} />
                          </div>
                          <div style={{ height: 1, background: C.border, margin: "0 0 18px" }} />
                          <Bar label="직무 경험 매칭" score={a.scores.experienceMatch} revised={c.interviewFeedback?.revisedScores?.experienceMatch} />
                          <Bar label="가치관/문화 적합도" score={a.scores.cultureFit} revised={c.interviewFeedback?.revisedScores?.cultureFit} />
                          <Bar label="역량 키워드 분석" score={a.scores.skillKeywords} revised={c.interviewFeedback?.revisedScores?.skillKeywords} />
                          <Bar label="이직 패턴/안정성" score={a.scores.stability} revised={c.interviewFeedback?.revisedScores?.stability} />
                          <Bar label="포트폴리오 적합도" score={a.scores.portfolioMatch} revised={c.interviewFeedback?.revisedScores?.portfolioMatch} />
                          <Bar label="성장 가능성" score={a.scores.growthPotential} revised={c.interviewFeedback?.revisedScores?.growthPotential} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 18 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>✦ AI 요약</h3>
                            <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, margin: 0 }}>{a.summary}</p>
                          </div>
                          <ManualV2Card candidate={c} onSave={patch => updateCandidate(c.id, patch)} showToast={showToast} />
                          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>강점</h3>
                            {a.strengths?.map((s, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: C.green }}>✓</span><span style={{ fontSize: 13, color: C.sub }}>{s}</span></div>)}
                          </div>
                          <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 16 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>약점 / 우려사항</h3>
                            {a.weaknesses?.map((w, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ color: C.amber }}>△</span><span style={{ fontSize: 13, color: C.sub }}>{w}</span></div>)}
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === "keywords" && (
                      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 24 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>역량 키워드 분석</h3>
                        <p style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>JD 매칭 여부에 따라 색상 구분</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{a.keywords?.map((kw, i) => <Tag key={i} text={kw.word} type={kw.type} />)}</div>
                      </div>
                    )}
                    {activeTab === "interview" && (
                      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                          <div><h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>AI 추천 면접 질문 20개</h3><p style={{ fontSize: 12, color: C.sub, margin: 0 }}>큐라엘 컬쳐핏 기반 맞춤 생성</p></div>
                          <button onClick={() => { setInterviewCandidateId(c.id); setView("interview"); }} style={{ ...BP(`linear-gradient(135deg,${C.purple},${C.pink})`), padding: "8px 16px", fontSize: 13 }}>🎤 면접 시작</button>
                        </div>
                        {(() => {
                          const iq = a.interviewQuestions;
                          if (iq && typeof iq === "object" && !Array.isArray(iq)) {
                            return [["🧡 인성/컬쳐핏", iq.culture||[], C.amber], ["💼 직무 역량", iq.skill||[], C.accent], ["🚀 미래/방향성", iq.future||[], C.purple], ["⚠️ 킬패스/단점", iq.killpath||[], C.red], ["💡 자기계발", iq.growth||[], C.green], ["📊 데이터 실전능력", iq.dataSkill||[], C.teal], ["⚡ 실행력", iq.execution||[], "#F97316"]].map(([label, qs, color]) => (
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <InterviewResumeCard candidate={c} />
                      <div style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 24 }}>
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
                      </div>
                    )}
                  </>)}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {showAddCandidate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 10px 40px rgba(0,0,0,.12)", padding: 28, width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>후보자 등록</h3>
              <button onClick={() => setShowAddCandidate(false)} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 16 }}>
              <div><label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 5 }}>이름 *</label><input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="홍길동" style={IS} /></div>
              <div><label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 5 }}>나이</label><input value={addForm.age} onChange={e => setAddForm(p => ({ ...p, age: e.target.value }))} placeholder="30" type="number" style={IS} /></div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 5 }}>지원 채널</label>
              <select value={addForm.channel || "기타"} onChange={e => setAddForm(p => ({ ...p, channel: e.target.value }))} style={{ ...IS, cursor: "pointer" }}>
                {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            <label style={{ fontSize: 13, color: C.sub, display: "block", marginBottom: 8 }}>포지션 선택 *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {positions.map(pos => {
                const rc = ROLE_COLORS[pos.colorIdx || 0];
                const s = addForm.positionId === pos.id;
                return (<button key={pos.id} onClick={() => setAddForm(p => ({ ...p, positionId: pos.id, showNewPos: false }))} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 9, border: `1px solid ${s ? rc.accent : C.border}`, background: s ? rc.glow : C.surface, color: s ? rc.accent : C.sub, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500, transition: "all .15s" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: rc.accent }} />{pos.name}
                </button>);
              })}
              <button onClick={() => setAddForm(p => ({ ...p, showNewPos: !p.showNewPos, positionId: "" }))}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: `1px dashed ${addForm.showNewPos ? C.accent : C.borderL}`, background: addForm.showNewPos ? C.glow : "transparent", color: addForm.showNewPos ? C.accent : C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
                + 새 포지션
              </button>
            </div>

            {addForm.showNewPos && (
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.accent}40`, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 12 }}>✦ 새 포지션 만들기</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 10 }}>
                  <input value={addForm.newPosName || ""} onChange={e => setAddForm(p => ({ ...p, newPosName: e.target.value }))} placeholder="포지션명 (예: 마케터)" style={{ ...IS }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    {ROLE_COLORS.map((rc, i) => (
                      <div key={i} onClick={() => setAddForm(p => ({ ...p, newPosColorIdx: i }))} style={{ width: 22, height: 22, borderRadius: "50%", background: rc.accent, cursor: "pointer", border: `2px solid ${(addForm.newPosColorIdx ?? 0) === i ? "#111827" : "transparent"}`, flexShrink: 0 }} />
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

            <div style={{ display: "flex", background: C.surface, borderRadius: 8, padding: 3, border: `1px solid ${C.border}`, marginBottom: 13 }}>
              {[["file", "📎 파일 업로드"], ["text", "✏️ 텍스트 입력"]].map(([m, l]) => (
                <button key={m} onClick={() => setAddForm(p => ({ ...p, inputMode: m }))} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, background: addForm.inputMode === m ? C.accent : "transparent", color: addForm.inputMode === m ? "#fff" : C.sub, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>{l}</button>
              ))}
            </div>
            {addForm.inputMode === "file" && <UploadZone onReady={setUploadedFiles} maxFiles={3} onLimit={() => showToast("최대 3개까지 업로드됩니다", "error")} />}
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
