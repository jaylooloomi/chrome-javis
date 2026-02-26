name: page_scroll

description: Scroll the current page up, down, or jump to top/bottom. Only use this skill when the user explicitly asks to scroll/page up/down/to top/to bottom.

when_to_use:
  MUST HAVE:
  1. **ACTION VERB** (必須有動詞):
     English: "scroll", "page", "go to", "jump to", "back to"
     Chinese: "向下滾", "向上滾", "下一頁", "上一頁", "回到頂部", "到底部"
  
  2. **DIRECTION** (必須有方向):
     Supported: down, up, top, bottom
     Examples: "down" (向下), "up" (向上), "top" (頂部), "bottom" (底部)
  
  ** DECISION RULE: Check for BOTH verb + direction **
  - If sentence has ACTION VERB + direction → CALL page_scroll
  - If sentence has ONLY verb (no direction) → REJECT with error
  - If sentence is just mentioning → REJECT with error

examples_CORRECT_verb_plus_direction:
  - "scroll down" ✓ (verb: scroll, direction: down)
  - "page down" ✓ (verb: page, direction: down)
  - "下一頁" ✓ (verb: 下一頁, direction: down)
  - "上一頁" ✓ (verb: 上一頁, direction: up)
  - "go to top" ✓ (verb: go to, direction: top)
  - "jump to bottom" ✓ (verb: jump to, direction: bottom)
  - "回到頂部" ✓ (verb: 回到, direction: top)
  - "到底部" ✓ (verb: 到, direction: bottom)
  - "scroll up" ✓ (verb: scroll, direction: up)

examples_INCORRECT_missing_verb:
  - "down" ✗ (no verb, just direction)
  - "top" ✗ (no verb, just direction)

examples_INCORRECT_missing_direction:
  - "scroll" ✗ (verb exists but no direction specified)
  - "page" ✗ (verb alone without direction)

examples_INCORRECT_general_talk:
  - "這個頁面很長" ✗ (no verb + direction pattern)
  - "你在幹嘧" ✗ (no verb + direction pattern)

when_NOT_to_use:
  - Missing ACTION VERB: User only mentions direction without asking to scroll ("down", "top")
  - Missing DIRECTION: User says verb but doesn't specify which direction to scroll ("scroll something", "page 一下")
  - General statement: User makes a statement about page length ("這個頁面很長", "好多內容")
  - General conversation: Unrelated questions ("你在幹嘧", "很強喔")
  
  ** REJECT IF: Sentence is missing either the verb OR the direction **

examples_JSON_format:
  - User: "scroll down" / "下一頁"
    AI Response: {"skill": "page_scroll", "args": {"direction": "down"}}
  
  - User: "scroll up" / "上一頁"
    AI Response: {"skill": "page_scroll", "args": {"direction": "up"}}
  
  - User: "go to top" / "回到頂部"
    AI Response: {"skill": "page_scroll", "args": {"direction": "top"}}
  
  - User: "jump to bottom" / "到底部"
    AI Response: {"skill": "page_scroll", "args": {"direction": "bottom"}}

parameters:
  - direction: "down" | "up" | "top" | "bottom" (required)
    - "down": Scroll down by 500px
    - "up": Scroll up by 500px
    - "top": Jump to page top
    - "bottom": Jump to page bottom

return_format:
  - Success: "✅ 向下滾動" / "✅ 向上滾動" / "✅ 滾到頂部" / "✅ 滾到底部"
  - Error: Throw error if direction is invalid or page cannot be scrolled
