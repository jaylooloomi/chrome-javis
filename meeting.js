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
    
    // 獲取音檔導入按鈕並添加加載狀態
    const audioImportBtn = document.getElementById('audioImportBtn');
    if (audioImportBtn) {
        audioImportBtn.disabled = true;
        audioImportBtn.classList.add('loading');
        console.log('[Audio Import] 添加按鈕加載狀態');
    }
    
    const file = event.target.files[0];
    if (!file) {
        console.warn('[Audio Import] ❌ 未選擇文件');
        if (audioImportBtn) {
            audioImportBtn.disabled = false;
            audioImportBtn.classList.remove('loading');
        }
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
        if (audioImportBtn) {
            audioImportBtn.disabled = false;
            audioImportBtn.classList.remove('loading');
        }
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
        if (audioImportBtn) {
            audioImportBtn.disabled = false;
            audioImportBtn.classList.remove('loading');
        }
        return;
    }
    
    console.log('[Audio Import] ✅ 文件大小驗證通過');
    
    showStatus('⏳ 正在處理音檔...', 'loading');
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
            if (audioImportBtn) {
                audioImportBtn.disabled = false;
                audioImportBtn.classList.remove('loading');
            }
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
        if (audioImportBtn) {
            audioImportBtn.disabled = false;
            audioImportBtn.classList.remove('loading');
        }
    }
    
    // Clear file input
    event.target.value = '';
    console.log('[Audio Import] 🔄 清除文件輸入框');
}

// Process Audio Transcription with Google Generative AI
async function processAudioTranscription(audioArrayBuffer, file, language) {
    const audioImportBtn = document.getElementById('audioImportBtn');
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
                if (audioImportBtn) {
                    audioImportBtn.disabled = false;
                    audioImportBtn.classList.remove('loading');
                }
                return;
            }
            
            if (!response) {
                console.error('[Audio Transcription] ❌ 收到空回應');
                showStatus('無回應，請檢查 API 配置', 'error');
                if (audioImportBtn) {
                    audioImportBtn.disabled = false;
                    audioImportBtn.classList.remove('loading');
                }
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
                if (audioImportBtn) {
                    audioImportBtn.disabled = false;
                    audioImportBtn.classList.remove('loading');
                }
                hideStatus();
                setTimeout(() => {
                    showStatus(`✅ 音檔已成功轉錄: ${file.name}`, 'success');
                }, 300);
            } else {
                console.error('[Audio Transcription] ❌ 轉錄失敗:', {
                    error: response.error,
                    errorMessage: response.errorMessage
                });
                if (audioImportBtn) {
                    audioImportBtn.disabled = false;
                    audioImportBtn.classList.remove('loading');
                }
                hideStatus();
                setTimeout(() => {
                    showStatus(`轉錄失敗: ${response.error}`, 'error');
                }, 300);
            }
            
            console.log('[Audio Transcription] ========== 轉錄流程完成 ==========');
        });
        
        showStatus('⏳ 正在使用 Google Gemini 進行轉錄...', 'loading');
        
    } catch (error) {
        console.error('[Audio Transcription] ❌ 轉錄異常:', {
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack
        });
        if (audioImportBtn) {
            audioImportBtn.disabled = false;
            audioImportBtn.classList.remove('loading');
        }
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
    console.log('[Meeting] textboxA 長度:', textboxA?.value?.length);
    console.log('[Meeting] textboxB 長度:', textboxB?.value?.length);
    
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
    generateBtn.classList.add('loading');
    generateBtn.textContent = '⏳ 正在生成中...';
    
    showStatus('⏳ 正在使用 AI 生成會議記錄...', 'loading');
    
    try {
        // Prepare the combined prompt
        const combinedPrompt = `會議內容:\n${textboxA.value}\n\n處理指示:\n${textboxB.value}\n\n請根據上述會議內容和指示生成結構化的會議記錄。`;
        
        console.log('[Meeting] 準備發送 Service Worker 請求');
        console.log('[Meeting] 組合 Prompt 長度:', combinedPrompt.length);
        console.log('[Meeting] textboxA 內容長度:', textboxA.value.length);
        console.log('[Meeting] textboxB 內容長度:', textboxB.value.length);
        
        // Send to Service Worker for API processing
        chrome.runtime.sendMessage({
            action: 'generateMeetingNotes',
            prompt: combinedPrompt,
            textboxA: textboxA.value,
            textboxB: textboxB.value
        }, (response) => {
            console.log('[Meeting] 收到 Service Worker 回應:', response);
            
            if (chrome.runtime.lastError) {
                console.error('[Meeting] Service Worker 錯誤:', chrome.runtime.lastError);
                showStatus(`遠程錯誤: ${chrome.runtime.lastError.message}`, 'error');
                generateBtn.disabled = false;
                generateBtn.classList.remove('loading');
                generateBtn.textContent = originalText;
                return;
            }
            
            if (!response) {
                console.error('[Meeting] 收到空回應');
                showStatus('無回應，請檢查 API 配置', 'error');
                generateBtn.disabled = false;
                generateBtn.classList.remove('loading');
                generateBtn.textContent = originalText;
                return;
            }
            
            if (response.success) {
                console.log('[Meeting] 生成成功，內容長度:', response.result?.length || 0);
                console.log('[Meeting] 生成內容前 100 字:', response.result?.substring(0, 100) || '');
                
                // Output to textboxC
                console.log('[Meeting] 更新 textboxC...');
                textboxC.value = response.result;
                textboxC.scrollTop = 0;  // Scroll to top
                
                console.log('[Meeting] textboxC 已更新，內容長度:', textboxC.value.length);
                hideStatus();
                setTimeout(() => {
                    showStatus('✅ 會議記錄生成成功！', 'success');
                }, 300);
            } else {
                console.error('[Meeting] 生成失敗:', response.error);
                hideStatus();
                setTimeout(() => {
                    showStatus(`生成失敗: ${response.error}`, 'error');
                }, 300);
                textboxC.value = '生成失敗，請檢查配置並重試。';
            }
            
            generateBtn.disabled = false;
            generateBtn.classList.remove('loading');
            generateBtn.textContent = originalText;
            console.log('[Meeting] ========== 會議記錄生成流程完成 ==========');
        });
        
    } catch (error) {
        console.error('[Meeting] 生成異常:', error);
        showStatus(`生成失敗: ${error.message}`, 'error');
        textboxC.value = '生成失敗，請檢查配置並重試。';
        generateBtn.disabled = false;
        generateBtn.classList.remove('loading');
        generateBtn.textContent = originalText;
    }
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
function showStatus(message, type = 'info', elementId = 'statusMessage') {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) {
        console.error(`[Meeting] 找不到狀態元素: ${elementId}`);
        alert(message); // Fallback to alert if element not found
        return;
    }
    
    statusEl.textContent = message;
    
    // Handle different CSS class names for different sections
    if (elementId === 'apiStatusMessage') {
        // API Config section uses 'status-message' class
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
    } else {
        // Meeting section uses 'status' class
        statusEl.className = `status ${type}`;
    }
    
    console.log(`[Meeting] 狀態消息已更新 (${elementId}): ${message}，類別: ${statusEl.className}`);
    
    // Auto-hide after 5 seconds for success/warning/error if it's API config
    if (elementId === 'apiStatusMessage' && (type === 'success' || type === 'warning' || type === 'error')) {
        setTimeout(() => {
            statusEl.className = 'status-message';
            statusEl.style.display = 'none';
            console.log(`[Meeting] API 狀態消息已自動隱藏`);
        }, 5000);
    }
    // Auto-hide for meeting section (but not loading/pending)
    else if (elementId === 'statusMessage' && type !== 'pending' && type !== 'loading') {
        setTimeout(() => {
            statusEl.className = 'status';
        }, 5000);
    }
}

