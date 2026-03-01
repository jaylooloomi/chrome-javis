name: who_are_you

description: Introduce yourself and provide information about the OmniAssistant. Use this skill when the user asks about your identity, capabilities, or what you can do.

when_to_use:
  - User asks "who are you?"
  - User asks "what are you?"
  - User asks "what are you doing?"
  - User asks "what can you do?"
  - User asks about capabilities
  - User asks "介紹一下自己" (introduce yourself)
  - User asks "你是誰?" (who are you?)
  - User asks "你是誰?" (who you are?)
  - User asks "你能做什麼?" (what can you do?)
  - User asks "你在幹嘛?" (what are you doing?)

examples_CORRECT:
  - "who are you" ✓ (asking for identity)
  - "what are you" ✓ (asking for identity)
  - "what are you doing" ✓ (asking for current activity)
  - "tell me about yourself" ✓ (asking for info)
  - "你是誰" ✓ (asking for identity in Chinese)
  - "你在幹嘧" ✓ (asking for current activity in Chinese)
  - "介紹一下自己" ✓ (introduce yourself in Chinese)
  - "你能做什麼" ✓ (asking about capabilities in Chinese)

examples_INCORRECT:
  - "open Google" ✗ (not asking about identity)
  - "summarize this page" ✗ (not asking about identity)

action_params:
  - No parameters required

response_format:
  Return a string with introduction information about OmniAssistant.
