name: close_all_pages

description: 關閉所有頁面 - 關閉所有瀏覽器標籤頁（除了新開的 Google 標籤頁）。僅在用戶明確要求關閉所有/全部頁面時使用。Close all browser tabs except a new Google tab. Only use this skill when the user explicitly asks to close all/every page.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "close", "close all", "close all page", "close everything"
     Chinese: "關閉", "關掉", "全部關", "都關"
  
  2. **SCOPE/OBJECT** (必須有全部/所有的概念):
     Can be: "all pages", "all page", "all tabs", "everything", "all windows content"
     Chinese: "所有頁面", "全部分頁", "全部標籤", "所有標籤頁", "全部", "所有"
  
  ** DECISION RULE: Check for BOTH verb + all/every reference **
  - If sentence has ACTION VERB + all/every mention → CALL close_all_pages
  - If sentence has ONLY verb (no scope) → REJECT with error
  - If sentence mentions closing single page → REJECT, use close_this_page instead
  - If sentence is just mentioning closing (no verb) → REJECT with error

examples_CORRECT_verb_plus_all:
  - "close all pages" ✓ (verb: close, scope: all pages)
  - "close all tabs" ✓ (verb: close, scope: all tabs)
  - "close everything" ✓ (verb: close, scope: everything)
  - "關閉所有頁面" ✓ (verb: 關閉, scope: 所有頁面)
  - "關掉全部分頁" ✓ (verb: 關掉, scope: 全部分頁)
  - "全部關掉" ✓ (verb: 關掉, scope: 全部)

examples_INCORRECT_missing_scope:
  - "close this page" ✗ (use close_this_page instead)
  - "close" ✗ (verb alone without scope)
  - "關掉" ✗ (verb alone without scope)

examples_INCORRECT_single_page:
  - "close this page" ✗ (single page, use close_this_page)
  - "close current tab" ✗ (single tab, use close_this_page)
  - "關閉這個分頁" ✗ (single page, use close_this_page)

examples_INCORRECT_general_talk:
  - "再見" ✗ (no verb + scope pattern)
  - "掰掰" ✗ (no verb + scope pattern)
  - "什麼叫關閉" ✗ (question but no close request)

when_NOT_to_use:
  - Missing ACTION VERB: User only mentions pages without asking to close ("pages", "tabs")
  - Missing ALL/EVERY SCOPE: User says verb but doesn't specify all/multiple ("close", "關掉一下")
  - Single page close: User wants to close only current page (use close_this_page)
  - Statement without request: User makes a statement about closing ("關閉很重要")
  - General conversation: Unrelated questions or statements ("再見", "掰掰")
  
  ** REJECT IF: Sentence is missing either the verb OR the all/every scope **
  ** REJECT IF: User is asking to close a single page (use close_this_page instead) **

intent_examples:
  CORRECT - call this skill (HAS verb + all scope):
    - "close all pages" → Call close_all_pages
    - "close all tabs" → Call close_all_pages
    - "close everything" → Call close_all_pages
    - "關閉所有頁面" → Call close_all_pages
    - "關掉全部分頁" → Call close_all_pages
    - "全部關掉" → Call close_all_pages

  INCORRECT - do NOT call this skill (MISSING scope OR single page):
    - "pages" → REJECT (missing verb)
    - "close" → REJECT (missing scope)
    - "關掉" → REJECT (if no clear scope)
    - "close this page" → REJECT (use close_this_page instead)
    - "close current tab" → REJECT (use close_this_page instead)
    - "再見" → REJECT (no verb + scope pattern)

input: User must explicitly ask to close all pages/tabs

output:
Only respond with THIS EXACT JSON format when user explicitly asks to close all pages:
{"skill": "close_all_pages", "args": {"prompt": ""}}

If user is NOT asking to close all pages, respond with:
{"error": "This request is not asking to close all pages"}

IMPORTANT - Placeholder handling:
- No placeholders needed for this skill, it closes all tabs globally
- "prompt" is the user's custom instruction (can be empty string "" as this skill doesn't use it)
- Service Worker will pass the args to the skill

Example flow:
1. User says "關閉所有頁面"
2. AI returns: {"skill": "close_all_pages", "args": {"prompt": ""}}
3. Skill receives the args and closes all tabs except new Google tab