function hideStatus() {
    const statusEl = document.getElementById('statusMessage');
    statusEl.className = 'status';
    statusEl.textContent = '';
}

// Update i18n titles for disabled elements
function updateI18nTitles() {
    // Get current language from chrome storage or use default
    chrome.storage.local.get(['language'], (result) => {
        const currentLang = result.language || navigator.language || 'zh-TW';
        
        // Get all elements with data-i18n-title attribute
        const elementsWithI18nTitle = document.querySelectorAll('[data-i18n-title]');
        
        elementsWithI18nTitle.forEach((element) => {
            const i18nKey = element.getAttribute('data-i18n-title');
            
            // Try to load from i18n if available
            if (typeof window.i18n !== 'undefined' && window.i18n.t) {
                const translation = window.i18n.t(i18nKey, currentLang);
                if (translation && translation !== i18nKey) {
                    element.setAttribute('title', translation);
                    console.log(`[i18n] 已更新 title: ${i18nKey} -> ${translation}`);
                }
            } else {
                // Fallback translations if i18n not loaded
                const fallbackTranslations = {
                    'output.comingSoon': {
                        'zh-TW': '🚧 功能尚未開放',
                        'zh-CN': '🚧 功能尚未开放',
                        'en-US': '🚧 Feature not yet available',
                        'en-GB': '🚧 Feature not yet available',
                        'ja-JP': '🚧 機能は事不済みです',
                        'ko-KR': '🚧 기능이 아직 제공되지 않습니다',
                        'fr-FR': '🚧 Fonction pas encore disponible',
                        'de-DE': '🚧 Funktion noch nicht verfügbar'
                    }
                };
                
                if (fallbackTranslations[i18nKey] && fallbackTranslations[i18nKey][currentLang]) {
                    const translation = fallbackTranslations[i18nKey][currentLang];
                    element.setAttribute('title', translation);
                    console.log(`[i18n] 已使用 fallback 更新 title: ${i18nKey} -> ${translation}`);
                }
            }
        });
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Meeting] DOMContentLoaded 觸發');
    
    // 🔑 API 配置容器展開/收縮功能
    const apiConfigCollapseBtn = document.getElementById('apiConfigCollapseBtn');
    const apiConfigContent = document.getElementById('apiConfigContent');
    
    if (apiConfigCollapseBtn && apiConfigContent) {
        console.log('[Meeting] 找到 API 配置容器的展開/收縮按鈕');
        
        apiConfigCollapseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] 用戶點擊 API 配置展開/收縮按鈕');
            
            // 切換展開/收縮狀態
            apiConfigContent.classList.toggle('collapsed');
            apiConfigCollapseBtn.classList.toggle('collapsed');
            
            // 記錄狀態到 localStorage
            const isCollapsed = apiConfigContent.classList.contains('collapsed');
            localStorage.setItem('apiConfigCollapsed', isCollapsed ? 'true' : 'false');
            console.log('[Meeting] API 配置容器已' + (isCollapsed ? '收縮' : '展開'));
        });
        
        // 默認為收縮狀態（HTML 中已經設置了 collapsed 類）
        // 從 localStorage 恢復之前的狀態（如果用戶之前展開過的話）
        const wasExpanded = localStorage.getItem('apiConfigCollapsed') === 'false';
        if (wasExpanded) {
            apiConfigContent.classList.remove('collapsed');
            apiConfigCollapseBtn.classList.remove('collapsed');
            console.log('[Meeting] 恢復之前的 API 配置容器展開狀態');
        } else {
            console.log('[Meeting] API 配置容器默認為收縮狀態');
        }
    } else {
        console.error('[Meeting] 未找到 API 配置容器的展開/收縮相關元素', {
            btn: !!apiConfigCollapseBtn,
            content: !!apiConfigContent
        });
    }
    
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
        
        // 綁定文件輸入 change 事件（CSP 合規）
        audioFileInput.addEventListener('change', (e) => {
            console.log('[Meeting] audioFile change 事件觸發');
            handleAudioImport(e);
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
    
    // 綁定 Google API 配置按鈕事件監聽器
    const getApiKeyBtn = document.getElementById('getApiKeyBtn');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const openConsoleBtn = document.getElementById('openConsoleBtn');
    
    console.log('[Meeting] Google API 按鈕檢查:');
    console.log('  - getApiKeyBtn:', !!getApiKeyBtn);
    console.log('  - saveConfigBtn:', !!saveConfigBtn);
    console.log('  - testConnectionBtn:', !!testConnectionBtn);
    console.log('  - openConsoleBtn:', !!openConsoleBtn);
    
    if (getApiKeyBtn) {
        getApiKeyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] 用戶點擊獲取 API Key 按鈕');
            openGoogleApiUrl();
        });
    }
    
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] 用戶點擊保存配置按鈕');
            saveGoogleApiConfig();
        });
    }
    
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] 用戶點擊連接測試按鈕');
            testGoogleApiConnection();
        });
    }
    
    if (openConsoleBtn) {
        openConsoleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Meeting] 用戶點擊打開 Google Console 按鈕');
            openGoogleConsole();
        });
    }
    
    // 加載保存的 API 配置
    loadSavedApiConfig();
    
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
    
    // 初始化 i18n titles
    updateI18nTitles();
    
    console.log('[Meeting] 頁面初始化完成');
});

