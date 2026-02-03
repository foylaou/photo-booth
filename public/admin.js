const elToken = document.getElementById("token");
const elFiles = document.getElementById("files");
const elBtnUpload = document.getElementById("btnUpload");
const elMsg = document.getElementById("msg");
const elList = document.getElementById("list");

function setMsg(t){ elMsg.textContent = t; }

async function loadFrames(){
  const res = await fetch("/api/frames");
  const data = await res.json();
  const frames = data.frames || [];
  elList.innerHTML = "";

  frames.forEach(f => {
    const item = document.createElement("div");
    item.className = "frameItem";
    item.innerHTML = `
      <img class="frameThumb" src="${f.url}" alt="${f.name}">
      <div class="frameLabel">${f.name}</div>
    `;
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      removeFrame(f.name);
    });

    // Add delete button
    const btn = document.createElement("button");
    btn.textContent = "刪除";
    btn.className = "btn";
    btn.style.position = "absolute";
    btn.style.top = "8px";
    btn.style.right = "8px";
    btn.style.minWidth = "64px";
    btn.style.padding = "6px 10px";
    btn.style.borderColor = "rgba(255,90,122,.65)";
    btn.style.background = "rgba(255,90,122,.12)";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFrame(f.name);
    });
    item.style.position = "relative";
    item.appendChild(btn);

    elList.appendChild(item);
  });

  if (!frames.length){
    elList.innerHTML = `<div class="small">目前沒有邊框。</div>`;
  }
}

async function upload(){
  const files = elFiles.files;
  if (!files || !files.length){
    setMsg("請選擇 1–10 個圖片檔。");
    return;
  }

  const fd = new FormData();
  for (const f of files) fd.append("frames", f);

  setMsg("上傳中…");

  try{
    const res = await fetch("/api/frames", {
      method: "POST",
      headers: elToken.value ? { "x-admin-token": elToken.value } : {},
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");
    setMsg(`已上傳：${(data.uploaded||[]).length} 張`);
    elFiles.value = "";
    await loadFrames();
  }catch(e){
    console.error(e);
    setMsg(`上傳失敗：${e.message}`);
  }
}

async function removeFrame(name){
  if (!confirm(`確定刪除：${name} ?`)) return;

  try{
    const res = await fetch(`/api/frames/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: elToken.value ? { "x-admin-token": elToken.value } : {}
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "delete failed");
    setMsg("已刪除");
    await loadFrames();
  }catch(e){
    console.error(e);
    setMsg(`刪除失敗：${e.message}`);
  }
}

elBtnUpload.addEventListener("click", upload);

loadFrames();
