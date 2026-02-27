name: open_tab

description: Open a website URL in a new browser tab. Only use this skill when the user explicitly asks to open/visit a specific website.

when_to_use:
  MUST HAVE BOTH:
  1. **ACTION VERB** (必須有動詞):
     English: "open", "visit", "check", "browse", "access", "show"
     Chinese: "打開", "開啟", "訪問", "查看", "進入"
  
  2. **WEBSITE NAME** (必須有網站名稱):
     Supported: Google, Google Search, YouTube, YouTube Music, GitHub, Twitter, LinkedIn, Facebook, Instagram, Yahoo, Gmail, Gemini, Nebula, Google Keep, Google Drive, Google Docs, Google Sheets, Google Slides, Google Forms, Google Photos, Google Calendar, Google Meet, Google Chat, Google Maps, Google Earth, Google Translate, Google Chrome, Google Cloud Platform, Google Search Console, Google Analytics, Google Ads, Google Play Store, Google Home, Google Sites, Google Finance, Google News, Google Contacts, Setting
  
  ** DECISION RULE: Check for BOTH verb + website name **
  - If sentence has ACTION VERB + website name → CALL open_tab
  - If sentence has ONLY website name (no verb) → REJECT with error
  - If sentence has ONLY verb (no website) → REJECT with error
  - If sentence is just mentioning/statement → REJECT with error

examples_CORRECT_verb_plus_website:
  - "open Google" ✓ (verb: open, site: Google)
  - "visit YouTube" ✓ (verb: visit, site: YouTube)
  - "open YouTube Music" ✓ (verb: open, site: YouTube Music)
  - "打開 GitHub" ✓ (verb: 打開, site: GitHub)
  - "check LinkedIn" ✓ (verb: check, site: LinkedIn)
  - "visit Yahoo" ✓ (verb: visit, site: Yahoo)
  - "open Gmail" ✓ (verb: open, site: Gmail)
  - "open Gemini" ✓ (verb: open, site: Gemini)
  - "open Nebula" ✓ (verb: open, site: Nebula)
  - "open Google Keep" ✓ (verb: open, site: Google Keep)
  - "open Google Drive" ✓ (verb: open, site: Google Drive)
  - "open Google Docs" ✓ (verb: open, site: Google Docs)
  - "open Google Sheets" ✓ (verb: open, site: Google Sheets)
  - "open Google Meet" ✓ (verb: open, site: Google Meet)
  - "open Google Maps" ✓ (verb: open, site: Google Maps)

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
    - "open Google" → Call open_tab with Google
    - "visit YouTube" → Call open_tab with YouTube
    - "open YouTube Music" → Call open_tab with YouTube Music
    - "打開 GitHub" → Call open_tab with GitHub
    - "visit Yahoo" → Call open_tab with Yahoo
    - "open Gemini" → Call open_tab with Gemini
    - "open Gmail" → Call open_tab with Gmail
    - "open Google Keep" → Call open_tab with Google Keep
    - "open Nebula" → Call open_tab with Nebula
    - "open setting" → Call open_tab with Setting

  INCORRECT - do NOT call this skill (MISSING verb OR website):
    - "Google" → REJECT (missing verb)
    - "OK, OK Google" → REJECT (missing verb, just mimicking)
    - "Google 很強" → REJECT (missing verb, statement only)
    - "YouTube 好玩" → REJECT (missing verb, statement only)
    - "打開一下" → REJECT (missing website name)
    - "open" → REJECT (missing website name)
    - "你在幹嘧" → REJECT (no verb + website pattern)
    - "很強喔" → REJECT (no verb + website pattern)

input: User must explicitly ask to open a website with both verb and website name

output:
Only respond with THIS EXACT JSON format when user explicitly asks to open a website:
{"skill": "open_tab", "args": {"url": "https://...", "prompt": "user input"}}

If user is NOT asking to open a website, respond with:
{"error": "This request is not asking to open a website"}

IMPORTANT - args structure and URL conversion:
- All parameters must be inside "args" object
- "url" is the ACTUAL CONVERTED URL (not a placeholder)
- "prompt" is the entire user input (included for consistency with other skills, but not used by open_tab)
- You must convert website names to full URLs using the rules below

