// ask_gemini.js - ??SidePanel ä¸­åŸ·è¡Œç??€??
// å¿«é€Ÿå??‡å??¼é€åˆ° Google Gemini

export async function ask_gemini(args) {
    console.log("[Ask Gemini Skill] ?Ÿå?ï¼Œæ¥?¶åˆ°?ƒæ•¸:", args);

    try {
        let text = args.text;
        
        if (!text) {
            throw new Error("?ªæ?ä¾›æŸ¥è©¢æ?å­?);
        }

        // 1. ?‹å? Gemini ?†é?
        const tab = await chrome.tabs.create({ 
            url: 'https://gemini.google.com/' 
        });
        console.log("[Ask Gemini Skill] å·²é???Gemini ?†é?ï¼ŒID:", tab.id);

        // 2. ç­‰å??é¢? è?ï¼ˆé?è©¦æ??¶ï??€å¤šç?å¾?8 ç§’ï?
        await waitForPageLoad(tab.id);

        // 3. ??Gemini ?†é?ä¸­æ³¨?¥è…³?¬ï??ªå?è²¼ä??‡å?ä¸¦ç™¼??
        console.log("[Ask Gemini Skill] æ­?œ¨æ³¨å…¥?ªå?è²¼ä??³æœ¬");
        try {
            const scriptResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: pasteAndSubmit,
                args: [text]
            });
            
            // è©³ç´°è¼¸å‡ºçµæ?
            if (scriptResults && scriptResults.length > 0) {
                const result = scriptResults[0].result;
                console.log("[Ask Gemini Skill] ?³æœ¬?·è?çµæ?:", result);
                
                if (result && result.logs) {
                    console.log("[Ask Gemini Skill] è©³ç´°?¥è?:");
                    result.logs.forEach(log => {
                        console.log("[Ask Gemini Skill]   " + log);
                    });
                }
                
                if (result && result.error) {
                    console.warn("[Ask Gemini Skill] ?·è??‚ç™¼?ŸéŒ¯èª? " + result.error);
                }
            }
        } catch (error) {
            console.warn("[Ask Gemini Skill] executeScript å¤±æ?:", error);
        }

        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        return `??å·²é???Gemini ?†é?\n\n?? å¾…æŸ¥è©¢å…§å®¹ï?\n${preview}`;
        
    } catch (error) {
        console.error("[Ask Gemini Skill] ?¯èª¤:", error);
        throw new Error(`Ask Gemini å¤±æ?ï¼?{error.message}`);
    }
}

/**
 * ç­‰å? Gemini ?é¢? è?å®Œæ?
 * ?—è©¦å¤šæ¬¡æª¢æŸ¥?Šå¤©æ¡†æ˜¯?¦å‡º??
 */
async function waitForPageLoad(tabId, maxAttempts = 20, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // ?—è©¦æª¢æŸ¥?é¢ä¸­æ˜¯?¦å??¨è?å¤©è¼¸?¥æ???input-area å®¹å™¨
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    // æª¢æŸ¥ input-area å®¹å™¨?¯å¦å­˜åœ¨ï¼ˆé€™æ˜¯?œéµï¼?
                    const hasInputArea = !!(
                        document.querySelector('input-area-v2') ||
                        document.querySelector('[data-node-type="input-area"]')
                    );
                    
                    // ?Œæ?æª¢æŸ¥è¼¸å…¥æ¡?
                    const hasInputElement = !!(
                        document.querySelector('[contenteditable="true"]') ||
                        document.querySelector('[role="textbox"]') ||
                        document.querySelector('textarea')
                    );
                    
                    return hasInputArea && hasInputElement;
                }
            });

            if (results[0]?.result) {
                console.log(`[Ask Gemini Skill] ?é¢? è?å®Œæ?ï¼?{i + 1} æ¬¡å?è©¦ï?`);
                return;
            }
        } catch (error) {
            console.log(`[Ask Gemini Skill] æª¢æŸ¥?é¢? è?... (${i + 1}/${maxAttempts})`);
        }

        // ç­‰å??é?è©?
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.warn("[Ask Gemini Skill] ?¡æ?ç¢ºè??é¢å·²å?è¼‰ï?ä½†ç¹¼çºŒåŸ·è¡?);
}

/**
 * ??Gemini ?é¢ä¸­åŸ·è¡Œï?å°‹æ‰¾?Šå¤©æ¡†ã€è²¼ä¸Šæ?å­—ã€ç™¼??
 * ?™å€‹å‡½?¸æ???Gemini ?é¢??DOM ä¸Šä??‡ä¸­?·è?
 */
