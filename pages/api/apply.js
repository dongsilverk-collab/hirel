// 커리어 페이지 지원서 수신 API
// Firebase 규칙이 rooms/ 하위만 허용 → rooms/_apps 노드 사용.
// 방장 push는 rooms/{roomId} 노드만 통째로 교체하므로 rooms/_apps는 덮이지 않는다
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  const DB_URL = process.env.FIREBASE_DB_URL;
  if (!DB_URL) return res.status(500).json({ error: "FIREBASE_DB_URL 없음" });

  try {
    if (req.method === "POST") {
      const { name, phone, email, career, status, salary, portfolio, intro } = req.body || {};
      if (!name || !String(name).trim()) return res.status(400).json({ error: "이름 필요" });
      if (!phone && !email) return res.status(400).json({ error: "연락처 또는 이메일 필요" });
      const clip = (v, n) => String(v || "").slice(0, n);
      const id = `a${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const rec = {
        id,
        name: clip(name, 40),
        phone: clip(phone, 40),
        email: clip(email, 80),
        career: clip(career, 40),
        workStatus: clip(status, 20),
        salary: clip(salary, 40),
        portfolio: clip(portfolio, 300),
        intro: clip(intro, 2000),
        ts: new Date().toISOString(),
        state: "new",
      };
      const r = await fetch(`${DB_URL}/rooms/_apps/${id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      });
      if (!r.ok) throw new Error(`firebase ${r.status}`);
      res.status(200).json({ ok: true });
    } else if (req.method === "GET") {
      const r = await fetch(`${DB_URL}/rooms/_apps.json`);
      const data = await r.json();
      res.status(200).json(data || {});
    } else if (req.method === "PUT") {
      const { id, state } = req.body || {};
      if (!id || !state) return res.status(400).json({ error: "id/state 필요" });
      const r = await fetch(`${DB_URL}/rooms/_apps/${encodeURIComponent(id)}/state.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!r.ok) throw new Error(`firebase ${r.status}`);
      res.status(200).json({ ok: true });
    } else {
      res.status(405).end();
    }
  } catch (e) {
    console.error("apply api error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
