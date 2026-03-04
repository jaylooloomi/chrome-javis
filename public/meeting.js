// Meeting Assistant - JavaScript Module

console.log('[Meeting.js] 文件已加載');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecording = false;
let recordedTranscript = '';

// Initialize Speech Recognition
function initSpeechRecognition() {
    if (!SpeechRecognition) {
        showStatus('您的瀏覽器不支援語音識別功能', 'error');
        document.getElementById('recordBtn').disabled = true;
        return false;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-TW'; // Traditional Chinese
    
    recognition.onstart = () => {
        isRecording = true;
        recordedTranscript = document.getElementById('textboxA').value || '';
        document.getElementById('recordBtn').textContent = '⏹️ 停止錄音';
        document.getElementById('recordBtn').classList.add('recording');
        console.log('[Meeting] 開始錄音，初始轉錄:', recordedTranscript);
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                recordedTranscript += transcript + ' ';
                console.log('[Meeting] 最終轉錄:', transcript);
            } else {
                interimTranscript += transcript;
            }
        }
        
        // 實時更新 textboxA
        const textboxA = document.getElementById('textboxA');
        textboxA.value = recordedTranscript + interimTranscript;
        console.log('[Meeting] 更新 textboxA:', textboxA.value);
    };
    
    recognition.onerror = (event) => {
        showStatus(`語音識別錯誤: ${event.error}`, 'error');
    };
    
    recognition.onend = () => {
        isRecording = false;
        document.getElementById('recordBtn').textContent = '🎙️ 開始錄音';
        document.getElementById('recordBtn').classList.remove('recording');
        // 最後一次確保 textboxA 包含完整的錄音結果
        document.getElementById('textboxA').value = recordedTranscript.trim();
        console.log('[Meeting] 錄音結束，最終轉錄:', recordedTranscript.trim());
    };
    
    return true;
}

// Toggle Recording
function toggleRecording() {
    if (!recognition) {
        initSpeechRecognition();
    }
    
    if (isRecording) {
        console.log('[Meeting] 停止錄音');
        recognition.stop();
    } else {
        console.log('[Meeting] 開始錄音');
        recordedTranscript = document.getElementById('textboxA').value || '';
        recognition.start();
    }
}

// Handle Audio File Import
async function handleAudioImport(event) {
    console.log('[Audio Import] ========== 開始導入音檔 ==========');
    
    const file = event.target.files[0];
    if (!file) {
        console.warn('[Audio Import] ❌ 未選擇文件');
        return;
    }
    
    console.log('[Audio Import] 📄 檔案信息:', {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        lastModified: new Date(file.lastModified).toLocaleString('zh-TW')
    });
    
    // Check file type - Support multiple audio formats
    const validTypes = [
        'audio/mpeg', 'audio/mp3',           // MP3
        'audio/wav', 'audio/wave',           // WAV
        'audio/aac', 'audio/aacp',           // AAC
        'audio/flac',                        // FLAC
        'audio/mp4', 'audio/mp4a-latm',      // M4A
        'audio/ogg', 'audio/vorbis'          // OGG
    ];
    
    const validExtensions = ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    console.log('[Audio Import] 🔍 驗證文件格式:', {
        fileType: file.type,
        fileExtension: fileExtension,
        isValidType: validTypes.includes(file.type),
        isValidExtension: validExtensions.includes(fileExtension)
    });
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        console.error('[Audio Import] ❌ 不支持的格式:', fileExtension);
        showStatus(`不支援的文件格式，請使用以下格式之一: ${validExtensions.join(', ')}`, 'error');
        event.target.value = '';
        return;
    }
    
    console.log('[Audio Import] ✅ 文件格式驗證通過');
    
    // Validate file size (max 25MB for Gemini API)
    const maxSize = 25 * 1024 * 1024;
    console.log('[Audio Import] 📏 檢查文件大小:', {
        fileSize: file.size,
        maxSize: maxSize,
        isValid: file.size <= maxSize
    });
    
    if (file.size > maxSize) {
        console.error('[Audio Import] ❌ 文件過大:', `${(file.size / 1024 / 1024).toFixed(2)} MB > ${(maxSize / 1024 / 1024).toFixed(2)} MB`);
        showStatus('文件過大，請選擇小於 25MB 的音檔', 'error');
        event.target.value = '';
        return;
    }
    
    console.log('[Audio Import] ✅ 文件大小驗證通過');
    
    showStatus('正在處理音檔...', 'pending');
    console.log('[Audio Import] ⏳ 開始讀取文件為 ArrayBuffer...');
    
    try {
        // Read file as data URL
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            console.log('[Audio Import] ✅ ArrayBuffer 讀取完成:', {
                byteLength: e.target.result.byteLength,
                readyState: fileReader.readyState
            });
            
            const audioDataUrl = e.target.result;
            
            // Get selected transcription language (default: Traditional Chinese)
            const language = document.getElementById('transcriptionLanguage').value || 'zh-TW';
            console.log('[Audio Import] 🌐 轉錄語言:', language);
            
            // Process audio transcription with Generative AI
            console.log('[Audio Import] 📤 呼叫 processAudioTranscription()...');
            await processAudioTranscription(audioDataUrl, file, language);
        };
        
        fileReader.onerror = (error) => {
            console.error('[Audio Import] ❌ FileReader 錯誤:', error);
            showStatus(`文件讀取失敗: ${error.message}`, 'error');
        };
        
        fileReader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                console.log(`[Audio Import] 📥 讀取進度: ${percentComplete.toFixed(2)}%`);
            }
        };
        
        fileReader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('[Audio Import] ❌ 音檔處理異常:', error);
        showStatus(`音檔處理失敗: ${error.message}`, 'error');
    }
    
    // Clear file input
    event.target.value = '';
    console.log('[Audio Import] 🔄 清除文件輸入框');
}

