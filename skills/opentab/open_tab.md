name: open_tab

description: Open a URL in a new browser tab.

intent_examples:
  - "open Google"
  - "open YouTube"
  - "visit GitHub"
  - "打開 Google"
  - "開啟 YouTube"

input: A website name or URL

output:
Always respond with THIS EXACT JSON format - no other text:
{"skill": "open_tab", "url": "https://...", "args": {}}

URL conversion rules:
1. If user says "google" → "https://google.com"
2. If user says "youtube" → "https://youtube.com"
3. If user says "github" → "https://github.com"
4. If user says "twitter" → "https://twitter.com"
5. If user says "linkedin" → "https://linkedin.com"
6. If user provides full URL, keep it as-is
7. Always add https:// prefix if missing
8. Never return empty URL

IMPORTANT: Extract the website from user input and return it in the URL field.
