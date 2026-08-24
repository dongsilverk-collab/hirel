// 큐라엘 공개 커리어 페이지 — EVP·공고 v3 기반. 지원서는 /api/apply → HireL 접수함으로 들어온다.
import { useState } from "react";
import Head from "next/head";

const G = "#0f9d6a", GD = "#0b7d55", TXT = "#1c2b26", SUB = "#5a6b64", BG = "#f7faf8", CARD = "#ffffff", BORDER = "#e2ebe6";

const S = {
  wrap: { fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif", background: BG, color: TXT, minHeight: "100vh", lineHeight: 1.65 },
  inner: { maxWidth: 760, margin: "0 auto", padding: "0 20px 80px" },
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "22px 24px", marginBottom: 16 },
  h2: { fontSize: 19, fontWeight: 800, margin: "0 0 12px" },
  li: { margin: "0 0 8px", fontSize: 14.5, color: SUB },
  label: { display: "block", fontSize: 12.5, fontWeight: 700, color: SUB, margin: "14px 0 5px" },
  input: { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 14.5, fontFamily: "inherit", background: "#fff", color: TXT, outline: "none" },
};

export default function Careers() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", career: "", status: "", salary: "", portfolio: "", intro: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setErr("");
    if (!form.name.trim()) return setErr("이름을 입력해 주세요.");
    if (!form.phone.trim() && !form.email.trim()) return setErr("연락처 또는 이메일 중 하나는 필요합니다.");
    setSending(true);
    try {
      const r = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error("전송 실패");
      setDone(true);
    } catch (e) {
      setErr("전송에 실패했습니다. 잠시 후 다시 시도하시거나 godls@curael.kr로 보내주세요.");
    }
    setSending(false);
  };

  return (
    <div style={S.wrap}>
      <Head>
        <title>큐라엘 채용 — 1호 마케터</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="암 환우와 회복기 환자를 위한 식품 브랜드 큐라엘이 1호 마케터를 찾습니다." />
      </Head>

      {/* 히어로 */}
      <div style={{ background: `linear-gradient(150deg, ${GD}, ${G})`, color: "#fff", padding: "56px 20px 48px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, letterSpacing: 2 }}>CURAEL CAREERS</div>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 800, margin: "10px 0 14px", lineHeight: 1.3 }}>
            마케팅 메시지 하나가<br />누군가의 회복기 식탁을 바꿉니다
          </h1>
          <p style={{ fontSize: 15.5, opacity: 0.92, maxWidth: 560, margin: 0 }}>
            큐라엘은 암 환우와 회복기 환자를 위한 식품 브랜드입니다. 약사 대표가 만들고, 상담약국과 고객 팬덤이 검증한 이야기가 이미 쌓여 있습니다.
            이걸 온라인으로 옮길 <b>1호 마케터</b>를 찾습니다.
          </p>
        </div>
      </div>

      <div style={{ ...S.inner, marginTop: -20 }}>
        {/* 미션 */}
        <div style={{ ...S.card, borderLeft: `4px solid ${G}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: G, marginBottom: 6 }}>이 자리의 미션</div>
          <div style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.55 }}>
            오프라인·상담·유튜브에서 검증된 이야기를 온라인 콘텐츠와 광고로 옮겨, 자사몰 신규→재구매 루프를 직접 만듭니다.
          </div>
        </div>

        {/* 하는 일 */}
        <div style={S.card}>
          <h2 style={S.h2}>하는 일</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={S.li}>광고 소재 직접 제작 — 원천 소재(대표 유튜브·상담 사례·고객 후기)는 이미 준비돼 있습니다</li>
            <li style={S.li}>메타·네이버 광고 직접 운영 — 세팅부터 최적화까지 본인 손으로</li>
            <li style={S.li}>자사몰 상세페이지·전환율 개선 — 클릭 데이터 트래킹이 구축돼 있습니다</li>
            <li style={S.li}>재구매·고객추천 프로그램 설계와 운영</li>
          </ul>
        </div>

        {/* 혼자가 아닙니다 */}
        <div style={S.card}>
          <h2 style={S.h2}>혼자가 아닙니다</h2>
          <p style={{ fontSize: 14, color: SUB, margin: "0 0 10px" }}>사수는 없습니다. 대신 이렇게 지원합니다 — 말이 아니라 구조로.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={S.li}><b style={{ color: TXT }}>외부 시니어 마케터의 월 2회 정기 리뷰</b> — 방향·소재·매체 세팅 검토</li>
            <li style={S.li}><b style={{ color: TXT }}>명문화된 미션·우선순위·지표 문서</b> — "뭘 해야 하는지 모르는" 상태가 없습니다</li>
            <li style={S.li}><b style={{ color: TXT }}>주간 대표 리뷰 30분</b> — 지표 기준으로만, 감 지시 없음</li>
            <li style={S.li}><b style={{ color: TXT }}>AI 실무 지원 체계</b> — 소재 초안, 데이터 분석, 심의 사전 체크</li>
          </ul>
        </div>

        {/* 솔직한 조건 */}
        <div style={{ ...S.card, background: "#fbf8f2", border: "1px solid #eadfc8" }}>
          <h2 style={S.h2}>먼저 말씀드리는 조건</h2>
          <p style={{ fontSize: 14, color: SUB, margin: "0 0 10px" }}>숨겼다가 입사 후에 아는 것보다, 지금 아는 게 서로에게 낫다고 믿습니다.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={S.li}>마케팅팀 팀원은 0명 — 본인이 1호이고, 처음엔 손이 많이 가는 실무의 자리입니다</li>
            <li style={S.li}>연봉 상한 5,500 — 시장 최고 대우는 아닙니다. 대신 성과에 따른 성장과 아래의 것들이 있습니다</li>
            <li style={S.li}>입사 초 3개월은 상호 검증 기간 — 판단 기준은 입사 첫날 문서로 드립니다</li>
          </ul>
        </div>

        {/* 주는 것 */}
        <div style={S.card}>
          <h2 style={S.h2}>대신 이걸 드립니다</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={S.li}><b style={{ color: TXT }}>전권</b> — 대표 직속, 결재 단계 없음. 소재 하나 바꾸는 데 회의 세 번 하는 조직이 아닙니다</li>
            <li style={S.li}><b style={{ color: TXT }}>팀장이 될 기회</b> — 성과를 내면 팀은 본인 중심으로 만들어집니다</li>
            <li style={S.li}><b style={{ color: TXT }}>의미</b> — 고객은 암 환우와 그 가족입니다. 이 일은 숫자 이상의 무게가 있습니다</li>
            <li style={S.li}><b style={{ color: TXT }}>속도</b> — 기획서보다 실험. 2주 단위로 만들어 돌리고 수치로 검증합니다</li>
          </ul>
        </div>

        {/* 전형 절차 */}
        <div style={S.card}>
          <h2 style={S.h2}>전형 절차</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
            {["서류", "1차 대화", "소형 과제 (2시간 이내)", "과제 리뷰", "처우 협의"].map((s, i) => (
              <span key={s} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "6px 14px", color: i === 2 ? G : SUB }}>{i + 1}. {s}</span>
            ))}
          </div>
          <p style={{ fontSize: 13, color: SUB, margin: "12px 0 0" }}>과제는 2시간 이상 쓰지 마세요 — 완성도가 아니라 판단을 봅니다. 결과물은 채용 여부와 무관하게 사용하지 않습니다.</p>
        </div>

        {/* 지원 폼 */}
        <div style={{ ...S.card, border: `2px solid ${G}` }}>
          <h2 style={S.h2}>지원하기</h2>
          {done ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 800, margin: "10px 0 6px" }}>지원서가 접수되었습니다</div>
              <div style={{ fontSize: 14, color: SUB }}>영업일 3일 안에 연락드리겠습니다. 감사합니다, {form.name}님.</div>
            </div>
          ) : (
            <>
              <label style={S.label}>이름 *</label>
              <input style={S.input} value={form.name} onChange={set("name")} placeholder="홍길동" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>연락처 *</label>
                  <input style={S.input} value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" />
                </div>
                <div>
                  <label style={S.label}>이메일</label>
                  <input style={S.input} value={form.email} onChange={set("email")} placeholder="me@example.com" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>총 경력</label>
                  <input style={S.input} value={form.career} onChange={set("career")} placeholder="예: 4년" />
                </div>
                <div>
                  <label style={S.label}>현재 상태</label>
                  <select style={S.input} value={form.status} onChange={set("status")}>
                    <option value="">선택</option>
                    <option>재직 중</option>
                    <option>구직 중</option>
                    <option>프리랜서</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>희망 연봉</label>
                  <input style={S.input} value={form.salary} onChange={set("salary")} placeholder="예: 4,500" />
                </div>
              </div>
              <label style={S.label}>이력서·포트폴리오 링크 (노션·드라이브·PDF 링크 등)</label>
              <input style={S.input} value={form.portfolio} onChange={set("portfolio")} placeholder="https://..." />
              <label style={S.label}>하고 싶은 말 (선택 — 직접 만든 소재나 성과 한 가지면 충분합니다)</label>
              <textarea style={{ ...S.input, minHeight: 110, resize: "vertical" }} value={form.intro} onChange={set("intro")} />
              {err && <div style={{ color: "#c0392b", fontSize: 13.5, fontWeight: 600, marginTop: 12 }}>{err}</div>}
              <button onClick={submit} disabled={sending} style={{ width: "100%", marginTop: 18, padding: "14px 0", borderRadius: 10, border: "none", background: sending ? "#9bbfb0" : `linear-gradient(135deg,${GD},${G})`, color: "#fff", fontSize: 16, fontWeight: 800, cursor: sending ? "default" : "pointer", fontFamily: "inherit" }}>
                {sending ? "전송 중..." : "지원서 보내기"}
              </button>
              <p style={{ fontSize: 12, color: SUB, margin: "10px 0 0", textAlign: "center" }}>
                제출 정보는 채용 목적으로만 사용합니다 · 문의 godls@curael.kr
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12.5, color: SUB, marginTop: 28 }}>© CURAEL — 암 환우와 회복기 환자를 위한 식품 브랜드</p>
      </div>
    </div>
  );
}
