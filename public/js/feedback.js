/**
 * BRDC Feedback/Debug Button
 * Add this script to any page to enable the floating debug button
 *
 * Usage: <script src="/js/feedback.js"></script>
 */

(function() {
    'use strict';

    const CLOUD_FUNCTIONS_URL = 'https://us-central1-brdc-v2.cloudfunctions.net';
    let screenshotDataUrl = null;

    // Load html2canvas dynamically
    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) {
                resolve(window.html2canvas);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => resolve(window.html2canvas);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Get current page name from URL
    function getPageName() {
        const path = window.location.pathname;
        const pageName = path.split('/').pop() || 'index.html';
        return pageName.replace('.html', '');
    }

    // Create and inject styles
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .brdc-feedback-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, #FF469A 0%, #E03786 100%);
                border: 2px solid rgba(255,255,255,0.3);
                color: white;
                font-size: 20px;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 15px rgba(255, 70, 154, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .brdc-feedback-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(255, 70, 154, 0.6);
            }

            .brdc-feedback-btn:active {
                transform: scale(0.95);
            }

            .brdc-feedback-btn.hidden {
                display: none;
            }

            /* Bottom sticky panel - no overlay */
            .brdc-feedback-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: #16213e;
                border-top: 3px solid #FF469A;
                padding: 15px 20px;
                z-index: 10000;
                transform: translateY(100%);
                transition: transform 0.3s ease;
                box-shadow: 0 -5px 30px rgba(0, 0, 0, 0.5);
            }

            .brdc-feedback-panel.active {
                transform: translateY(0);
            }

            .brdc-feedback-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .brdc-feedback-title {
                font-family: 'Bebas Neue', 'Arial Black', sans-serif;
                font-size: 18px;
                color: #FF469A;
                letter-spacing: 2px;
            }

            .brdc-feedback-page {
                font-size: 12px;
                color: #91D7EB;
                opacity: 0.8;
            }

            .brdc-feedback-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                font-size: 28px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }

            .brdc-feedback-close:hover {
                color: white;
            }

            .brdc-feedback-body {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .brdc-feedback-textarea {
                width: 100%;
                min-height: 60px;
                max-height: 120px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                padding: 10px 12px;
                color: white;
                font-size: 14px;
                font-family: inherit;
                resize: none;
            }

            .brdc-feedback-textarea::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }

            .brdc-feedback-textarea:focus {
                outline: none;
                border-color: #FF469A;
            }

            .brdc-feedback-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .brdc-feedback-screenshot-btn {
                padding: 12px 20px;
                background: rgba(145, 215, 235, 0.2);
                color: #91D7EB;
                border: 2px solid #91D7EB;
                border-radius: 8px;
                font-family: 'Bebas Neue', 'Arial Black', sans-serif;
                font-size: 16px;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .brdc-feedback-screenshot-btn:hover {
                background: rgba(145, 215, 235, 0.3);
            }

            .brdc-feedback-screenshot-btn:disabled {
                background: #666;
                border-color: #666;
                color: #999;
                cursor: not-allowed;
            }

            .brdc-feedback-submit {
                flex: 1;
                padding: 12px 20px;
                background: #FF469A;
                color: white;
                border: none;
                border-radius: 8px;
                font-family: 'Bebas Neue', 'Arial Black', sans-serif;
                font-size: 16px;
                letter-spacing: 1px;
                cursor: pointer;
                transition: background 0.2s;
                white-space: nowrap;
            }

            .brdc-feedback-submit:hover {
                background: #E03786;
            }

            .brdc-feedback-submit:disabled {
                background: #666;
                cursor: not-allowed;
            }

            .brdc-feedback-screenshot-preview {
                margin-top: 10px;
                max-width: 200px;
                border: 2px solid rgba(145, 215, 235, 0.5);
                border-radius: 8px;
                cursor: pointer;
                position: relative;
            }

            .brdc-feedback-screenshot-preview img {
                width: 100%;
                display: block;
                border-radius: 6px;
            }

            .brdc-feedback-screenshot-remove {
                position: absolute;
                top: -8px;
                right: -8px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #E03786;
                color: white;
                border: 2px solid #16213e;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                line-height: 1;
            }

            .brdc-feedback-status {
                font-size: 12px;
                margin-top: 8px;
                color: rgba(255, 255, 255, 0.7);
            }

            .brdc-feedback-status.success {
                color: #4CAF50;
            }

            .brdc-feedback-status.error {
                color: #E03786;
            }

            @media (max-width: 600px) {
                .brdc-feedback-actions {
                    flex-direction: column;
                }
                .brdc-feedback-submit {
                    width: 100%;
                }
                .brdc-feedback-screenshot-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Create feedback button and panel
    function createFeedbackUI() {
        // Create floating button
        const btn = document.createElement('button');
        btn.className = 'brdc-feedback-btn';
        btn.id = 'brdcFeedbackBtn';
        btn.innerHTML = '🐛';
        btn.title = 'Report an issue or give feedback';
        btn.onclick = togglePanel;

        // Create bottom panel (no overlay)
        const panel = document.createElement('div');
        panel.className = 'brdc-feedback-panel';
        panel.id = 'brdcFeedbackPanel';
        panel.innerHTML = `
            <div class="brdc-feedback-header">
                <div>
                    <div class="brdc-feedback-title">FEEDBACK</div>
                    <div class="brdc-feedback-page">${getPageName()}</div>
                </div>
                <button class="brdc-feedback-close" onclick="window.brdcCloseFeedback()" aria-label="Close feedback">&times;</button>
            </div>
            <div class="brdc-feedback-body">
                <textarea
                    class="brdc-feedback-textarea"
                    id="brdcFeedbackText"
                    placeholder="What's the issue or suggestion?"
                ></textarea>
                <div class="brdc-feedback-actions">
                    <button class="brdc-feedback-screenshot-btn" onclick="window.brdcCaptureScreenshot()">
                        📸 SCREENSHOT
                    </button>
                    <button class="brdc-feedback-submit" onclick="window.brdcSubmitFeedback()">
                        SEND
                    </button>
                </div>
                <div id="brdcScreenshotPreview"></div>
            </div>
            <div class="brdc-feedback-status" id="brdcFeedbackStatus"></div>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(panel);

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && panel.classList.contains('active')) {
                closePanel();
            }
        });
    }

    // Toggle panel
    function togglePanel() {
        const panel = document.getElementById('brdcFeedbackPanel');
        const btn = document.getElementById('brdcFeedbackBtn');

        if (panel.classList.contains('active')) {
            closePanel();
        } else {
            panel.classList.add('active');
            btn.classList.add('hidden');
            document.getElementById('brdcFeedbackText').focus();
        }
    }

    // Close panel
    function closePanel() {
        const panel = document.getElementById('brdcFeedbackPanel');
        const btn = document.getElementById('brdcFeedbackBtn');

        panel.classList.remove('active');
        btn.classList.remove('hidden');
        document.getElementById('brdcFeedbackText').value = '';
        document.getElementById('brdcFeedbackStatus').textContent = '';
        removeScreenshot();
    }

    // Capture screenshot
    async function captureScreenshot() {
        const status = document.getElementById('brdcFeedbackStatus');
        const screenshotBtn = document.querySelector('.brdc-feedback-screenshot-btn');

        try {
            screenshotBtn.disabled = true;
            screenshotBtn.textContent = '📸 CAPTURING...';
            status.textContent = 'Capturing screenshot...';
            status.className = 'brdc-feedback-status';

            // Close the panel temporarily for a clean screenshot
            const panel = document.getElementById('brdcFeedbackPanel');
            panel.style.display = 'none';

            // Wait a moment for UI to update
            await new Promise(resolve => setTimeout(resolve, 100));

            // Load html2canvas
            const html2canvas = await loadHtml2Canvas();

            // Capture the page
            const canvas = await html2canvas(document.body, {
                allowTaint: true,
                useCORS: true,
                scrollY: -window.scrollY,
                scrollX: -window.scrollX,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight
            });

            // Convert to data URL
            screenshotDataUrl = canvas.toDataURL('image/png');

            // Show preview
            showScreenshotPreview(screenshotDataUrl);

            status.textContent = 'Screenshot captured!';
            status.className = 'brdc-feedback-status success';

        } catch (error) {
            console.error('Screenshot error:', error);
            status.textContent = 'Screenshot failed. Try again.';
            status.className = 'brdc-feedback-status error';
            screenshotDataUrl = null;
        } finally {
            // Restore panel
            const panel = document.getElementById('brdcFeedbackPanel');
            panel.style.display = 'block';

            screenshotBtn.disabled = false;
            screenshotBtn.textContent = '📸 SCREENSHOT';

            // Clear status after a moment
            setTimeout(() => {
                if (status.textContent.includes('captured') || status.textContent.includes('failed')) {
                    status.textContent = '';
                }
            }, 2000);
        }
    }

    // Show screenshot preview
    function showScreenshotPreview(dataUrl) {
        const previewContainer = document.getElementById('brdcScreenshotPreview');
        previewContainer.innerHTML = `
            <div class="brdc-feedback-screenshot-preview">
                <img src="${dataUrl}" alt="Screenshot preview">
                <button class="brdc-feedback-screenshot-remove" onclick="window.brdcRemoveScreenshot()">
                    ×
                </button>
            </div>
        `;
    }

    // Remove screenshot
    function removeScreenshot() {
        screenshotDataUrl = null;
        const previewContainer = document.getElementById('brdcScreenshotPreview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
        }
    }

    // Submit feedback
    async function submitFeedback() {
        const textarea = document.getElementById('brdcFeedbackText');
        const status = document.getElementById('brdcFeedbackStatus');
        const submitBtn = document.querySelector('.brdc-feedback-submit');

        const message = textarea.value.trim();
        if (!message) {
            status.textContent = 'Please enter a message';
            status.className = 'brdc-feedback-status error';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '...';
        status.textContent = '';

        try {
            const payload = {
                page: getPageName(),
                message: message,
                url: window.location.href,
                user_agent: navigator.userAgent,
                screen_size: `${window.innerWidth}x${window.innerHeight}`,
                player_id: localStorage.getItem('playerId') || null,
                screenshot: screenshotDataUrl || null
            };

            status.textContent = screenshotDataUrl ? 'Uploading screenshot...' : 'Sending...';

            const response = await fetch(`${CLOUD_FUNCTIONS_URL}/submitFeedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                status.textContent = 'Sent!';
                status.className = 'brdc-feedback-status success';
                textarea.value = '';

                // Auto close after 1.5 seconds
                setTimeout(() => {
                    closePanel();
                }, 1500);
            } else {
                throw new Error(result.error || 'Failed to submit');
            }
        } catch (error) {
            console.error('Feedback error:', error);
            status.textContent = 'Failed. Try again.';
            status.className = 'brdc-feedback-status error';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'SEND';
        }
    }

    // Expose functions globally
    window.brdcOpenFeedback = togglePanel;
    window.brdcCloseFeedback = closePanel;
    window.brdcSubmitFeedback = submitFeedback;
    window.brdcCaptureScreenshot = captureScreenshot;
    window.brdcRemoveScreenshot = removeScreenshot;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            injectStyles();
            createFeedbackUI();
        });
    } else {
        injectStyles();
        createFeedbackUI();
    }
})();
