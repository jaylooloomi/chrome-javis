name: switch_mode

description: Switch between different AI models. Allows users to change the active AI model for subsequent requests.

when_to_use:
  - User wants to change AI model: "switch to", "change model", "use", "切換", "改用", "選擇"
  - User specifies a model: Gemini, Ollama, gemma2b, gemmaLarge, minimax
  - Example: "switch to Gemini", "use ollamaGemma2B", "改用 Ollama"

when_NOT_to_use:
  - User is asking about models without requesting to switch
  - Example: "which model", "tell me about Gemini"

intent_examples:
  CORRECT - call this skill:
    - "switch to geminiFlash"
    - "use ollamaGemma2B"
    - "改用 ollamaGemmaLarge"
    - "change model to ollamaMinimaxM2"

  INCORRECT - do NOT call this skill:
    - "tell me about available models"
    - "which model is faster"

input: User request with target model name
Available models: geminiFlash, ollamaGemma2B, ollamaGemmaLarge, ollamaMinimaxM2

output:
Only respond with THIS EXACT JSON format when user wants to switch model:
{"skill": "switch_mode", "model": "modelName"}

If model name is invalid or missing, respond with:
{"error": "Invalid model or model not specified"}

CRITICAL RULE: Only call switch_mode if user explicitly asks to change/switch/use a specific model.
Respond with {"error": "..."} if model name is invalid or ambiguous.
