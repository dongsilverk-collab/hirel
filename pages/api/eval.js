export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

// 면접관 공동 평가 저장/조회
// 기존 sync.js 가 쓰는 /rooms 노드 안쪽(rooms/{roomId}__evals)에 기록 → 같은 보안규칙으로 허용되고,
// sync.js 의 PUT /rooms/{roomId} (정확 키)와 충돌하지 않음(형제 키라 덮어쓰지 않음).
const VALID = ["합격", "보류", "불합격"];

export default async function handler(req, res) {
  const DB_URL = process.env.FIREBASE_DB_URL;
  if (!DB_URL) return res.status(500).json({ error: "FIREBASE_DB_URL 없음" });

  const { roomId, candidateId, evaluatorId } = req.query;
  if (!roomId) return res.status(400).json({ error: "roomId 필요" });

  try {
    if (req.method === "GET") {
      const path = candidateId
        ? `rooms/${roomId}__evals/${candidateId}`
        : `rooms/${roomId}__evals`;
      const r = await fetch(`${DB_URL}/${path}.json`);
      if (!r.ok) return res.status(200).json({}); // 권한오류 등 → 빈 보드(가짜 표 방지)
      const data = await r.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(200).json({});
      // 후보 지정 조회면 유효한 표만 통과시켜 가짜 항목 제거
      if (candidateId) {
        const clean = {};
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === "object" && VALID.includes(v.decision)) clean[k] = v;
        }
        return res.status(200).json(clean);
      }
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      if (!candidateId || !evaluatorId)
        return res.status(400).json({ error: "candidateId, evaluatorId 필요" });
      const r = await fetch(`${DB_URL}/rooms/${roomId}__evals/${candidateId}/${evaluatorId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return res.status(500).json({ error: `Firebase 쓰기 실패 (${r.status}): ${String(t).slice(0, 140)}` });
      }
      await r.json().catch(() => {});
      return res.status(200).json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    console.error("eval sync error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
