name: ask_gemini

description: Send current page content to Google Gemini for analysis. Only use this skill when the user explicitly asks to analyze/summarize/send the current page to Gemini.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "ask", "send", "analyze", "summarize", "check", "review", "explain", "evaluate"
     Chinese: "詢問", "發送", "分析", "總結", "檢查", "審查", "解釋", "評估", "問一下", "給我分析"
  
  2. **CONTEXT/OBJECT** (必須有對象):
     Can be: "this page", "current page", "this content", "this article", "the page", "頁面", "當前頁面"
     Or implicit: User intends to analyze the current page content
  
  ** DECISION RULE: Check for BOTH verb + page/content reference **
  - If sentence has ACTION VERB + page/content mention → CALL ask_gemini
  - If sentence has ONLY verb (no page reference) → REJECT with error
  - If sentence is just mentioning Gemini (no verb) → REJECT with error
  - If sentence is general talk → REJECT with error

examples_CORRECT_verb_plus_page:
  - "ask Gemini" ✓ (verb: ask, implicit: current page)
  - "send this page to Gemini" ✓ (verb: send, object: this page)
  - "analyze the current page" ✓ (verb: analyze, object: current page)
  - "summarize this" ✓ (verb: summarize, object: this)
  - "問一下 Gemini" ✓ (verb: 問, object: 當前頁面 implicit)
  - "給我分析一下頁面" ✓ (verb: 分析, object: 頁面)
  - "用 Gemini 檢查一下" ✓ (verb: 檢查, object: current page implicit)

examples_INCORRECT_missing_verb:
  - "Gemini" ✗ (no verb, just website name)
  - "OK, OK Gemini" ✗ (no verb, just mimicking)
  - "Gemini 很強" ✗ (no verb, just statement)
  - "Google Gemini" ✗ (no verb, just naming)

examples_INCORRECT_missing_page_reference:
  - "分析一下" ✗ (verb exists but no page specified)
  - "詢問" ✗ (verb alone without target)
  - "送出去" ✗ (verb alone without what to send)

examples_INCORRECT_general_talk:
  - "你好" ✗ (no verb + page pattern)
  - "很有趣" ✗ (no verb + page pattern)
  - "Gemini 是什麼" ✗ (question but no analysis request)

when_NOT_to_use:
  - Missing ACTION VERB: User only mentions "Gemini" without asking to analyze ("Gemini", "OK, OK Gemini")
  - Missing PAGE REFERENCE: User says verb but doesn't specify what to analyze ("分析一下", "ask")
  - Statement without request: User makes a statement about Gemini ("Gemini 很強", "Google Gemini 不錯")
  - General conversation: Unrelated questions or statements ("你好", "很有趣")
  
  ** REJECT IF: Sentence is missing either the verb OR the page/content reference **

intent_examples:
  CORRECT - call this skill (HAS verb + page):
    - "ask Gemini" → Call ask_gemini (implicit current page)
    - "send this page to Gemini" → Call with current page
    - "analyze the current page" → Call with current page
    - "給我分析頁面" → Call with current page
    - "問一下 Gemini" → Call with current page

  INCORRECT - do NOT call this skill (MISSING verb OR page):
    - "Gemini" → REJECT (missing verb)
    - "OK, OK Gemini" → REJECT (missing verb, just mimicking)
    - "Gemini 很強" → REJECT (missing verb, statement only)
    - "分析一下" → REJECT (missing page reference)
    - "ask" → REJECT (missing what to ask about)
    - "你好" → REJECT (no verb + page pattern)
    - "很有趣" → REJECT (no verb + page pattern)

input: User must explicitly ask to analyze/summarize the current page using Gemini

output:
Only respond with THIS EXACT JSON format when user explicitly asks to analyze/send current page to Gemini:
{"skill": "ask_gemini", "args": {}}

If user is NOT asking to analyze the page, respond with:
{"error": "This request is not asking to analyze the page with Gemini"}

CRITICAL RULE - VERB + PAGE REFERENCE REQUIREMENT:
✓ MUST HAVE: Action Verb (ask, send, analyze, summarize, etc.) + Page Reference (implicit or explicit)
✗ DO NOT CALL if either is missing
✗ DO NOT CALL if only mentioned in passing
✗ DO NOT CALL if it's a statement or question without the verb+page pattern

Examples that FAIL the rule:
  - "Gemini" - No verb (just website name)
  - "Gemini 很強" - No verb (just statement)
  - "分析一下" - No page reference (just verb)
  - "你好" - Neither verb nor page reference

Only proceed to call ask_gemini if you can identify BOTH an action verb AND a page/content reference in the user's input.
