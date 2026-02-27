name: download_all_images

description: 下載所有圖片 - 下載頁面上的所有圖片。僅在用戶明確要求下載/保存頁面圖片時使用。Download all images on the current page. Only use this skill when the user explicitly asks to download/save/export images from the current page.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "download", "save", "export", "grab", "collect"
     Chinese: "下載", "保存", "導出", "下載下來", "存取"
  
  2. **OBJECT/CONTEXT** (必須有對象):
     Can be: "images", "pictures", "photos", "all images on this page", "all pictures"
     Chinese: "圖片", "照片", "所有圖片", "頁面上的圖片", "這頁的照片"
  
  ** DECISION RULE: Check for BOTH verb + image/picture reference **
  - If sentence has ACTION VERB + image mention → CALL download_all_images
  - If sentence has ONLY verb (no image reference) → REJECT with error
  - If sentence is just mentioning images (no verb) → REJECT with error
  - If sentence is general talk → REJECT with error

examples_CORRECT_verb_plus_images:
  - "download all images" ✓ (verb: download, object: all images)
  - "save the pictures" ✓ (verb: save, object: pictures)
  - "export these photos" ✓ (verb: export, object: photos)
  - "下載圖片" ✓ (verb: 下載, object: 圖片)
  - "保存所有照片" ✓ (verb: 保存, object: 所有照片)
  - "把圖片都下載下來" ✓ (verb: 下載, object: 圖片)
  - "下載這頁的所有圖片" ✓ (verb: 下載, object: 所有圖片)

examples_INCORRECT_missing_verb:
  - "images" ✗ (no verb, just object)
  - "pictures on the page" ✗ (no verb, just description)
  - "圖片" ✗ (no verb, just object)

examples_INCORRECT_missing_object:
  - "download" ✗ (verb alone without what to download)
  - "下載" ✗ (verb alone without target)
  - "save" ✗ (verb alone without target)

examples_INCORRECT_general_talk:
  - "圖片很漂亮" ✗ (no verb + image pattern, just statement)
  - "這些照片不錯" ✗ (no verb + image pattern, just statement)
  - "你會下載嗎" ✗ (question but no download request)

when_NOT_to_use:
  - Missing ACTION VERB: User only mentions images without asking to download ("images", "pictures")
  - Missing IMAGE OBJECT: User says verb but doesn't specify images ("download", "save")
  - Statement without request: User makes a statement about images ("圖片很漂亮", "照片不錯")
  - Single image download: User wants to download one specific image (not applicable for this skill)
  - General conversation: Unrelated questions or statements ("圖片很漂亮", "這些照片不錯")
  
  ** REJECT IF: Sentence is missing either the verb OR the image/picture reference **

intent_examples:
  CORRECT - call this skill (HAS verb + image):
    - "download all images" → Call download_all_images with current page
    - "save the pictures" → Call download_all_images with current page
    - "export these photos" → Call download_all_images with current page
    - "下載圖片" → Call download_all_images with current page
    - "保存所有照片" → Call download_all_images with current page
    - "把圖片都下載下來" → Call download_all_images with current page

  INCORRECT - do NOT call this skill (MISSING verb OR object):
    - "images" → REJECT (missing verb)
    - "download" → REJECT (missing what to download)
    - "圖片" → REJECT (missing verb)
    - "下載" → REJECT (missing target)
    - "圖片很漂亮" → REJECT (statement, no verb+object pattern)
    - "照片不錯" → REJECT (statement, no verb+object pattern)

input: User must explicitly ask to download images from the current page

output:
Only respond with THIS EXACT JSON format when user explicitly asks to download images:
{"skill": "download_all_images", "args": {"tabId": "ACTIVE_TAB", "url": "ACTIVE_TAB_URL", "prompt": ""}}

If user is NOT asking to download images, respond with:
{"error": "This request is not asking to download images"}

IMPORTANT - Placeholder handling:
- "ACTIVE_TAB" is a PLACEHOLDER that Service Worker will replace with the actual tabId
- "ACTIVE_TAB_URL" is a PLACEHOLDER that Service Worker will replace with the actual page URL
- "prompt" is the user's custom instruction (can be empty string "" as this skill doesn't use it)
- DO NOT try to get the actual tabId/URL yourself
- DO NOT hardcode any values
- Always use these exact placeholders in your response
- Service Worker will handle the replacement before passing to the skill

Example flow:
1. User says "下載這頁的所有圖片" on https://example.com/gallery (tabId=456)
2. AI returns: {"skill": "download_all_images", "args": {"tabId": "ACTIVE_TAB", "url": "ACTIVE_TAB_URL", "prompt": ""}}
3. Service Worker replaces: {"args": {"tabId": 456, "url": "https://example.com/gallery"}}
4. Skill receives the actual values and starts downloading all images

NOTES:
- All images will be automatically saved to the "downloaded_images" folder
- Files are automatically numbered (image_001, image_002, etc.)
- Downloaded images include http, https, data:, and blob: URLs
- Duplicate URLs are automatically filtered out
- Downloading starts immediately, no confirmation dialog

