name: open_tab

description: Open a website URL in a new browser tab. Only use this skill when the user explicitly asks to open/visit a specific website.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "open", "visit", "go to", "check", "browse", "access", "show"
     Chinese: "打開", "開啟", "訪問", "查看", "前往", "進入"
  
  2. **WEBSITE NAME** (必須有網站名稱):
     Supported: Google, YouTube, GitHub, Twitter, LinkedIn, Facebook, Instagram
  
  ** DECISION RULE: Check for BOTH verb + website name **
  - If sentence has ACTION VERB + website name → CALL open_tab
  - If sentence has ONLY website name (no verb) → REJECT with error
  - If sentence has ONLY verb (no website) → REJECT with error
  - If sentence is just mentioning/statement → REJECT with error

examples_CORRECT_verb_plus_website:
  - "open Google" ✓ (verb: open, site: Google)
  - "visit YouTube" ✓ (verb: visit, site: YouTube)
  - "打開 GitHub" ✓ (verb: 打開, site: GitHub)
  - "go to Twitter" ✓ (verb: go to, site: Twitter)
  - "check LinkedIn" ✓ (verb: check, site: LinkedIn)

examples_INCORRECT_missing_verb:
  - "Google" ✗ (no verb, just website name)
  - "OK, OK Google" ✗ (no verb, just mimicking voice trigger)
  - "Google 很強" ✗ (no verb, just statement)
  - "YouTube 好玩" ✗ (no verb, just statement)

examples_INCORRECT_missing_website:
  - "打開一下" ✗ (verb exists but no website specified)
  - "open" ✗ (verb alone without target)

examples_INCORRECT_general_talk:
  - "你在幹嘧" ✗ (no verb + website pattern)
  - "很強喔" ✗ (no verb + website pattern)

when_NOT_to_use:
  - Missing ACTION VERB: User only mentions website without asking to open ("Google", "OK, OK Google")
  - Missing WEBSITE NAME: User says verb but doesn't specify which site to open ("打開一下", "open something")
  - Statement without request: User makes a statement about a website ("Google 很強", "YouTube 好玩")
  - General conversation: Unrelated questions or statements ("你在幹嘧", "很強喔")
  
  ** REJECT IF: Sentence is missing either the verb OR the website name **

intent_examples:
  CORRECT - call this skill (HAS verb + website):
    - "open Google" → Call with Google
    - "visit YouTube" → Call with YouTube
    - "打開 GitHub" → Call with GitHub
    - "go to Twitter" → Call with Twitter

  INCORRECT - do NOT call this skill (MISSING verb OR website):
    - "Google" → REJECT (missing verb)
    - "OK, OK Google" → REJECT (missing verb, just mimicking)
    - "Google 很強" → REJECT (missing verb, statement only)
    - "YouTube 好玩" → REJECT (missing verb, statement only)
    - "打開一下" → REJECT (missing website name)
    - "open" → REJECT (missing website name)
    - "你在幹嘧" → REJECT (no verb + website pattern)
    - "很強喔" → REJECT (no verb + website pattern)

input: User must explicitly ask to open a website

output:
Only respond with THIS EXACT JSON format when user explicitly asks to open a website:
{"skill": "open_tab", "args": {"url": "https://..."}}

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

CRITICAL RULE - VERB + WEBSITE REQUIREMENT:
✓ MUST HAVE: Action Verb + Website Name
✗ DO NOT CALL if either is missing
✗ DO NOT CALL if only mentioned in passing
✗ DO NOT CALL if it's a statement or question without the verb+website pattern

Examples that FAIL the rule:
  - "OK, OK Google" - No verb (just website name)
  - "Google 很強" - No verb (just statement)
  - "打開" - No website name (just verb)
  - "你在幹嘧" - Neither verb nor website

Only proceed to call open_tab if you can identify BOTH an action verb AND a website name in the user's input.
