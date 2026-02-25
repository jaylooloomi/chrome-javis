name: open_tab

description: |
  Open a URL in a new browser tab.
  在浏覽器新分頁打開 URL。

intent_examples:
  English:
    - "open Google"
    - "open https://github.com"
    - "visit YouTube"
  Chinese (Traditional):
    - "打開 Google"
    - "開啟 YouTube"
    - "幫我打開 GitHub"

input:
  required:
    - url: (string) 完整 URL 或網站名稱 | Full URL or website name
      example: "https://google.com" or "google" or "youtube.com"

output:
  json_format: |
    {
      "skill": "open_tab",
      "url": "https://example.com"
    }

rules:
  - Always convert website names to full URLs with https://
  - 務必轉換網站名稱為完整 URL (https://)
  - If user says "google", convert to "https://google.com"
  - If user says "GitHub", convert to "https://github.com"
  - Common websites: google.com, youtube.com, github.com, twitter.com, linkedin.com
