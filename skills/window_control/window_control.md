name: window_control
runInPageContext: false

description: Control window fullscreen mode. Only use this skill when the user explicitly asks to enter or exit fullscreen mode.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "fullscreen", "full screen", "enter fullscreen", "exit fullscreen", "quit fullscreen", "leave fullscreen", "toggle fullscreen"
     Chinese: "全螢幕", "全屏", "進入全螢幕", "退出全螢幕", "離開全螢幕", "切換全螢幕"
  
  2. **CLEAR INTENT** (必須有清晰的意圖):
     User must explicitly ask to enter or exit fullscreen mode

  ** DECISION RULE: Check for BOTH verb + fullscreen intent **
  - If sentence has fullscreen verb (enter/exit/toggle fullscreen) → CALL window_control
  - If sentence is just mentioning fullscreen casually → REJECT
  - If sentence doesn't indicate entering/exiting fullscreen → REJECT

examples_CORRECT_fullscreen:
  - "enter fullscreen" ✓ (verb: enter, intent: fullscreen)
  - "full screen" ✓ (verb: fullscreen, intent: fullscreen)
  - "exit fullscreen" ✓ (verb: exit, intent: exit fullscreen)
  - "quit fullscreen" ✓ (verb: quit, intent: exit fullscreen)
  - "全螢幕" ✓ (verb: 全螢幕, intent: fullscreen)
  - "進入全螢幕" ✓ (verb: 進入全螢幕, intent: enter fullscreen)
  - "退出全螢幕" ✓ (verb: 退出全螢幕, intent: exit fullscreen)
  - "toggle fullscreen" ✓ (verb: toggle, intent: toggle fullscreen)

examples_INCORRECT_casual_mention:
  - "what is fullscreen?" ✗ (no verb, just mentioning)
  - "I want fullscreen mode" ✗ (statement, not explicit request)
  - "fullscreen" ✗ (just word, no clear verb or direction)

when_NOT_to_use:
  - No clear fullscreen verb: User only mentions fullscreen without asking to activate/deactivate
  - Casual conversation: User is asking about fullscreen but not requesting to toggle it
  - Unclear intent: User doesn't specify "enter", "exit", "quit", or explicit action

intent_examples:
  CORRECT - call this skill (HAS fullscreen verb):
    - "enter fullscreen" → Call window_control with mode: "enter"
    - "full screen" → Call window_control with mode: "enter"
    - "exit fullscreen" → Call window_control with mode: "exit"
    - "quit fullscreen" → Call window_control with mode: "exit"
    - "全螢幕" → Call window_control with mode: "enter"
    - "進入全螢幕" → Call window_control with mode: "enter"
    - "退出全螢幕" → Call window_control with mode: "exit"
    - "toggle fullscreen" → Call window_control with mode: "toggle"

  INCORRECT - do NOT call this skill (MISSING verb OR intent):
    - "what is fullscreen?" → REJECT (no verb)
    - "I want fullscreen mode" → REJECT (statement, not request)
    - "fullscreen" → REJECT (no clear intent)

input: User must explicitly request to enter, exit, or toggle fullscreen mode

output:
Only respond with THIS EXACT JSON format when user explicitly asks to control fullscreen:
{"skill": "window_control", "args": {"mode": "enter"|"exit"|"toggle", "prompt": "user input"}}

If user is NOT asking to control fullscreen, respond with:
{"error": "This request is not asking to control fullscreen mode"}

IMPORTANT - args structure:
- "mode" must be either "enter", "exit", or "toggle" (case-sensitive)
- "prompt" is the entire user input (included for consistency)
- Map user input to mode:
  * "enter", "fullscreen", "full screen", "進入全螢幕", "全螢幕", "進入" → "enter"
  * "exit", "quit", "leave", "退出全螢幕", "退出", "離開" → "exit"
  * "toggle" → "toggle"

Examples of correct output:
- User says "enter fullscreen" → {"skill": "window_control", "args": {"mode": "enter", "prompt": "enter fullscreen"}}
- User says "exit fullscreen" → {"skill": "window_control", "args": {"mode": "exit", "prompt": "exit fullscreen"}}
- User says "全螢幕" → {"skill": "window_control", "args": {"mode": "enter", "prompt": "全螢幕"}}
- User says "退出全螢幕" → {"skill": "window_control", "args": {"mode": "exit", "prompt": "退出全螢幕"}}
- User says "toggle fullscreen" → {"skill": "window_control", "args": {"mode": "toggle", "prompt": "toggle fullscreen"}}

CRITICAL RULE - FULLSCREEN CONTROL INTENT REQUIREMENT:
✓ MUST HAVE: Clear fullscreen control verb (enter/exit/toggle/fullscreen)
✗ DO NOT CALL if just mentioning fullscreen
✗ DO NOT CALL if it's a casual statement
✗ DO NOT CALL if intent is unclear

Only proceed to call window_control if you can identify a CLEAR fullscreen control request with mode.
