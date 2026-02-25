name: summarize_page
description: Extract and summarize the current webpage content.

args: None (reads current active tab)

execution:
  1. Injects script to extract document.body.innerText
  2. Returns { pageContent: \"...\" }
  3. Gateway will call Gemini Flash to summarize
