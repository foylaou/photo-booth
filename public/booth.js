let currentStream = null;
let facingMode = "user"; // "user" (front) or "environment" (rear)
let frames = [];
let selectedFrameUrl = "";
let lastDownloadUrl = "";

const elVideo = document.getElementById("video");
const elOverlay = document.getElementById("frameOverlay");
const elFrames = document.getElementById("frames");
const elHint = document.getElementById("hint");
const elBtnCapture = document.getElementById("btnCapture");
const elBtnRetake = document.getElementById("btnRetake");
const elBtnDownload = document.getElementById("btnDownload");

const elResult = document.getElementById("result");
const elPreview = document.getElementById("preview");
const elQR = document.getElementById("qr");
const elLinkLine = document.getElementById("linkLine");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function setHint(text){
  elHint.textContent = text;
}

async function stopStream(){
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

async function startCamera(){
  await stopStream();
  setHint("正在開啟相機…");

  // For best compatibility, request only video. Audio off.
  const constraints = {
    audio: false,
    video: { facingMode }
  };

  try{
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    elVideo.srcObject = currentStream;

    await elVideo.play();
    setHint("選擇邊框後按「拍照」");
  }catch(err){
    console.error(err);
    setHint("無法使用相機：請確認已允許權限，且使用 HTTPS / 本機 localhost");
  }
}

function renderFrames(){
  elFrames.innerHTML = "";
  if (!frames.length){
    elFrames.innerHTML = `<div class="small">尚未上傳邊框。請到 /admin.html 上傳。</div>`;
    return;
  }

  frames.forEach((f, idx) => {
    const item = document.createElement("div");
    item.className = "frameItem" + (idx === 0 ? " selected" : "");
    item.innerHTML = `
      <img class="frameThumb" src="${f.url}" alt="${f.name}">
      <div class="frameLabel">${f.name}</div>
    `;
    item.addEventListener("click", async () => {
      [...document.querySelectorAll(".frameItem")].forEach(x => x.classList.remove("selected"));
      item.classList.add("selected");
      selectFrame(f.url);
    });
    elFrames.appendChild(item);
  });

  // default select first
  selectFrame(frames[0].url);
}

async function selectFrame(url){
  selectedFrameUrl = url;
  elOverlay.src = url;
}

async function loadFrames(){
  const res = await fetch("/api/frames");
  const data = await res.json();
  frames = data.frames || [];
  renderFrames();
}

function drawCover(video, targetW, targetH){
  // Mirror selfie for "user" camera so saved photo matches preview.
  // If you want non-mirrored output, remove ctx.scale(-1,1) section below.
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const scale = Math.max(targetW / vw, targetH / vh);
  const sw = targetW / scale;
  const sh = targetH / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  ctx.save();
  if (facingMode === "user") {
    // mirror
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
  ctx.restore();
}

async function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function capture(){
  if (!selectedFrameUrl) return;

  elBtnCapture.disabled = true;
  setHint("合成中…");

  // Output size (match stage aspect ratio 3:4). You can change to 1080x1440.
  const outW = 1080;
  const outH = 1440;
  canvas.width = outW;
  canvas.height = outH;

  ctx.clearRect(0,0,outW,outH);
  drawCover(elVideo, outW, outH);

  // Draw frame overlay
  const frameImg = await loadImage(selectedFrameUrl);
  ctx.drawImage(frameImg, 0, 0, outW, outH);

  // Convert canvas to Blob
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.92));

  // Upload to server
  const fd = new FormData();
  fd.append("photo", blob, "photo.png");

  try{
    const res = await fetch("/api/photo", { method:"POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");

    lastDownloadUrl = data.photoUrl;

    // UI: show preview and QR
    elPreview.src = data.photoUrl;
    elQR.src = data.qrDataUrl;
    elLinkLine.textContent = `下載連結：${data.targetUrl}`;

    elResult.hidden = false;

    // Enable download button
    elBtnDownload.href = data.photoUrl;
    elBtnDownload.style.pointerEvents = "auto";
    elBtnDownload.style.opacity = "1";

    elBtnRetake.disabled = false;
    setHint("完成！可掃描 QR 或直接下載");
  }catch(e){
    console.error(e);
    setHint("上傳失敗：請確認伺服器可連線且有 HTTPS");
  }finally{
    elBtnCapture.disabled = false;
  }
}

document.getElementById("btnSwitch").addEventListener("click", async () => {
  facingMode = (facingMode === "user") ? "environment" : "user";
  await startCamera();
});

elBtnCapture.addEventListener("click", capture);

elBtnRetake.addEventListener("click", () => {
  elResult.hidden = true;
  elPreview.src = "";
  elQR.src = "";
  elLinkLine.textContent = "";
  elBtnDownload.href = "#";
  elBtnDownload.style.pointerEvents = "none";
  elBtnDownload.style.opacity = ".6";
  elBtnRetake.disabled = true;
  setHint("選擇邊框後按「拍照」");
});

// init
(async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setHint("此瀏覽器不支援相機 API（建議使用 Chrome / Safari 新版）");
    return;
  }
  await loadFrames();
  await startCamera();
})();