URL conversion rules:
1. If user says "google" or "google search" → "https://google.com"
2. If user says "youtube" → "https://youtube.com"
3. If user says "youtube music" → "https://music.youtube.com"
4. If user says "github" → "https://github.com"
5. If user says "twitter" → "https://twitter.com"
6. If user says "linkedin" → "https://linkedin.com"
7. If user says "facebook" → "https://facebook.com"
8. If user says "instagram" → "https://instagram.com"
9. If user says "yahoo" → "https://yahoo.com"
10. If user says "gemini" → "https://gemini.google.com"
11. If user says "nebula" → "https://www.nebula.gg/"
12. If user says "google drive" → "https://drive.google.com"
13. If user says "google docs" → "https://docs.google.com"
14. If user says "google sheets" → "https://sheets.google.com"
15. If user says "google slides" → "https://slides.google.com"
16. If user says "google forms" → "https://forms.google.com"
17. If user says "google photos" → "https://photos.google.com"
18. If user says "google calendar" → "https://calendar.google.com"
19. If user says "google meet" → "https://meet.google.com"
20. If user says "google chat" → "https://chat.google.com"
21. If user says "google maps" → "https://maps.google.com"
22. If user says "google earth" → "https://earth.google.com"
23. If user says "google translate" → "https://translate.google.com"
24. If user says "google chrome" → "https://google.com/chrome"
25. If user says "google cloud platform" → "https://cloud.google.com"
26. If user says "google search console" → "https://search.google.com/search-console"
27. If user says "google analytics" → "https://www.google.com/search?q=analytics.google.com"
28. If user says "google ads" → "https://ads.google.com"
29. If user says "google play store" → "https://play.google.com"
30. If user says "google home" → "https://home.google.com"
31. If user says "google sites" → "https://sites.google.com"
32. If user says "google finance" → "https://google.com/finance"
33. If user says "google news" → "https://news.google.com"
34. If user says "google contacts" → "https://contacts.google.com"
35. If user says "gmail" → "https://mail.google.com"
36. If user says "google keep" → "https://keep.google.com"
37. If user says "setting" → "chrome-extension://llffkjaidimijhnkgpacebjkiicccaaj/options.html"
38. Always add https:// prefix if missing (unless chrome-extension URL)
39. Never return empty URL

Examples of correct output:
- User says "open Google" → {"skill": "open_tab", "args": {"url": "https://google.com"}}
- User says "visit YouTube" → {"skill": "open_tab", "args": {"url": "https://youtube.com"}}
- User says "open YouTube Music" → {"skill": "open_tab", "args": {"url": "https://music.youtube.com"}}
- User says "visit github.com" → {"skill": "open_tab", "args": {"url": "https://github.com"}}
- User says "visit Yahoo" → {"skill": "open_tab", "args": {"url": "https://yahoo.com"}}
- User says "open Gemini" → {"skill": "open_tab", "args": {"url": "https://gemini.google.com"}}
- User says "open Gmail" → {"skill": "open_tab", "args": {"url": "https://mail.google.com"}}
- User says "open Nebula" → {"skill": "open_tab", "args": {"url": "https://www.nebula.gg/"}}
- User says "open Google Drive" → {"skill": "open_tab", "args": {"url": "https://drive.google.com"}}
- User says "open Google Docs" → {"skill": "open_tab", "args": {"url": "https://docs.google.com"}}
- User says "open Google Sheets" → {"skill": "open_tab", "args": {"url": "https://sheets.google.com"}}
- User says "open Google Meet" → {"skill": "open_tab", "args": {"url": "https://meet.google.com"}}
- User says "open Google Maps" → {"skill": "open_tab", "args": {"url": "https://maps.google.com"}}
- User says "open Google Calendar" → {"skill": "open_tab", "args": {"url": "https://calendar.google.com"}}
- User says "open Google Cloud Platform" → {"skill": "open_tab", "args": {"url": "https://cloud.google.com"}}
- User says "open Google Analytics" → {"skill": "open_tab", "args": {"url": "https://www.google.com/search?q=analytics.google.com"}}
- User says "open setting" → {"skill": "open_tab", "args": {"url": "chrome-extension://llffkjaidimijhnkgpacebjkiicccaaj/options.html"}}

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
 