name: chrome_mode
runInPageContext: true

description: Control webpage theme mode (dark/light). Detects and applies dark or light color scheme to the current website. Only use this skill when the user explicitly asks to change the theme or enable dark/light mode.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "dark", "light", "darkmode", "dark mode", "lightmode", "light mode", "dark theme", "light theme", "enable dark", "enable light"
     Chinese: "深色", "淺色", "深色模式", "淺色模式", "夜間", "白天", "黑暗", "明亮", "深色主題", "淺色主題"
  
  2. **CLEAR INTENT** (必須有清晰的意圖):
     User must explicitly ask to change to dark or light mode

  ** DECISION RULE: Check for BOTH verb + theme intent **
  - If sentence has theme verb (dark/light/darkmode/lightmode) → CALL chrome_mode
  - If sentence is just mentioning theme casually → REJECT
  - If sentence doesn't indicate switching theme → REJECT

examples_CORRECT_theme:
  - "dark mode" ✓ (verb: dark, intent: dark mode)
  - "darkmode" ✓ (verb: darkmode, intent: dark mode)
  - "enable light mode" ✓ (verb: enable light, intent: light mode)
  - "light theme" ✓ (verb: light, intent: light mode)
  - "深色模式" ✓ (verb: 深色模式, intent: dark mode)
  - "淺色模式" ✓ (verb: 淺色模式, intent: light mode)
  - "夜間模式" ✓ (verb: 夜間, intent: dark mode)
  - "切換深色" ✓ (verb: 切換深色, intent: dark mode)

examples_INCORRECT_casual_mention:
  - "what is dark mode?" ✗ (no verb, just mentioning)
  - "I like light themes" ✗ (statement, not explicit request)
  - "theme" ✗ (just word, no clear verb or direction)

when_NOT_to_use:
  - No clear theme verb: User only mentions theme without asking to change it
  - Casual conversation: User is asking about theme but not requesting to switch
  - Unclear intent: User doesn't specify "dark", "light", or explicit action

intent_examples:
  CORRECT - call this skill (HAS theme verb):
    - "dark mode" → Call chrome_mode with mode: "dark"
    - "darkmode" → Call chrome_mode with mode: "dark"
    - "enable light mode" → Call chrome_mode with mode: "light"
    - "light theme" → Call chrome_mode with mode: "light"
    - "深色模式" → Call chrome_mode with mode: "dark"
    - "淺色模式" → Call chrome_mode with mode: "light"
    - "夜間模式" → Call chrome_mode with mode: "dark"
    - "切換深色" → Call chrome_mode with mode: "dark"

  INCORRECT - do NOT call this skill (MISSING verb OR intent):
    - "what is dark mode?" → REJECT (no verb)
    - "I like light themes" → REJECT (statement, not request)
    - "theme" → REJECT (no clear intent)

input: User must explicitly request to switch to dark or light mode

output:
Only respond with THIS EXACT JSON format when user explicitly asks to change theme:
{"skill": "chrome_mode", "args": {"mode": "dark"|"light", "prompt": "user input"}}

If user is NOT asking to change theme, respond with:
{"error": "This request is not asking to change the theme mode"}

IMPORTANT - args structure:
- "mode" must be either "dark" or "light" (case-sensitive)
- "prompt" is the entire user input (included for consistency)
- Map user input to mode:
  * "dark", "darkmode", "dark mode", "深色", "深色模式", "夜間", "黑暗", "enable dark" → "dark"
  * "light", "lightmode", "light mode", "淺色", "淺色模式", "白天", "明亮", "enable light" → "light"

Examples of correct output:
- User says "dark mode" → {"skill": "chrome_mode", "args": {"mode": "dark", "prompt": "dark mode"}}
- User says "enable light mode" → {"skill": "chrome_mode", "args": {"mode": "light", "prompt": "enable light mode"}}
- User says "深色模式" → {"skill": "chrome_mode", "args": {"mode": "dark", "prompt": "深色模式"}}
- User says "淺色模式" → {"skill": "chrome_mode", "args": {"mode": "light", "prompt": "淺色模式"}}
- User says "darkmode" → {"skill": "chrome_mode", "args": {"mode": "dark", "prompt": "darkmode"}}

CRITICAL RULE - THEME CONTROL INTENT REQUIREMENT:
✓ MUST HAVE: Clear theme control verb (dark/light/darkmode/lightmode)
✗ DO NOT CALL if just mentioning theme
✗ DO NOT CALL if it's a casual statement
✗ DO NOT CALL if intent is unclear

Only proceed to call chrome_mode if you can identify a CLEAR theme change request with mode.
