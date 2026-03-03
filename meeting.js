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
        document.getElementById('recordBtn').textContent = '🎙️ 停止錄音';
        document.getElementById('recordBtn').classList.add('recording');
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                recordedTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        document.getElementById('textboxA').value = recordedTranscript + interimTranscript;
    };
    
    recognition.onerror = (event) => {
        showStatus(`語音識別錯誤: ${event.error}`, 'error');
    };
    
    recognition.onend = () => {
        isRecording = false;
        document.getElementById('recordBtn').textContent = '🎙️ 開始錄音';
        document.getElementById('recordBtn').classList.remove('recording');
    };
    
    return true;
}

// Toggle Recording
function toggleRecording() {
    if (!recognition) {
        initSpeechRecognition();
    }
    
    if (isRecording) {
        recognition.stop();
        recordedTranscript = document.getElementById('textboxA').value;
    } else {
        recordedTranscript = document.getElementById('textboxA').value;
        recognition.start();
    }
}

// Handle Audio File Import
async function handleAudioImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/mp4a-latm'];
    if (!validTypes.includes(file.type)) {
        showStatus('不支援的文件格式，請使用 .mp3 或 .m4a 格式', 'error');
        return;
    }
    
    showStatus('正在處理音檔...', 'pending');
    
    try {
        // Read file as data URL
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            const audioDataUrl = e.target.result;
            
            // Here you would typically send to a backend service for transcription
            // For now, we'll use a placeholder message
            await processAudioTranscription(audioDataUrl, file.name);
        };
        fileReader.readAsDataURL(file);
    } catch (error) {
        showStatus(`音檔處理失敗: ${error.message}`, 'error');
    }
    
    // Clear file input
    event.target.value = '';
}

// Process Audio Transcription (Placeholder for backend integration)
async function processAudioTranscription(audioDataUrl, fileName) {
    // This is a placeholder function
    // In production, you would send the audio to a backend service
    // that uses a speech-to-text API (Google Cloud Speech-to-Text, Azure, AssemblyAI, etc.)
    
    try {
        // Placeholder: Simulate processing
        const currentText = document.getElementById('textboxA').value;
        document.getElementById('textboxA').value = currentText + 
            `\n\n[來自 ${fileName} 的轉錄]\n（需要配置後端音檔轉錄服務）`;
        
        showStatus('音檔已導入，請配置轉錄服務以完整轉錄內容', 'pending');
    } catch (error) {
        showStatus(`轉錄失敗: ${error.message}`, 'error');
    }
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
    card.onclick = function() { selectPromptCard(this); };
    
    // 創建文字容器
    const textSpan = document.createElement('span');
    textSpan.textContent = promptText;
    textSpan.style.flex = '1';
    textSpan.style.paddingRight = '25px';
    textSpan.style.wordWrap = 'break-word';
    textSpan.style.wordBreak = 'break-word';
    textSpan.style.whiteSpace = 'normal';
    textSpan.style.overflow = 'visible';
    card.appendChild(textSpan);
    
    // 創建關閉按鈕
    const closeBtn = document.createElement('button');
    closeBtn.className = 'prompt-card-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = function(event) { deletePromptCard(event); };
    card.appendChild(closeBtn);
    
    container.appendChild(card);
    textboxB.value = '';
    
    console.log('[Meeting] 新卡片已新增，當前卡片數量:', container.querySelectorAll('.prompt-card').length);
    showStatus('提示語已新增', 'success');
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
    
    if (!textboxA.value.trim()) {
        showStatus('請先輸入或錄製會議內容', 'error');
        return;
    }
    
    if (!textboxB.value.trim()) {
        showStatus('請選擇或輸入提示語', 'error');
        return;
    }
    
    // Disable button and show loading status
    const generateBtn = document.getElementById('generateBtn');
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

請根據上述會議內容和指示生成結構化的會議記錄。
`;
        
        // Call AI model API (requires backend integration)
        const result = await callAIModel(combinedPrompt);
        
        textboxC.value = result;
        showStatus('會議記錄生成成功！', 'success');
    } catch (error) {
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
    
    console.log('[Meeting] 頁面初始化完成');
});
