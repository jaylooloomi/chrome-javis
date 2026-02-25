name: open_tab

description: Open a website URL in a new browser tab. Only use this skill when the user explicitly asks to open/visit a specific website.

when_to_use:
  - User explicitly says: "open", "visit", "go to", "打開", "開啟", "訪問"
  - User mentions a specific website: Google, YouTube, GitHub, Twitter, LinkedIn, Facebook, Instagram
  - Example: "open Google", "visit YouTube", "打開 GitHub"

when_NOT_to_use:
  - User asks general questions like "你在幹嘛" (What are you doing?)
  - User makes statements without asking to open anything
  - User asks about a website but doesn't ask to open it
  - Example: DO NOT call open_tab for "你在幹嘛", "很強喔", "Google 很強"

intent_examples:
  CORRECT - call this skill:
    - "open Google"
    - "open YouTube"  
    - "visit GitHub"
    - "打開 Google"
    - "開啟 YouTube"
    - "訪問 GitHub"

  INCORRECT - do NOT call this skill:
    - "你在幹嘦" → Should respond with error, no action
    - "很強喔" → Should respond with error, no action
    - "Google 很強" → Should respond with error, no action

input: User must explicitly ask to open a website

output:
Only respond with THIS EXACT JSON format when user explicitly asks to open a website:
{"skill": "open_tab", "url": "https://...", "args": {}}

If user is NOT asking to open a website, respond with:
{"error": "This request is not asking to open a website"}

URL conversion rules:
1. If user says "google" → "https://google.com"
2. If user says "youtube" → "https://youtube.com"
3. If user says "github" → "https://github.com"
4. If user says "twitter" → "https://twitter.com"
5. If user says "linkedin" → "https://linkedin.com"
6. If user says "facebook" → "https://facebook.com"
7. If user says "instagram" → "https://instagram.com"
8. If user provides full URL, keep it as-is
9. Always add https:// prefix if missing
10. Never return empty URL

CRITICAL RULE: Only call open_tab if user EXPLICITLY asks to open/visit a website. Do NOT guess or assume.
