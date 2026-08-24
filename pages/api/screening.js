// 서류 스크리닝 결정 저장 API — rooms/_screening 노드 (룸 push에 안 덮임, apply.js와 동일 패턴)
export default async function handler(req, res) {
  const DB_URL = process.env.FIREBASE_DB_URL;
  if (!DB_URL) return res.status(500).json({ error: "FIREBASE_DB_URL 없음" });
  try {
    if (req.method === "GET") {
      const r = await fetch(`${DB_URL}/rooms/_screening.json`);
      const data = await r.json();
      res.status(200).json(data || {});
    } else if (req.method === "PUT") {
      const { id, decision } = req.body || {};
      if (!id) return res.status(400).json({ error: "id 필요" });
      const r = await fetch(`${DB_URL}/rooms/_screening/${encodeURIComponent(id)}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: decision || null, ts: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`firebase ${r.status}`);
      res.status(200).json({ ok: true });
    } else {
      res.status(405).end();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
