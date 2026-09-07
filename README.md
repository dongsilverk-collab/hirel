# HireL — AI 기반 채용 분석 플랫폼

## 주요 기능
- 📋 포지션별 JD 관리 (데이터 사이언티스트, 마케터 등 직군 분리)
- 🤖 AI 이력서 자동 분석 (PDF/Word/이미지 업로드 지원)
- 🎤 면접 실시간 녹음 + AI 평점 (STT 기반)
- 📄 후보자별 PDF 리포트 출력
- 📤 JSON 파일로 팀 공유 / 불러오기

---

## Vercel 배포 방법

### 1단계 — 저장소 설정

```bash
# GitHub에 업로드
git init
git add .
git commit -m "HireL init"
git remote add origin https://github.com/YOUR_NAME/hirel.git
git push -u origin main
```

### 2단계 — Vercel 배포

1. [vercel.com](https://vercel.com) 접속 → **New Project**
2. GitHub 저장소 연결 (`hirel`)
3. **Framework Preset**: Next.js (자동 감지됨)
4. **Environment Variables** 추가:

| 변수명 | 값 |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (Anthropic 대시보드에서 발급) |

5. **Deploy** 클릭 → 완료!

### 3단계 — 팀 공유

배포된 URL (`https://hirel-xxx.vercel.app`)을 팀원에게 공유하면 됩니다.

---

## 로컬 실행

```bash
# 의존성 설치
npm install

# .env.local 파일 생성
cp .env.local.example .env.local
# ANTHROPIC_API_KEY=sk-ant-... 입력

# 개발 서버 실행
npm run dev
# http://localhost:3000
```

---

## 팀 공유 방법

- 헤더의 **📤 팀 공유** 버튼 → JSON 파일 다운로드
- 다른 팀원이 **📥 불러오기** 버튼으로 같은 데이터 열람
- (데이터는 각자의 브라우저 localStorage에 자동 저장됨)

---

## 파일 구조

```
hirel/
├── pages/
│   ├── index.jsx        # 메인 앱
│   ├── _app.js
│   └── api/
│       └── chat.js      # Anthropic API 프록시 (API 키 보호)
├── styles/
│   └── globals.css
├── .env.local.example
├── next.config.js
└── package.json
```