// ==================== Google API 配置函數 ====================

// Load saved API configuration from Chrome storage
function loadSavedApiConfig() {
    console.log('[Meeting] loadSavedApiConfig 被調用');
    
    chrome.storage.local.get(['googleApiKey'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[Meeting] Chrome storage 錯誤:', chrome.runtime.lastError);
            showStatus('無法訪問本機存儲', 'error', 'apiStatusMessage');
            return;
        }
        
        if (result.googleApiKey) {
            const apiKeyInput = document.getElementById('googleApiKey');
            if (apiKeyInput) {
                apiKeyInput.value = result.googleApiKey;
                updateGoogleStatus(true);
                console.log('[Meeting] ✅ 已加載保存的 Google API Key');
            }
        } else {
            updateGoogleStatus(false);
            console.log('[Meeting] ⚠️ 未找到保存的 Google API Key');
        }
    });
}

// Update Google API status display
function updateGoogleStatus(isConfigured) {
    console.log('[Meeting] updateGoogleStatus 被調用，已配置:', isConfigured);
    
    const statusEl = document.getElementById('googleStatus');
    const statusTextEl = document.getElementById('statusText');
    
    if (!statusEl || !statusTextEl) {
        console.error('[Meeting] 找不到狀態顯示元素', {
            statusEl: !!statusEl,
            statusTextEl: !!statusTextEl
        });
        return;
    }
    
    if (isConfigured) {
        statusEl.classList.remove('disconnected');
        statusEl.classList.add('connected');
        statusTextEl.textContent = '✅ 已配置';
        console.log('[Meeting] Google API 使用狀態: 已配置');
    } else {
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
        statusTextEl.textContent = '❌ 未配置';
        console.log('[Meeting] Google API 使用狀態: 未配置');
    }
}

