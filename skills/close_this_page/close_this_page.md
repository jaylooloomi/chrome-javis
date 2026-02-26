name: close_this_page

description: 關閉當前頁面 - 關閉用戶當前所在的瀏覽器標籤頁。僅在用戶明確要求關閉/退出當前頁面時使用。Close the current browser tab when user explicitly asks to close/exit the current page.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "close", "shut", "quit", "close tab", "close page"
     Chinese: "關閉", "關掉", "離開", "結束"
  
  2. **CONTEXT/OBJECT** (必須有對象):
     Can be: "this page", "current page", "this tab", "this window", "the page"
     Chinese: "頁面", "當前頁面", "標籤頁", "分頁", "這個"
     Or implicit: User intends to close the current page
  
  ** DECISION RULE: Check for BOTH verb + page/tab reference **
  - If sentence has ACTION VERB + page/tab mention → CALL close_this_page
  - If sentence has ONLY verb (no page reference) → REJECT with error
  - If sentence is just mentioning closing (no verb) → REJECT with error
  - If sentence is general talk → REJECT with error

examples_CORRECT_verb_plus_page:
  - "close this page" ✓ (verb: close, object: this page)
  - "close current tab" ✓ (verb: close, object: current tab)
  - "shut this window" ✓ (verb: shut, object: window)
  - "關閉頁面" ✓ (verb: 關閉, object: 頁面)
  - "關掉這個分頁" ✓ (verb: 關掉, object: 分頁)
  - "關掉" ✓ (verb: 關掉, implicit: current page)

examples_INCORRECT_missing_verb:
  - "page" ✗ (no verb, just website name)
  - "close" ✗ (verb alone without target)
  - "tab" ✗ (no verb, just object)

examples_INCORRECT_missing_page_reference:
  - "關掉一下" ✗ (verb exists but no page specified)
  - "quit" ✗ (verb alone without target)

examples_INCORRECT_general_talk:
  - "再見" ✗ (no verb + page pattern)
  - "掰掰" ✗ (no verb + page pattern)
  - "什麼叫關閉" ✗ (question but no close request)

when_NOT_to_use:
  - Missing ACTION VERB: User only mentions page without asking to close ("page", "tab")
  - Missing PAGE REFERENCE: User says verb but doesn't specify what to close ("close", "關掉一下")
  - Statement without request: User makes a statement about closing ("關閉很重要")
  - General conversation: Unrelated questions or statements ("再見", "掰掰")
  
  ** REJECT IF: Sentence is missing either the verb OR the page/tab reference **

intent_examples:
  CORRECT - call this skill (HAS verb + page):
    - "close this page" → Call close_this_page with current page
    - "close current tab" → Call close_this_page with current tab
    - "關閉頁面" → Call close_this_page with current page
    - "關掉分頁" → Call close_this_page
    - "quit" → Call close_this_page (implicit current page)

  INCORRECT - do NOT call this skill (MISSING verb OR page):
    - "page" → REJECT (missing verb)
    - "close" → REJECT (missing what to close)
    - "關掉" → REJECT (if no clear context)
    - "再見" → REJECT (no verb + page pattern)

input: User must explicitly ask to close the current page/tab

output:
Only respond with THIS EXACT JSON format when user explicitly asks to close the current page/tab:
{"skill": "close_this_page", "args": {"tabId": "ACTIVE_TAB", "url": "ACTIVE_TAB_URL", "prompt": ""}}

If user is NOT asking to close the page, respond with:
{"error": "This request is not asking to close the current page"}

IMPORTANT - Placeholder handling:
- "ACTIVE_TAB" is a PLACEHOLDER that Service Worker will replace with the actual tabId
- "ACTIVE_TAB_URL" is a PLACEHOLDER that Service Worker will replace with the actual page URL
- "prompt" is the user's custom instruction (can be empty string "" as this skill doesn't use it)
- DO NOT try to get the actual tabId/URL yourself
- DO NOT hardcode any values
- Always use these exact placeholders in your response
- Service Worker will handle the replacement before passing to the skill

Example flow:
1. User says "關閉這個頁面" on https://example.com (tabId=123)
2. AI returns: {"skill": "close_this_page", "args": {"tabId": "ACTIVE_TAB", "url": "ACTIVE_TAB_URL", "prompt": ""}}
3. Service Worker replaces: {"args": {"tabId": 123, "url": "https://example.com"}}
4. Skill receives the actual values and closes the tab