function pasteAndSubmit(text) {
    const result = { success: false, logs: [], error: null };
    const startTime = Date.now(); // è¨˜é??‹å??‚é?
    
    function log(msg) {
        const elapsed = Date.now() - startTime;
        log("[+" + elapsed + "ms] " + msg);
    }
    
    try {
        log("=== ?‹å??·è? pasteAndSubmit ===");
        log("?‡å??·åº¦: " + text.length);
        
        // 0.5. é¦–å?æª¢æŸ¥?é¢?´é??€??
        log("?? æª¢æŸ¥?é¢?€??..");
        log("  document.readyState: " + document.readyState);
        log("  body ä¸­ç??ƒç??? " + document.body.children.length);
        
        // æª¢æŸ¥?¯å¦?¾åˆ° input-area å®¹å™¨
        const inputAreaContainer = document.querySelector('input-area-v2, [data-node-type="input-area"]');
        if (inputAreaContainer) {
            log("???¾åˆ° input-area å®¹å™¨");
        } else {
            log("? ï?  ?ªæ‰¾??input-area å®¹å™¨ - ?é¢?¯èƒ½?ªå??¨è???);
        }
        
        // 1. å°‹æ‰¾è¼¸å…¥æ¡?- Gemini ä½¿ç”¨ Quill ç·¨è¼¯??
        log("æ­?œ¨å°‹æ‰¾è¼¸å…¥æ¡?..");
        let inputElement = 
            document.querySelector('[contenteditable="true"]') ||  
            document.querySelector('[role="textbox"]') ||           
            document.querySelector('textarea');

        if (!inputElement) {
            result.error = "?¾ä??°è?å¤©è¼¸?¥æ?";
            log("??" + result.error);
            return result;
        }

        log("???¾åˆ°è¼¸å…¥æ¡? " + inputElement.tagName + " class=" + inputElement.className);

        // 1.5. ç­‰å?è¼¸å…¥æ¡†å??¨å?å§‹å? (Gemini ?¯èƒ½?€è¦æ??“å?å§‹å? UI)
        log("??ç­‰å?è¼¸å…¥æ¡†å??¨å?å§‹å? (2 ç§?...");
        const initDelay = Date.now();
        while (Date.now() - initDelay < 2000) {}
        log("??è¼¸å…¥æ¡†å?å§‹å?å®Œæ?");

        // 2. ?šç„¦ä¸¦è²¼ä¸Šæ?å­?
        inputElement.focus();
        log("??å·?focus ?°è¼¸?¥æ?");

        // å°æ–¼ contenteditable ?ƒç?ï¼Œè¨­ç½®æ??¬å…§å®?
        if (inputElement.contentEditable === 'true') {
            // ?¹æ?1: ?´æ¥è¨­ç½® textContent
            inputElement.textContent = text;
            
            // ?¹æ?2: ä¹Ÿè¨­ç½?innerText
            inputElement.innerText = text;
            
            log("???‡å?å·²è¨­ç½®åˆ° contenteditable");
        } else if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = text;
            log("???‡å?å·²è¨­ç½®åˆ° textarea");
        } else {
            inputElement.textContent = text;
            inputElement.innerText = text;
            log("???‡å?å·²è¨­ç½®åˆ° textbox");
        }

        // 3. è§¸ç™¼?€?‰å¯?½ç?äº‹ä»¶ï¼Œè? Angular ??Quill æª¢æ¸¬?°è???
        const events = [
            new Event('input', { bubbles: true, cancelable: true }),
            new Event('change', { bubbles: true, cancelable: true }),
            new Event('blur', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keydown', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keypress', { bubbles: true, cancelable: true })
        ];
        
        for (let i = 0; i < 2; i++) {
            events.forEach(evt => {
                inputElement.dispatchEvent(evt);
            });
        }
        
        // æ·»å? Angular ?‹å¥½?„ä?ä»?
        inputElement.dispatchEvent(new Event('ngModelChange', { bubbles: true }));
        
        log("??å·²è§¸?¼å??‹ä?ä»¶ç¢ºä¿?Angular æª¢æ¸¬?°è???);
        
        // æª¢æŸ¥è¼¸å…¥æ¡†æ˜¯?¦ç??„æ??§å®¹
        const contentLength = inputElement.textContent ? inputElement.textContent.trim().length : 0;
        log("?? è¼¸å…¥æ¡†å…§å®¹é•·åº? " + contentLength);
        // 3.5. ç­‰å??é¢å®Œå…¨è¼‰å…¥??UI ?´æ–°
        log("?±ï? ç­‰å??é¢ UI ?´æ–° (3 ç§?...");
        const uiDelay = Date.now();
        while (Date.now() - uiDelay < 3000) {}
        log("???é¢ UI å·²æ›´??);

        // 4. ç«‹å³å°‹æ‰¾ä¸¦é??Šç™¼?æ???
        log("æ­?œ¨å°‹æ‰¾?¼é€æ???..");
        
        // ?¹æ?1ï¼šç›´?¥ç”¨ class ?ç¨±?¥æ‰¾ï¼ˆæ??¯é?ï¼?
        sendButton = document.querySelector('button.send-button');
        if (sendButton) {
            log("????'button.send-button' ?¾åˆ°?¼é€æ???);
        }
        
        // ?¹æ?2ï¼šå??œæ–¹æ³?å¤±æ?ï¼Œå??¾æ??‰æ??•ä¸¦æª¢æŸ¥?¹å¾µ
        if (!sendButton) {
            const allButtons = document.querySelectorAll('button');
            log("?? ?‹å??œå?ï¼Œé??¢æ? " + allButtons.length + " ??button");
            
            for (let btn of allButtons) {
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const dataTestId = btn.getAttribute('data-testid') || '';
                const className = btn.className || '';
                const innerHTML = btn.innerHTML || '';
                
                // æª¢æŸ¥ className ?¯å¦?…å« send-button
                if (className.includes('send-button')) {
                    sendButton = btn;
                    log("????className ?¾åˆ°?¼é€æ???);
                    log("   className: " + className);
                    break;
                }
                
                // æª¢æŸ¥?¯å¦?…å« send-button-icon ?–æ?
                if (innerHTML.includes('send-button-icon')) {
                    sendButton = btn;
                    log("????send-button-icon ?¾åˆ°?¼é€æ???);
                    log("   className: " + className);
                    break;
                }
                
                // æª¢æŸ¥ aria-label ??data-testid
                if (ariaLabel.toLowerCase().includes('send') ||
                    dataTestId.toLowerCase().includes('send')) {
                    sendButton = btn;
                    log("????aria-label/data-testid ?¾åˆ°?¼é€æ???);
                    log("   aria-label: " + ariaLabel);
                    log("   data-testid: " + dataTestId);
                    break;
                }
            }
        }
        
        // å¦‚æ??„æ˜¯æ²’æ‰¾?°ï??—å‡º?€??buttons ä»¥ä?èª¿è©¦
        if (!sendButton) {
            log("???ªæ‰¾?°ç™¼?æ??•ï??—å‡º?€??buttons ?„è©³ç´°è?è¨?");
            const allButtons = document.querySelectorAll('button');
            allButtons.forEach((btn, idx) => {
                const label = btn.getAttribute('aria-label') || '(??';
                const testId = btn.getAttribute('data-testid') || '(??';
                const classes = btn.className || '(??';
                const isDisabled = btn.disabled ? '?”´ DISABLED' : '?Ÿ¢ ENABLED';
                log("  [" + idx + "] " + isDisabled);
                log("        classes=" + classes);
                log("        aria-label=" + label + " | data-testid=" + testId);
            });
        }
        
        if (sendButton) {
            try {
                log("?? ?‰é??€?? disabled=" + sendButton.disabled + ", aria-disabled=" + sendButton.getAttribute('aria-disabled'));
                
                // ?¯ä??‰æ??„æ–¹æ³•ï?ç°¡å–®??click()
                sendButton.click();
                log("??å·²é??Šç™¼?æ???);
                
            } catch (e) {
                log("??é»æ??¼é€æ??•å¤±?? " + e);
                throw new Error("?¡æ?é»æ??¼é€æ??? " + e.message);
            }
        } else {
            // è©³ç´°?„èª¿è©¦ä¿¡??
            log("???¾ä??°ç™¼?æ???);
            
            // ?—å‡º?é¢?€??button
            const allButtons = document.querySelectorAll('button');
            log("?? ?é¢ä¸­å…±??" + allButtons.length + " ??buttonï¼?);
            allButtons.forEach((btn, idx) => {
                const label = btn.getAttribute('aria-label') || btn.textContent?.substring(0, 30) || '(?¡æ?ç±?';
                log("  [" + idx + "] " + btn.className + " - " + label);
            });
            
            // ?—å‡º?€??mat-icon
            const allIcons = document.querySelectorAll('mat-icon');
            log("?? ?é¢ä¸­å…±??" + allIcons.length + " ??mat-icon");
            if (allIcons.length > 0) {
                allIcons.forEach((icon, idx) => {
                    const name = icon.getAttribute('data-mat-icon-name') || icon.textContent?.substring(0, 30) || '(?¡å?ç¨?';
                    log("  [" + idx + "] data-mat-icon-name=" + name);
                });
            }
            
            throw new Error("?¡æ??¾åˆ° Gemini ?¼é€æ??•ï?è©³è?ä¸Šæ–¹?¥è??‚é??¢å¯?½æœªå®Œå…¨è¼‰å…¥??UI çµæ?å·²æ”¹è®?);
        }

        result.success = true;
        log("??æµç?å·²å???);
        return result;

    } catch (error) {
        result.error = error.toString();
        log("???°å¸¸: " + error);
        return result;
    }
}