// Save Google API Key
function saveGoogleApiConfig() {
    console.log('[Meeting] saveGoogleApiConfig 被調用');
    
    const apiKeyInput = document.getElementById('googleApiKey');
    if (!apiKeyInput) {
        console.error('[Meeting] 找不到 googleApiKey 輸入框');
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    console.log('[Meeting] API Key 長度:', apiKey.length);
    
    if (!apiKey) {
        showStatus('請輸入 Google API Key', 'error', 'apiStatusMessage');
        console.warn('[Meeting] API Key 為空');
        return;
    }
    
    // Basic validation: Google API keys are typically 39 characters
    if (apiKey.length < 20) {
        showStatus('⚠️ API Key 看起來太短，請確認輸入正確', 'warning', 'apiStatusMessage');
        console.warn('[Meeting] API Key 長度異常:', apiKey.length);
    }
    
    console.log('[Meeting] 開始保存 API Key...');
    
    // Save to Chrome storage
    chrome.storage.local.set({ googleApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '未知錯誤';
            showStatus(`儲存失敗: ${errorMsg}`, 'error', 'apiStatusMessage');
            console.error('[Meeting] 儲存失敗:', chrome.runtime.lastError);
        } else {
            updateGoogleStatus(true);
            showStatus('✅ Google API Key 已成功保存', 'success', 'apiStatusMessage');
            console.log('[Meeting] ✅ API Key 已正確保存');
        }
    });
}

// Test Google API connection
async function testGoogleApiConnection() {
    console.log('[Meeting] testGoogleApiConnection 被調用');
    
    const apiKeyInput = document.getElementById('googleApiKey');
    if (!apiKeyInput) {
        console.error('[Meeting] 找不到 googleApiKey 輸入框');
        showStatus('頁面加載錯誤，請刷新重試', 'error', 'apiStatusMessage');
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    console.log('[Meeting] 測試 API Key，長度:', apiKey.length);
    
    if (!apiKey) {
        showStatus('請先輸入並保存 Google API Key', 'error', 'apiStatusMessage');
        console.warn('[Meeting] API Key 為空，無法測試');
        return;
    }
    
    showStatus('🔄 正在測試連接...', 'warning', 'apiStatusMessage');
    console.log('[Meeting] 開始連接測試...');
    
    try {
        // Try a simple API call to test the key
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        
        console.log('[Meeting] 發送測試請求到 Google API');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: '說 OK'
                    }]
                }]
            })
        });
        
        console.log('[Meeting] 收到響應，狀態碼:', response.status);
        
        if (response.ok) {
            showStatus('✅ 連接成功！Google API Key 可正常使用', 'success', 'apiStatusMessage');
            updateGoogleStatus(true);
            console.log('[Meeting] ✅ API 連接測試成功');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText || '未知錯誤';
            showStatus(`❌ 連接失敗 (${response.status}): ${errorMsg}`, 'error', 'apiStatusMessage');
            console.error('[Meeting] API 連接失敗:', response.status, errorMsg);
        }
    } catch (error) {
        showStatus(`❌ 測試失敗: ${error.message}`, 'error', 'apiStatusMessage');
        console.error('[Meeting] 測試錯誤:', error);
    }
}

// Open Google API console
function openGoogleConsole() {
    console.log('[Meeting] openGoogleConsole 被調用');
    try {
        chrome.tabs.create({ 
            url: 'https://console.cloud.google.com/apis/dashboard' 
        });
    } catch (error) {
        console.error('[Meeting] 打開 Google Console 失敗:', error);
        showStatus(`無法打開 Google Console: ${error.message}`, 'error', 'apiStatusMessage');
    }
}

// Open Google API Key page
function openGoogleApiUrl() {
    console.log('[Meeting] openGoogleApiUrl 被調用');
    try {
        chrome.tabs.create({ 
            url: 'https://aistudio.google.com/app/apikey' 
        });
    } catch (error) {
        console.error('[Meeting] 打開 API Key 頁面失敗:', error);
        showStatus(`無法打開 API Key 頁面: ${error.message}`, 'error', 'apiStatusMessage');
    }
}

console.log('[Meeting] Google API 配置函數已加載');
