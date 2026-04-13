// pages/api/sync.js
// Firebase Realtime Database REST API 프록시
// 환경변수: FIREBASE_DB_URL (예: https://hirel-xxxxx-default-rtdb.firebaseio.com)

export default async function handler(req, res) {
  const DB_URL = process.env.FIREBASE_DB_URL;
  if (!DB_URL) return res.status(500).json({ error: "FIREBASE_DB_URL 환경변수가 없습니다." });

  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ error: "roomId 필요" });

  const endpoint = `${DB_URL}/rooms/${roomId}.json`;

  try {
    if (req.method === "GET") {
      const r = await fetch(endpoint);
      const data = await r.json();
      res.status(200).json(data || {});
    } else if (req.method === "POST") {
      const r = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      res.status(200).json(data);
    } else {
      res.status(405).end();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