// Process Audio Transcription with Google Generative AI
async function processAudioTranscription(audioArrayBuffer, file, language) {
    console.log('[Audio Transcription] ========== 開始處理音檔轉錄 ==========');
    
    try {
        console.log('[Audio Transcription] 📊 輸入參數:', {
            arrayBufferByteLength: audioArrayBuffer.byteLength,
            fileName: file.name,
            language: language
        });
        
        // Convert ArrayBuffer to base64
        console.log('[Audio Transcription] 🔄 正在轉換為 Base64...');
        const bytes = new Uint8Array(audioArrayBuffer);
        let binaryString = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binaryString);
        console.log('[Audio Transcription] ✅ Base64 轉換完成:', {
            base64Length: base64Audio.length,
            originalByteLength: audioArrayBuffer.byteLength,
            compressionRatio: (base64Audio.length / audioArrayBuffer.byteLength).toFixed(2)
        });
        
        // Determine MIME type from file extension
        const extension = file.name.split('.').pop().toLowerCase();
        let mimeType = 'audio/mpeg';
        switch (extension) {
            case 'wav':
                mimeType = 'audio/wav';
                break;
            case 'aac':
                mimeType = 'audio/aac';
                break;
            case 'flac':
                mimeType = 'audio/flac';
                break;
            case 'ogg':
                mimeType = 'audio/ogg';
                break;
            case 'm4a':
                mimeType = 'audio/mp4';
                break;
        }
        
        console.log('[Audio Transcription] 🎯 檔案類型映射:', {
            extension: extension,
            detectedMimeType: mimeType
        });
        
        console.log('[Audio Transcription] 📤 準備發送至 Service Worker:', {
            action: 'transcribeAudio',
            audioDataLength: base64Audio.length,
            mimeType: mimeType,
            fileName: file.name,
            language: language
        });
        
        // Send to service worker for API processing
        chrome.runtime.sendMessage({
            action: 'transcribeAudio',
            audioData: base64Audio,
            mimeType: mimeType,
            fileName: file.name,
            language: language
        }, (response) => {
            console.log('[Audio Transcription] 📨 收到 Service Worker 回應:', response);
            
            if (chrome.runtime.lastError) {
                console.error('[Audio Transcription] ❌ Chrome 運行時錯誤:', chrome.runtime.lastError);
                showStatus(`遠程錯誤: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }
            
            if (!response) {
                console.error('[Audio Transcription] ❌ 收到空回應');
                showStatus('無回應，請檢查 API 配置', 'error');
                return;
            }
            
            if (response.success) {
                console.log('[Audio Transcription] ✅ 轉錄成功:', {
                    transcriptLength: response.transcript?.length || 0,
                    content: response.transcript?.substring(0, 100) + '...'
                });
                
                // Append transcription to textboxA
                const textboxA = document.getElementById('textboxA');
                if (!textboxA) {
                    console.error('[Audio Transcription] ❌ 找不到 textboxA 元素');
                    showStatus('畫面錯誤：找不到輸入框', 'error');
                    return;
                }
                
                const timestamp = new Date().toLocaleString('zh-TW');
                const appendText = `\n\n[音檔: ${file.name}] (${timestamp})\n${response.transcript}`;
                const newValue = textboxA.value.trim() ? textboxA.value.trim() + appendText : response.transcript;
                
                console.log('[Audio Transcription] 📝 更新 textboxA:', {
                    previousLength: textboxA.value.length,
                    appendLength: appendText.length,
                    newLength: newValue.length
                });
                
                textboxA.value = newValue;
                textboxA.scrollTop = textboxA.scrollHeight;  // Scroll to bottom
                
                console.log('[Audio Transcription] ✅ textboxA 已成功更新');
                showStatus(`✅ 音檔已成功轉錄: ${file.name}`, 'success');
            } else {
                console.error('[Audio Transcription] ❌ 轉錄失敗:', {
                    error: response.error,
                    errorMessage: response.errorMessage
                });
                showStatus(`轉錄失敗: ${response.error}`, 'error');
            }
            
            console.log('[Audio Transcription] ========== 轉錄流程完成 ==========');
        });
        
        showStatus('⏳ 正在使用 Google Gemini 進行轉錄...', 'pending');
        
    } catch (error) {
        console.error('[Audio Transcription] ❌ 轉錄異常:', {
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack
        });
        showStatus(`轉錄失敗: ${error.message}`, 'error');
    }
}

// Bind Event Listeners to Prompt Cards
function bindPromptCardEvents() {
    const cards = document.querySelectorAll('.prompt-card');
    cards.forEach(card => {
        const closeBtn = card.querySelector('.prompt-card-close');
        
        // 綁定卡片點擊事件
        card.addEventListener('click', function(e) {
            if (!e.target.classList.contains('prompt-card-close')) {
                selectPromptCard(this);
            }
        });
        
        // 綁定關閉按鈕事件
        if (closeBtn) {
            closeBtn.addEventListener('click', deletePromptCard);
        }
    });
    console.log(`[Meeting] 已為 ${cards.length} 張卡片綁定事件監聽器`);
}

// Add Prompt Card
function addPromptCard() {
    console.log('[Meeting] addPromptCard 被觸發');
    
    const textboxB = document.getElementById('textboxB');
    if (!textboxB) {
        console.error('[Meeting] 找不到 textboxB 元素');
        return;
    }
    
    const promptText = textboxB.value.trim();
    console.log('[Meeting] 提示語內容:', promptText);
    
    if (!promptText) {
        showStatus('請輸入提示語', 'error');
        return;
    }
    
    // Check if prompt already exists
    const container = document.getElementById('promptCardsContainer');
    if (!container) {
        console.error('[Meeting] 找不到 promptCardsContainer 元素');
        return;
    }
    
    const existingCards = Array.from(container.querySelectorAll('.prompt-card'));
    if (existingCards.some(card => card.dataset.prompt === promptText)) {
        showStatus('此提示語已存在', 'error');
        return;
    }
    
    // Create new card
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.prompt = promptText;
    
    // 創建文字容器
    const textSpan = document.createElement('span');
    textSpan.textContent = promptText;
    textSpan.style.flex = '1';
    textSpan.style.paddingRight = '25px';
    textSpan.style.display = 'block';
    textSpan.style.wordWrap = 'break-word';
    textSpan.style.wordBreak = 'break-word';
    textSpan.style.whiteSpace = 'normal';
    textSpan.style.overflow = 'visible';
    card.appendChild(textSpan);
    
    // 創建關閉按鈕
    const closeBtn = document.createElement('button');
    closeBtn.className = 'prompt-card-close';
    closeBtn.textContent = '×';
    card.appendChild(closeBtn);
    
    container.appendChild(card);
    textboxB.value = '';
    
    console.log('[Meeting] 新卡片已新增，當前卡片數量:', container.querySelectorAll('.prompt-card').length);
    showStatus('提示語已新增', 'success');
    
    // 為新卡片綁定事件監聽器
    bindPromptCardEvents();
}
}

// Select Prompt Card
function selectPromptCard(card) {
    // Remove active class from all cards
    document.querySelectorAll('.prompt-card').forEach(c => {
        c.classList.remove('active');
    });
    
    // Add active class to clicked card
    card.classList.add('active');
    
    // Update textboxB with selected prompt
    document.getElementById('textboxB').value = card.dataset.prompt;
}

// Delete Prompt Card
function deletePromptCard(event) {
    event.stopPropagation();
    const card = event.target.closest('.prompt-card');
    
    // Don't allow deleting if it's the last card
    const cards = document.querySelectorAll('.prompt-card');
    if (cards.length <= 1) {
        showStatus('至少需保留一張提示語卡', 'error');
        return;
    }
    
    // If this card was active, select the previous card
    if (card.classList.contains('active')) {
        const prevCard = card.previousElementSibling || card.nextElementSibling;
        if (prevCard) {
            selectPromptCard(prevCard);
        }
    }
    
    card.remove();
}

// Generate Meeting Notes
async function generateMeetingNotes() {
    const textboxA = document.getElementById('textboxA');
    const textboxB = document.getElementById('textboxB');
    const textboxC = document.getElementById('textboxC');
    
    console.log('[Meeting] generateMeetingNotes 被調用');
    console.log('[Meeting] textboxA:', textboxA?.value);
    console.log('[Meeting] textboxB:', textboxB?.value);
    
    if (!textboxA.value.trim()) {
        showStatus('請先輸入或錄製會議內容', 'error');
        return;
    }
    
    if (!textboxB.value.trim()) {
        showStatus('請選擇或輸入提示語', 'error');
        return;
    }
    
    // Disable button and show loading status
    const generateBtn = document.getElementById('generateBtnId');
    if (!generateBtn) {
        console.error('[Meeting] 找不到 generateBtnId 按鈕');
        return;
    }
    
    const originalText = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ 正在生成中...';
    
    showStatus('正在使用 AI 生成會議記錄...', 'pending');
    
    try {
        // Prepare the combined prompt
        const combinedPrompt = `
會議內容:
${textboxA.value}

處理指示:
${textboxB.value}

請根據上述會議內容和指示生成結構化的會議記錄。`;
        
        console.log('[Meeting] 準備呼叫 AI，prompt 長度:', combinedPrompt.length);
        
        // Call AI model API (requires backend integration)
        const result = await callAIModel(combinedPrompt);
        
        console.log('[Meeting] AI 返回結果，長度:', result.length);
        textboxC.value = result;
        showStatus('會議記錄生成成功！', 'success');
    } catch (error) {
        console.error('[Meeting] 生成失敗:', error);
        showStatus(`生成失敗: ${error.message}`, 'error');
        textboxC.value = '生成失敗，請檢查配置並重試。';
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = originalText;
    }
}

// Call AI Model (Placeholder for backend integration)
async function callAIModel(prompt) {
    // This is a placeholder function
    // In production, you would call your backend API
    // which integrates with an AI model (GPT, Claude, etc.)
    
    // Example placeholder response:
    return `# 會議記錄

## 會議日期
${new Date().toLocaleDateString('zh-TW')}

## 議題摘要
[AI 生成的摘要將顯示在此]

## 主要要點
1. [待定] - 需要配置 AI API
2. [待定] - 連接到 OpenAI/Claude/其他服務  
3. [待定] - 完成後端集成

## 行動項目
- [ ] [待定]

## 下次會議
[待定]

---
*此記錄由 Meeting Assistant 自動生成。需要配置 AI 模型 API 以完整功能運作。*`;
}

// Download as Markdown
function downloadMarkdown() {
    const textboxC = document.getElementById('textboxC');
    const content = textboxC.value.trim();
    
    if (!content) {
        showStatus('沒有會議記錄可下載', 'error');
        return;
    }
    
    const fileName = `meeting_${new Date().toISOString().slice(0, 10)}_${new Date().getHours()}-${new Date().getMinutes()}.md`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showStatus(`已下載: ${fileName}`, 'success');
}

// Submit Output to Different Platforms
function submitOutput() {
    const textboxC = document.getElementById('textboxC');
    const content = textboxC.value.trim();
    const targetSelect = document.getElementById('outputTargetSelect');
    const selectedTarget = targetSelect.value;
    
    if (!content) {
        showStatus('沒有會議記錄可輸出', 'error');
        return;
    }
    
    showStatus('正在輸出...', 'pending');
    
    const outputTitle = `會議記錄 - ${new Date().toLocaleDateString('zh-TW')}`;
    
    switch (selectedTarget) {
        case 'googledoc':
            sendToGoogleDoc(outputTitle, content);
            break;
        case 'googlekeep':
            sendToGoogleKeep(outputTitle, content);
            break;
        case 'gemini':
            sendToGemini(outputTitle, content);
            break;
        case 'notebooklm':
            sendToNotebookLM(outputTitle, content);
            break;
        default:
            showStatus('不支援的輸出目標', 'error');
    }
}

// Send to Google Docs
function sendToGoogleDoc(title, content) {
    // This will be implemented with Google Docs API
    // For now, showing placeholder message
    console.log('[Meeting] 準備輸出到 Google Docs:', { title, content });
    
    // TODO: Implement Google Docs API integration
    // You'll need to:
    // 1. Set up Google OAuth credentials
    // 2. Use Google Docs API to create/update document
    // 3. Handle authentication flows
    
    showStatus('Google Docs 整合開發中，敬請期待 📄', 'success');
}

// Send to Google Keep
function sendToGoogleKeep(title, content) {
    // This will be implemented with Google Keep API or Save to Pocket/Note
    // For now, showing placeholder message
    console.log('[Meeting] 準備輸出到 Google Keep:', { title, content });
    
    // TODO: Implement Google Keep integration
    // Note: Google Keep doesn't have official API
    // Alternative: Use web scraping or direct API if available
    
    showStatus('Google Keep 整合開發中，敬請期待 📌', 'success');
}

// Send to Gemini (Google AI Platform)
function sendToGemini(title, content) {
    // This will be implemented with Gemini API
    // For now, showing placeholder message
    console.log('[Meeting] 準備傳送到 Gemini:', { title, content });
    
    // TODO: Implement Gemini API integration
    // You'll need to:
    // 1. Get Gemini API key
    // 2. Send content to Gemini for processing/summarization
    // 3. Handle API responses
    
    showStatus('Gemini 整合開發中，敬請期待 ✨', 'success');
}

// Send to NotebookLM
function sendToNotebookLM(title, content) {
    // This will be implemented with NotebookLM API or web integration
    // For now, showing placeholder message
    console.log('[Meeting] 準備輸出到 NotebookLM:', { title, content });
    
    // TODO: Implement NotebookLM integration
    // You'll need to:
    // 1. Set up NotebookLM credentials
    // 2. Create notebook and upload content
    // 3. Handle synchronization
    
    showStatus('NotebookLM 整合開發中，敬請期待 📚', 'success');
}

// Show Status Message
function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    
    // Auto-hide success and error messages after 5 seconds
    if (type !== 'pending') {
        setTimeout(() => {
            statusEl.className = 'status';
        }, 5000);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Meeting] DOMContentLoaded 觸發');
    
    // 初始化語音識別
    initSpeechRecognition();
    
    // 綁定 recordBtn 事件
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
        console.log('[Meeting] 找到 recordBtn 按鈕');
        recordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] recordBtn 被點擊');
            toggleRecording();
        });
    } else {
        console.error('[Meeting] 未找到 recordBtn 按鈕');
    }
    
    // 綁定音檔導入按鈕事件
    const audioImportBtn = document.getElementById('audioImportBtn');
    const audioFileInput = document.getElementById('audioFile');
    if (audioImportBtn && audioFileInput) {
        console.log('[Meeting] 找到 audioImportBtn 按鈕和 audioFile 輸入框');
        audioImportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] audioImportBtn 被點擊，觸發文件選擇框');
            audioFileInput.click();
        });
    } else {
        console.error('[Meeting] 未找到 audioImportBtn 或 audioFile', {
            audioImportBtn: !!audioImportBtn,
            audioFileInput: !!audioFileInput
        });
    }
    
    // 綁定 "+" 按鈕事件
    const addPromptBtn = document.getElementById('addPromptBtnId');
    if (addPromptBtn) {
        console.log('[Meeting] 找到 add-prompt-btn 按鈕');
        addPromptBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] add-prompt-btn 被點擊');
            addPromptCard();
        });
    } else {
        console.error('[Meeting] 未找到 add-prompt-btn 按鈕');
    }
    
    // 綁定「生成會議記錄」按鈕
    const generateBtn = document.getElementById('generateBtnId');
    if (generateBtn) {
        console.log('[Meeting] 找到 generateBtn 按鈕');
        generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] generateBtn 被點擊');
            generateMeetingNotes();
        });
    } else {
        console.error('[Meeting] 未找到 generateBtn 按鈕');
    }
    
    // 綁定「下載 .md 檔案」按鈕
    const downloadBtn = document.getElementById('downloadBtnId');
    if (downloadBtn) {
        console.log('[Meeting] 找到 downloadBtn 按鈕');
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] downloadBtn 被點擊');
            downloadMarkdown();
        });
    } else {
        console.error('[Meeting] 未找到 downloadBtn 按鈕');
    }
    
    // 綁定「送出」按鈕
    const submitOutputBtn = document.getElementById('submitOutputBtn');
    if (submitOutputBtn) {
        console.log('[Meeting] 找到 submitOutputBtn 按鈕');
        submitOutputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] submitOutputBtn 被點擊');
            submitOutput();
        });
    } else {
        console.error('[Meeting] 未找到 submitOutputBtn 按鈕');
    }
    
    // 為所有卡片綁定事件監聽器（包括預設卡片）
    bindPromptCardEvents();
    
    console.log('[Meeting] 頁面初始化完成');
});
