# Photo Booth (Frames + Camera + QR Download)

這是一個簡單的「線上拍貼」原型：  
- 你可以先到 `/admin.html` 上傳 3–5 張邊框（建議透明 PNG）。  
- 使用者到首頁 `/` 選邊框、開相機、拍照後會自動合成，並顯示 QR Code 讓手機掃描下載。

## 需求
- Node.js 18+（建議 20+）

## 安裝與執行
```bash
cd photo-booth
npm install
npm start
```

開啟：
- 拍貼頁： http://localhost:3000/
- 管理頁： http://localhost:3000/admin.html

> 注意：相機 API 在多數瀏覽器需要 HTTPS 或 localhost。

## （建議）加上管理密碼
設定環境變數 `ADMIN_TOKEN`：
```bash
# Windows PowerShell
$env:ADMIN_TOKEN="your-secret"
npm start

# macOS / Linux
ADMIN_TOKEN="your-secret" npm start
```
然後到 `/admin.html` 輸入相同 token 才能上傳/刪除。

## （建議）部署到公開網域以便 QR 掃描
因為 QR 需要能被手機存取的網址，部署後建議設定：
- `BASE_URL`：你的站點根網址，例如 `https://example.com`

```bash
BASE_URL="https://example.com" npm start
```

## 邊框設計建議
- 建議尺寸：1080x1440（3:4），透明 PNG
- 內容可留安全區，避免被裁切
