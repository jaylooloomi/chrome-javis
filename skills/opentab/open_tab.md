name: open_tab

description: Open a website URL in a new browser tab. Only use this skill when the user explicitly asks to open/visit a specific website.

when_to_use:
  - **REQUIRED**: User must have an explicit ACTION verb: "open", "visit", "go to", "打開", "開啟", "訪問"
  - REQUIRED: User is making a REQUEST or COMMAND to open a website, NOT just mentioning it
  - User specifies a website: Google, YouTube, GitHub, Twitter, LinkedIn, Facebook, Instagram
  - Example CORRECT: "open Google", "visit YouTube", "打開 GitHub", "go to GitHub"
  - Counter-example WRONG: "OK, OK Google" ← This is mimicking a voice assistant, NOT a request to open
  - Counter-example WRONG: "Google is great" ← This is a statement, NOT a request

when_NOT_to_use:
  - **NEVER** call if user is just MENTIONING a website without requesting to open it
  - **NEVER** call if user is mimicking voice assistant triggers like "OK Google", "OK, OK Google"
  - **NEVER** call if user is making a STATEMENT that happens to mention a website
  - User asks general questions like "你在幹嘧" (What are you doing?)
  - Example: DO NOT call open_tab for "你在幹嘧", "很強喔", "Google 很強", "OK, OK Google"
  - Counter-example: "OK, OK Google" - This is NOT a command to open, it's mimicking a trigger phrase

intent_examples:
  CORRECT - call this skill:
    - "open Google"
    - "open YouTube"  
    - "visit GitHub"
    - "打開 Google"
    - "開啟 YouTube"
    - "訪問 GitHub"

  INCORRECT - do NOT call this skill:
    - "你在幹嘧" → Should respond with error, no action
    - "很強喔" → Should respond with error, no action
    - "Google 很強" → Should respond with error, no action
    - "OK, OK Google" → This is mimicking Google Assistant trigger, NOT a request to open. Response with error!

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

CRITICAL RULE: Only call open_tab if user has an EXPLICIT ACTION VERB (open/visit/go to/打開/開啟) + a website name. 
Do NOT call if user is just mentioning or mimicking a voice trigger like "OK, OK Google".
Respond with {"error": "..."} for any ambiguous input.
