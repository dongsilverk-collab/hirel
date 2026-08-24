// 서류 스크리닝 보드 — 사람인·잡코리아 지원자 27명, 클릭으로 면접 리스트/불합격/보류 결정
// 결정은 /api/screening(Firebase rooms/_screening)에 자동 저장 → Claude가 읽어 후속 처리
import { useEffect, useState } from "react";
import Head from "next/head";

const CANDS = [
  { id: "s01", rank: 1, name: "김소영", pf: "잡코리아", age: 32, car: "3.8년", co: "뉴트리엄(캐나다·건기식)", pay: "면접 후 결정", plus: "건기식 직경험 + 오늘도 우리 공고 스크랩(관심 지속)", risk: "해외 경력의 국내 매체 적응 확인", grade: "A-" },
  { id: "s02", rank: 2, name: "이주현", pf: "사람인", age: 31, car: "4.4년", co: "엠플랜잇", pay: "4,000~5,000", plus: "퍼포먼스 직군 지원 · 연차·예산 모두 적합", risk: "식품 경험 미확인", grade: "A-" },
  { id: "s03", rank: 3, name: "박혜원", pf: "잡코리아", age: 30, car: "3.5년", co: "센트럴팜(제약)", pay: "면접 후 결정", plus: "제약·건기식 인접 + 실무 연차대", risk: "마케팅 업무 범위 미확인", grade: "B+" },
  { id: "s04", rank: 4, name: "김문정", pf: "잡코리아", age: 32, car: "6.6년", co: "푸치마켓(커머스)", pay: "면접 후 결정", plus: "온라인마케터 6.6년 + Cafe24·GA(자사몰 정합)", risk: "디자인학과 재학 병행", grade: "B+" },
  { id: "s05", rank: 5, name: "김민성", pf: "사람인", age: 30, car: "4.9년", co: "퍼널먼스", pay: "4,000~5,000", plus: "퍼포먼스 대행 추정 · 예산 내", risk: "고졸 — 실적으로 검증 필요", grade: "B+" },
  { id: "s06", rank: 6, name: "김수연", pf: "사람인", age: 35, car: "6.5년", co: "맥널티바이오", pay: "4,000~5,000", plus: "식품 인접 + 외대(학점 4.01) + 예산 내", risk: "콘텐츠/퍼포먼스 실무 비중 미확인", grade: "B" },
  { id: "s07", rank: 7, name: "이승우", pf: "잡코리아", age: 26, car: "1.5년", co: "우리식품(재직중)", pay: "면접 후 결정", plus: "식품 마케팅 현직 주니어", risk: "연차 부족 · 과거 면접제의 무응답", grade: "B" },
  { id: "s08", rank: 8, name: "장형우", pf: "사람인", age: 32, car: "5.3년", co: "레이델코리아(건기식)", pay: "6,000~7,000 ⚠", plus: "건기식 인하우스 + 서강대 석사 — 스펙 최상", risk: "예산(5,500) 초과 — 기대 관리 필수", grade: "B" },
  { id: "s09", rank: 9, name: "오원석", pf: "잡코리아", age: 30, car: "4.4년", co: "마이디어코리아", pay: "면접 후 결정", plus: "연차대 적합", risk: "업종·직무 불명", grade: "B-" },
  { id: "s10", rank: 10, name: "이희재", pf: "사람인", age: 30, car: "8.4년", co: "히찌네", pay: "5,000~6,000", plus: "연차 풍부", risk: "희망연봉 상한 걸침 · 회사 규모 불명", grade: "B-" },
  { id: "s11", rank: 11, name: "이진호", pf: "잡코리아", age: 27, car: "1.1년", co: "와이브랜즈(재직중)", pay: "면접 후 결정", plus: "브랜드기획 주니어", risk: "연차 부족", grade: "C+" },
  { id: "s12", rank: 12, name: "박민웅", pf: "사람인", age: 31, car: "2.6년", co: "루미르", pay: "면접 후 결정", plus: "연차 하한 적합", risk: "직무 상세 불명", grade: "C+" },
  { id: "s13", rank: 13, name: "서민경", pf: "사람인", age: 31, car: "3년", co: "비이오케이", pay: "회사내규", plus: "연차 적합", risk: "직무 상세 불명", grade: "C+" },
  { id: "s14", rank: 14, name: "인혜", pf: "잡코리아", age: 31, car: "5년", co: "블라드컴퍼니", pay: "면접 후 결정", plus: "연차 적합(제휴사업)", risk: "마케팅 실무 비중 미확인", grade: "C+" },
  { id: "s15", rank: 15, name: "최지욱", pf: "잡코리아", age: 31, car: "5.4년", co: "마크로밀엠브레인", pay: "면접 후 결정", plus: "리서치 데이터 감각 기대", risk: "리서치 계열 — 소재·매체 손 미확인", grade: "C+" },
  { id: "s16", rank: 16, name: "정유철", pf: "사람인", age: 40, car: "11.1년", co: "동일제약", pay: "6,000~7,000 ⚠", plus: "제약 마케팅 시니어", risk: "총괄형 + 예산 초과", grade: "제외 제안" },
  { id: "s17", rank: 17, name: "양용규", pf: "사람인", age: 33, car: "6년", co: "아루", pay: "연봉 6,700 ⚠", plus: "중앙대 경영", risk: "예산 초과", grade: "제외 제안" },
  { id: "s18", rank: 18, name: "장정민", pf: "잡코리아", age: 24, car: "6.6년", co: "도그마루", pay: "4,300", plus: "실무 이력 김", risk: "학력·업종 비정합(반려동물 분양)", grade: "제외 제안" },
  { id: "s19", rank: 19, name: "곽호진", pf: "사람인", age: 42, car: "12.8년", co: "엠아이디파트너스", pay: "회사내규", plus: "-", risk: "총괄형 연령대", grade: "제외 제안" },
  { id: "s20", rank: 20, name: "정지구", pf: "사람인", age: 46, car: "15.9년", co: "메타리치", pay: "면접 후 결정", plus: "-", risk: "총괄형 연령대", grade: "제외 제안" },
  { id: "s21", rank: 21, name: "김정균", pf: "사람인", age: 45, car: "13.5년", co: "델프코리아", pay: "연봉 6,000 ⚠", plus: "-", risk: "총괄형 + 예산 초과", grade: "제외 제안" },
  { id: "s22", rank: 22, name: "신중환", pf: "잡코리아", age: 43, car: "12.1년", co: "디만트코리아", pay: "면접 후 결정", plus: "홍익대 광고홍보 · 공고 스크랩", risk: "총괄형(마케팅기획)", grade: "제외 제안" },
  { id: "s23", rank: 23, name: "박병국", pf: "잡코리아", age: 49, car: "23.9년", co: "스마트푸드네트웍스(재직중)", pay: "면접 후 결정", plus: "식품 디지털마케팅 본부", risk: "총괄급 — 실행자 포지션 비정합", grade: "제외 제안" },
  { id: "s24", rank: 24, name: "박지니", pf: "양쪽", age: 46, car: "20년", co: "키출판사", pay: "희망 9,000 ⚠", plus: "-", risk: "예산 대폭 초과", grade: "제외 제안" },
  { id: "s25", rank: 25, name: "임치훈", pf: "사람인", age: 46, car: "13.6년", co: "더블유제이", pay: "연봉 6,500 ⚠", plus: "-", risk: "총괄형 + 예산 초과", grade: "제외 제안" },
  { id: "s26", rank: 26, name: "송승현", pf: "잡코리아", age: 37, car: "7.1년", co: "셀게이트", pay: "면접 후 결정", plus: "온라인마케팅 경력", risk: "직전 직함 '총괄' — 실행 손 확인 필요", grade: "제외 제안" },
  { id: "s27", rank: 27, name: "김지홍", pf: "사람인", age: 43, car: "9.2년", co: "라익미", pay: "4,000~5,000", plus: "예산 내", risk: "총괄형 연령대 · 만화창작 전공 경로 불명", grade: "제외 제안" },
];

