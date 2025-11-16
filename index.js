/* =============================
      📌 OCR 이벤트 서버 (완성본)
   ============================= */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Vision = require("@google-cloud/vision");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

const app = express();
app.use(cors());
app.use(express.json());

// 정적 파일 (submit.html, dashboard.html)
app.use(express.static("public"));

// 이미지 업로드 폴더
const upload = multer({ dest: "uploads/" });

// 저장 파일
const saveFilePath = path.join(__dirname, "u.nickname");

// Google Vision OCR
const client = new Vision.ImageAnnotatorClient({
  keyFilename: "vision-key.json"
});

// 닉네임 정규식
const nicknameRegex = /^[가-힣A-Za-z0-9]{2,15}$/;

// -------------------------------
// 📌 OCR 결과에서 닉네임만 추출하는 함수
// -------------------------------
function extractNickname(fullText) {
  const lines = fullText
    .split("\n")
    .map(x => x.trim())
    .filter(x => x.length > 1);

  // 1) 완벽한 패턴
  for (const line of lines) {
    if (nicknameRegex.test(line)) return line;
  }

  // 2) 특수문자 없는 가장 짧은 줄
  const filtered = lines.filter(x => /^[가-힣A-Za-z0-9]+$/.test(x));
  if (filtered.length > 0) {
    filtered.sort((a, b) => a.length - b.length);
    return filtered[0];
  }

  return "";
}

// -------------------------------
// 📌 제출 API /upload
// -------------------------------
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const filePath = req.file.path;

    const [result] = await client.textDetection(filePath);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return res.json({ success: false, message: "글자를 인식하지 못했습니다." });
    }

    const fullText = detections[0].description;
    const nickname = extractNickname(fullText);

    if (!nickname) {
      return res.json({ success: false, message: "닉네임을 찾지 못했습니다." });
    }

    const time = moment().format("YYYY-MM-DD HH:mm:ss");

    // 기존 데이터 읽기
    let lines = [];
    if (fs.existsSync(saveFilePath)) {
      lines = fs.readFileSync(saveFilePath, "utf8")
        .trim()
        .split("\n")
        .filter(x => x.trim().length > 0)
        .map(x => {
          const [name, timestamp, savedIp] = x.split(",");
          return { name, time: timestamp, ip: savedIp };
        });
    }

    // 중복 검사
    const isNameDup = lines.some(x => x.name === nickname);
    const isIpDup = lines.some(x => x.ip === ip);

    if (isNameDup || isIpDup) {
      return res.json({
        success: true,
        status: "duplicate",
        nickname,
        message: "⚠ 이미 제출한 닉네임 또는 IP입니다."
      });
    }

    // 신규 저장
    const newLine = `${nickname},${time},${ip}\n`;
    fs.appendFileSync(saveFilePath, newLine);

    return res.json({
      success: true,
      status: "normal",
      nickname,
      message: "제출이 완료되었습니다!"
    });

  } catch (error) {
    console.error("❌ OCR 처리 오류:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------
// 📌 제출 목록 조회  (대시보드)
// -------------------------------
app.get("/list", (req, res) => {
  if (!fs.existsSync(saveFilePath)) {
    return res.json([]);
  }

  const raw = fs.readFileSync(saveFilePath, "utf8").trim();
  if (!raw) return res.json([]);

  const list = raw.split("\n").map(line => {
    const [name, time, ip] = line.split(",");
    return { name, time, ip };
  });

  res.json(list);
});

// -------------------------------
// 📌 삭제 기능 /list/:name
// -------------------------------
app.delete("/list/:name", (req, res) => {
  const target = req.params.name;

  if (!fs.existsSync(saveFilePath)) {
    return res.json({ status: "ok" });
  }

  const filtered = fs.readFileSync(saveFilePath, "utf8")
    .trim()
    .split("\n")
    .filter(line => line.split(",")[0] !== target);

  fs.writeFileSync(saveFilePath, filtered.join("\n") + "\n");

  res.json({ status: "ok" });
});

// -------------------------------
// 📌 CSV 다운로드
// -------------------------------
app.get("/download", (req, res) => {
  if (!fs.existsSync(saveFilePath)) {
    return res.send("No data");
  }
  res.download(saveFilePath, "submitted_list.csv");
});

// -------------------------------
// 📌 서버 실행
// -------------------------------
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 OCR 이벤트 서버 실행됨 → http://localhost:${PORT}`);
});
