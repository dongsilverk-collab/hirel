// pages/api/chat.js
// API 키를 서버에서 안전하게 사용

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb', // PDF/이미지 업로드 허용
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    console.error("Anthropic API 오류:", e);
    res.status(500).json({ error: e.message });
  }
}
