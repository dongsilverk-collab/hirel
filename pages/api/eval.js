export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

// 면접관 공동 평가 저장/조회
// /rooms 와 분리된 /evals 트리에 면접관별 슬롯으로 기록 → 방장이 /rooms 를 통째로 PUT 해도 평가가 지워지지 않음
export default async function handler(req, res) {
  const DB_URL = process.env.FIREBASE_DB_URL;
  if (!DB_URL) return res.status(500).json({ error: "FIREBASE_DB_URL 없음" });

  const { roomId, candidateId, evaluatorId } = req.query;
  if (!roomId) return res.status(400).json({ error: "roomId 필요" });

  try {
    if (req.method === "GET") {
      // candidateId 지정 → 해당 후보 평가, 미지정 → 방 전체 평가
      const path = candidateId ? `evals/${roomId}/${candidateId}` : `evals/${roomId}`;
      const r = await fetch(`${DB_URL}/${path}.json`);
      const data = await r.json();
      return res.status(200).json(data || {});
    }
    if (req.method === "POST") {
      if (!candidateId || !evaluatorId)
        return res.status(400).json({ error: "candidateId, evaluatorId 필요" });
      // 면접관 자기 슬롯에만 PUT → 서로 덮어쓰지 않음
      const r = await fetch(`${DB_URL}/evals/${roomId}/${candidateId}/${evaluatorId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      await r.json();
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    console.error("eval sync error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
