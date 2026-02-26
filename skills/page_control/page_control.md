name: page_control
runInPageContext: true

description: Navigate to the previous or next page using browser history. Only use this skill when the user explicitly asks to go back/forward or navigate to the previous/next page.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "go back", "previous", "back", "go to previous", "next", "go next", "forward", "go forward"
     Chinese: "上一頁", "返回", "回上一頁", "下一頁", "往下", "往前", "前進"
  
  2. **CLEAR INTENT** (必須有清晰的意圖):
     User must explicitly ask for page navigation (not just mentioning it)

  ** DECISION RULE: Check for BOTH verb + navigation intent **
  - If sentence has navigation verb (back/next/forward) → CALL page_control
  - If sentence is just mentioning pages casually → REJECT
  - If sentence doesn't indicate forward/backward movement → REJECT

examples_CORRECT_navigation:
  - "go back" ✓ (verb: go back, intent: previous page)
  - "go to previous page" ✓ (verb: go to previous, intent: previous page)
  - "next page" ✓ (verb: next, intent: next page)
  - "go forward" ✓ (verb: go forward, intent: next page)
  - "上一頁" ✓ (verb: 上一頁, intent: previous page)
  - "下一頁" ✓ (verb: 下一頁, intent: next page)
  - "返回" ✓ (verb: 返回, intent: previous page)

examples_INCORRECT_casual_mention:
  - "what's the previous page?" ✗ (no verb, just mentioning)
  - "I want to check the next page" ✗ (statement, not explicit request)
  - "pages" ✗ (just word, no verb or intent)

when_NOT_to_use:
  - No clear navigation verb: User only mentions pages without asking to navigate
  - Casual conversation: User is asking about pages but not requesting navigation
  - Unclear direction: User doesn't specify "back", "previous", "next", or "forward"

intent_examples:
  CORRECT - call this skill (HAS navigation verb):
    - "go back" → Call page_control with direction: "previous"
    - "go to previous page" → Call page_control with direction: "previous"
    - "next page" → Call page_control with direction: "next"
    - "go forward" → Call page_control with direction: "next"
    - "上一頁" → Call page_control with direction: "previous"
    - "下一頁" → Call page_control with direction: "next"
    - "返回" → Call page_control with direction: "previous"

  INCORRECT - do NOT call this skill (MISSING verb OR intent):
    - "what's the previous page?" → REJECT (no verb)
    - "I want to check the next page" → REJECT (statement, not request)
    - "pages" → REJECT (no navigation verb)

input: User must explicitly request to navigate to previous or next page with direction

output:
Only respond with THIS EXACT JSON format when user explicitly asks to navigate:
{"skill": "page_control", "args": {"direction": "previous"|"next", "prompt": "user input"}}

If user is NOT asking to navigate pages, respond with:
{"error": "This request is not asking to navigate to previous/next page"}

IMPORTANT - args structure:
- "direction" must be either "previous" or "next" (case-sensitive)
- "prompt" is the entire user input (included for consistency)
- Map user input to direction:
  * "back", "previous", "go back", "返回", "上一頁" → "previous"
  * "next", "forward", "go forward", "下一頁", "往前", "前進" → "next"

Examples of correct output:
- User says "go back" → {"skill": "page_control", "args": {"direction": "previous", "prompt": "go back"}}
- User says "next page" → {"skill": "page_control", "args": {"direction": "next", "prompt": "next page"}}
- User says "上一頁" → {"skill": "page_control", "args": {"direction": "previous", "prompt": "上一頁"}}
- User says "下一頁" → {"skill": "page_control", "args": {"direction": "next", "prompt": "下一頁"}}
- User says "go forward" → {"skill": "page_control", "args": {"direction": "next", "prompt": "go forward"}}
- User says "返回" → {"skill": "page_control", "args": {"direction": "previous", "prompt": "返回"}}

CRITICAL RULE - NAVIGATION INTENT REQUIREMENT:
✓ MUST HAVE: Clear navigation verb (back/previous/next/forward)
✗ DO NOT CALL if just mentioning pages
✗ DO NOT CALL if it's a casual statement
✗ DO NOT CALL if intent is unclear

Only proceed to call page_control if you can identify a CLEAR navigation request with direction.