const DC = { pass: "#0f9d6a", fail: "#d64545", hold: "#b58a2c" };
const DL = { pass: "✅ 면접 리스트", fail: "❌ 불합격", hold: "🤔 보류" };

export default function Screening() {
  const [dec, setDec] = useState({});
  const [filter, setFilter] = useState("all");
  const [showExcluded, setShowExcluded] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let local = {};
    try { local = JSON.parse(localStorage.getItem("screening_dec") || "{}"); } catch (e) {}
    setDec(local);
    fetch("/api/screening").then(r => r.json()).then(d => {
      if (d && typeof d === "object") {
        const server = {};
        Object.entries(d).forEach(([k, v]) => { if (v && v.decision) server[k] = v.decision; });
        setDec(p => ({ ...p, ...server }));
      }
    }).catch(() => {});
  }, []);

  const setDecision = (id, val) => {
    setDec(p => {
      const next = { ...p };
      if (next[id] === val) delete next[id]; else next[id] = val;
      try { localStorage.setItem("screening_dec", JSON.stringify(next)); } catch (e) {}
      fetch("/api/screening", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision: next[id] || null }) })
        .then(() => { setSaved("저장됨 ✓"); setTimeout(() => setSaved(""), 1500); })
        .catch(() => setSaved("⚠ 저장 실패 — 네트워크 확인"));
      return next;
    });
  };

  const passList = CANDS.filter(c => dec[c.id] === "pass");
  const cnt = { pass: passList.length, fail: CANDS.filter(c => dec[c.id] === "fail").length, hold: CANDS.filter(c => dec[c.id] === "hold").length };
  const visible = CANDS.filter(c => {
    if (filter !== "all" && dec[c.id] !== filter) return false;
    if (filter === "all" && c.grade === "제외 제안" && !showExcluded && !dec[c.id]) return false;
    return true;
  });

  const gradeColor = (g) => g.startsWith("A") ? "#0f9d6a" : g === "제외 제안" ? "#999" : g.startsWith("B") ? "#2b6cb0" : "#b58a2c";

  return (
    <div style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif", background: "#f4f7f5", minHeight: "100vh", color: "#1e2b26" }}>
      <Head>
        <title>서류 스크리닝 보드</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #dfe8e3", padding: "12px 16px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 17 }}>📋 서류 스크리닝</b>
            <span style={{ fontSize: 12, color: "#5a6b64" }}>사람인·잡코리아 27명 · 2026-08-24</span>
            <span style={{ fontSize: 12, color: "#0f9d6a", fontWeight: 700, marginLeft: "auto" }}>{saved}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {[["all", `전체`], ["pass", `✅ 면접 ${cnt.pass}`], ["hold", `🤔 보류 ${cnt.hold}`], ["fail", `❌ 불합격 ${cnt.fail}`]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: "7px 14px", borderRadius: 18, border: `1.5px solid ${filter === k ? "#0f9d6a" : "#dfe8e3"}`, background: filter === k ? "#e6f5ee" : "#fff", color: filter === k ? "#0b7d55" : "#5a6b64", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
          {passList.length > 0 && (
            <div style={{ marginTop: 10, background: "#e6f5ee", border: "1px solid #b9e2cf", borderRadius: 10, padding: "8px 12px", fontSize: 13.5 }}>
              <b style={{ color: "#0b7d55" }}>면접 볼 사람 ({passList.length}):</b> {passList.map(c => c.name).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 12px 60px" }}>
        {visible.map(c => {
          const d = dec[c.id];
          return (
            <div key={c.id} style={{ background: "#fff", border: `1.5px solid ${d ? DC[d] + "66" : "#e2ebe6"}`, borderLeft: `5px solid ${d ? DC[d] : gradeColor(c.grade)}`, borderRadius: 12, padding: "13px 15px", marginBottom: 10, opacity: d === "fail" ? 0.65 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "#999", fontWeight: 700, minWidth: 22 }}>#{c.rank}</span>
                <b style={{ fontSize: 16 }}>{c.name}</b>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: gradeColor(c.grade), border: `1px solid ${gradeColor(c.grade)}55`, borderRadius: 10, padding: "1px 8px" }}>{c.grade}</span>
                <span style={{ fontSize: 12, color: "#5a6b64" }}>{c.pf} · {c.age}세 · 경력 {c.car}</span>
                {d && <span style={{ fontSize: 11.5, fontWeight: 800, color: DC[d], marginLeft: "auto" }}>{DL[d]}</span>}
              </div>
              <div style={{ fontSize: 13.5, marginTop: 6 }}>
                <b>{c.co}</b> <span style={{ color: "#5a6b64" }}>· 희망 {c.pay}</span>
              </div>
              <div style={{ fontSize: 13, color: "#2b6cb0", marginTop: 4 }}>👍 {c.plus}</div>
              <div style={{ fontSize: 13, color: "#b0553a", marginTop: 2 }}>⚠ {c.risk}</div>
              <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                {["pass", "hold", "fail"].map(v => (
                  <button key={v} onClick={() => setDecision(c.id, v)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${d === v ? DC[v] : "#dfe8e3"}`, background: d === v ? DC[v] : "#fff", color: d === v ? "#fff" : "#5a6b64", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                    {DL[v]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {filter === "all" && (
          <button onClick={() => setShowExcluded(v => !v)} style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "1.5px dashed #c6d4cc", background: "transparent", color: "#5a6b64", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
            {showExcluded ? "▲ 제외 제안 후보 접기" : `▼ 제외 제안 후보 ${CANDS.filter(c => c.grade === "제외 제안" && !dec[c.id]).length}명 펼치기 (총괄형·예산 초과)`}
          </button>
        )}

        <p style={{ fontSize: 12, color: "#8a978f", textAlign: "center", marginTop: 18, lineHeight: 1.7 }}>
          클릭하면 자동 저장되고, Claude가 결과를 읽어 면접 리스트 정리·대장 기록을 이어받습니다.<br />
          불합격 통보·면접 제의 발송은 자동으로 나가지 않습니다 — 명단 확인 후 별도 승인으로만 진행합니다.
        </p>
      </div>
    </div>
  );
}
