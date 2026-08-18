// pages/api/chat.js
// API 키를 서버에서 안전하게 사용 + 모델 자동 폴백 (403/404 시 하위 모델로 재시도)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb', // PDF/이미지 업로드 허용
    },
  },
};

const MODEL_FALLBACKS = [
  "claude-sonnet-5",
  "claude-sonnet-4-5",
  "claude-sonnet-4-20250514",
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  }

  // 요청 모델을 폴백 체인 맨 앞에 (중복 제거)
  const requested = req.body?.model;
  const chain = [requested, ...MODEL_FALLBACKS].filter((m, i, a) => m && a.indexOf(m) === i);

  try {
    let lastStatus = 500, lastData = { error: "unknown" };
    for (const model of chain) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ ...req.body, model }),
      });
      const data = await response.json().catch(() => ({}));
      // 모델 접근 불가(403 permission / 404 not_found)면 다음 모델로 재시도
      if ((response.status === 403 || response.status === 404) && chain.indexOf(model) < chain.length - 1) {
        console.warn(`model ${model} → HTTP ${response.status}, 다음 모델로 폴백`);
        lastStatus = response.status; lastData = data;
        continue;
      }
      return res.status(response.status).json(data);
    }
    res.status(lastStatus).json(lastData);
  } catch (e) {
    console.error("Anthropic API 오류:", e);
    res.status(500).json({ error: e.message });
  }
}
