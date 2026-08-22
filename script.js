document.addEventListener("DOMContentLoaded", function() {

    // ─── DOM refs ──────────────────────────────────────────────────
    const messagesContainer = document.getElementById("chatMessages");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const photoButton = document.getElementById("photoButton");
    const imageInput = document.getElementById("imageInput");
    const fileButton = document.getElementById("fileButton");
    const fileInput = document.getElementById("fileInput");
    const attachmentPreview = document.getElementById("attachmentPreview");
    const attachmentName = document.getElementById("attachmentName");
    const attachmentSize = document.getElementById("attachmentSize");
    const attachmentIcon = document.getElementById("attachmentIcon");
    const removeAttachment = document.getElementById("removeAttachment");
    const settingsButton = document.getElementById("settingsButton");
    const settingsPanel = document.getElementById("settingsPanel");
    const themeToggle = document.getElementById("themeToggle");
    const enterToggle = document.getElementById("enterToggle");
    const scrollToggle = document.getElementById("scrollToggle");
    const newChatButton = document.getElementById("newChatButton");
    const clearChat = document.getElementById("clearChat");
    const exportChat = document.getElementById("exportChat");
    const resetSettings = document.getElementById("resetSettings");
    const messageCount = document.getElementById("messageCount");

    // ─── Font size elements ──────────────────────────────────────
    const fontSizeSlider = document.getElementById("fontSizeSlider");
    const fontSizeLabel = document.getElementById("fontSizeLabel");

    // ─── State ──────────────────────────────────────────────────
    let selectedImage = null;
    let selectedFile = null;
    let selectedFileData = null;
    let enterToSend = true;
    let autoScroll = true;

    let conversation = [
        { role: "system", content: "You are Jhonny, a helpful AI assistant. Analyze messages, images and files when provided. Use markdown for formatting when appropriate." }
    ];

    // ─── Force enable everything ──────────────────────────────
    function enableAll() {
        sendBtn.disabled = false;
        photoButton.disabled = false;
        fileButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }

    // ─── Apply font size ──────────────────────────────────────
    function applyFontSize(size) {
        document.documentElement.style.setProperty('--message-font-size', size + 'px');
        localStorage.setItem('jhonnyFontSize', size);
        fontSizeLabel.textContent = size + 'px';
        fontSizeSlider.value = size;
    }

    // ─── Load saved font size ─────────────────────────────────
    const savedSize = localStorage.getItem('jhonnyFontSize');
    if (savedSize) {
        applyFontSize(parseInt(savedSize));
    } else {
        applyFontSize(16);
    }

    // ─── Auto scroll toggle ──────────────────────────────────
    if (localStorage.getItem('jhonnyAutoScroll') === 'false') {
        autoScroll = false;
        scrollToggle.classList.remove('active');
    }

    scrollToggle.addEventListener('click', function() {
        autoScroll = !autoScroll;
        scrollToggle.classList.toggle('active', autoScroll);
        localStorage.setItem('jhonnyAutoScroll', autoScroll);
        if (autoScroll) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    // ─── Font size slider event ──────────────────────────────
    fontSizeSlider.addEventListener('input', function() {
        const size = parseInt(this.value);
        applyFontSize(size);
    });

    // ─── Message count ─────────────────────────────────────────
    function updateMessageCount() {
        messageCount.textContent = messagesContainer.querySelectorAll(".message").length;
    }

    // ─── Scroll to bottom ──────────────────────────────────────
    function scrollToBottom() {
        if (autoScroll) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // ─── MARKDOWN RENDERER ────────────────────────────────────
    function renderMarkdown(text) {
        let html = text
            // Escape HTML first
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // Headers (# ## ###)
        html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

        // Bold **text** or __text__
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

        // Italic *text* or _text_
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');

        // Strikethrough ~~text~~
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Links [text](url)
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Blockquotes > text
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

        // Unordered lists - * item or - item
        html = html.replace(/^[\*\-] (.+)$/gm, '<li class="md-li">$1</li>');
        html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>');

        // Ordered lists - 1. item
        html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="md-li">$2</li>');
        html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, (match) => {
            return '<ol class="md-ol">' + match + '</ol>';
        });

        // Inline code `code` (non-block, already escaped)
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Newlines to <br>
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    // ─── Format content (code blocks + markdown) ─────────────
    function formatMessageContent(text) {
        let blocks = [];
        let processed = text.replace(
            /```(\w*)\s*([\s\S]*?)```/g,
            function(match, language, code) {
                code = code.replace(/^\s+|\s+$/g, '');
                const lang = language || 'plaintext';
                const id = blocks.length;
                blocks.push({ lang, code });
                return `%%CODEBLOCK_${id}%%`;
            }
        );

        let html = renderMarkdown(processed);

        blocks.forEach((block, i) => {
            html = html.replace(
                `%%CODEBLOCK_${i}%%`,
                `
                    <div class="code-block">
                        <div class="code-header">
                            <span class="code-language">${block.lang}</span>
                            <button class="code-copy-btn">Copy</button>
                        </div>
                        <pre class="code-pre"><code class="code-code">${block.code}</code></pre>
                    </div>
                `
            );
        });

        return html;
    }

    // ─── Add message ──────────────────────────────────────────
    function addMessage(content, role, image = null, fileName = null) {
        const message = document.createElement("div");
        message.className = "message " + role;

        if (image) {
            const img = document.createElement("img");
            img.src = image;
            img.className = "message-image";
            message.appendChild(img);
        }

        if (fileName) {
            const fileBox = document.createElement("div");
            fileBox.className = "file-box";
            const icon = document.createElement("div");
            icon.className = "file-icon";
            icon.textContent = "📄";
            const name = document.createElement("div");
            name.className = "file-name";
            name.textContent = fileName;
            fileBox.appendChild(icon);
            fileBox.appendChild(name);
            message.appendChild(fileBox);
        }

        if (content) {
            const contentDiv = document.createElement("div");
            contentDiv.className = "message-content";
            contentDiv.innerHTML = formatMessageContent(content);
            message.appendChild(contentDiv);
        }

        if (role === "assistant" && content) {
            const copy = document.createElement("button");
            copy.className = "copy-button";
            copy.textContent = "Copy";
            copy.addEventListener("click", async function() {
                try {
                    await navigator.clipboard.writeText(content);
                    copy.textContent = "Copied!";
                    setTimeout(() => { copy.textContent = "Copy"; }, 1500);
                } catch {
                    alert("Unable to copy.");
                }
            });
            message.appendChild(copy);
        }

        messagesContainer.appendChild(message);
        scrollToBottom();
        updateMessageCount();
    }

    // ─── Code copy (delegation) ──────────────────────────────
    messagesContainer.addEventListener("click", function(e) {
        const btn = e.target.closest(".code-copy-btn");
        if (!btn) return;
        const block = btn.closest(".code-block");
        if (!block) return;
        const codeEl = block.querySelector(".code-code");
        if (!codeEl) return;
        const text = codeEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = "Copy"; }, 2000);
        }).catch(() => alert("Unable to copy."));
    });

    // ─── Typing ────────────────────────────────────────────────
    function addTyping() {
        const typing = document.createElement("div");
        typing.className = "typing-indicator";
        typing.id = "typingIndicator";
        typing.innerHTML = `<span></span><span></span><span></span>`;
        messagesContainer.appendChild(typing);
        scrollToBottom();
    }
    function removeTyping() {
        const typing = document.getElementById("typingIndicator");
        if (typing) typing.remove();
    }

    // ─── Attachment preview ──────────────────────────────────
    function showAttachment(file, isImage) {
        attachmentPreview.style.display = "block";
        attachmentName.textContent = file.name;
        attachmentSize.textContent = formatSize(file.size);
        if (isImage) { attachmentIcon.textContent = "🖼️"; }
        else if (file.name.toLowerCase().endsWith(".pdf")) { attachmentIcon.textContent = "📕"; }
        else if (file.name.toLowerCase().endsWith(".doc") || file.name.toLowerCase().endsWith(".docx")) { attachmentIcon.textContent = "📘"; }
        else { attachmentIcon.textContent = "📄"; }
    }
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    // ─── IMAGE upload ──────────────────────────────────────────
    photoButton.addEventListener("click", function() { imageInput.click(); });
    imageInput.addEventListener("change", function() {
        const file = imageInput.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { alert("Please select an image."); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImage = e.target.result;
            showAttachment(file, true);
        };
        reader.readAsDataURL(file);
        imageInput.value = "";
    });

    // ─── FILE upload ──────────────────────────────────────────
    fileButton.addEventListener("click", function() { fileInput.click(); });
    fileInput.addEventListener("change", async function() {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert("Maximum file size is 10 MB."); fileInput.value = ""; return; }
        selectedFile = file;
        selectedFileData = null;
        const name = file.name.toLowerCase();
        if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".json") || name.endsWith(".md")) {
            try { selectedFileData = await file.text(); } catch { selectedFileData = null; }
        }
        showAttachment(file, false);
        fileInput.value = "";
    });

    // ─── Remove attachment ────────────────────────────────────
    removeAttachment.addEventListener("click", function() {
        selectedImage = null;
        selectedFile = null;
        selectedFileData = null;
        imageInput.value = "";
        fileInput.value = "";
        attachmentPreview.style.display = "none";
    });

    // ─── NEW CHAT ──────────────────────────────────────────────
    newChatButton.addEventListener("click", function() {
        if (messagesContainer.querySelectorAll(".message").length > 1) {
            if (!confirm("Start a new conversation? Current chat will be cleared.")) return;
        }
        messagesContainer.innerHTML = "";
        conversation = [{ role: "system", content: "You are Jhonny, a helpful AI assistant. Analyze messages, images and files when provided. Use markdown for formatting when appropriate." }];
        addMessage("Hello! I'm Jhonny. How can I help you?", "assistant");
    });

    // ─── SEND MESSAGE ──────────────────────────────────────────
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text && !selectedImage && !selectedFile) return;

        const userContent = text || (selectedFile ? "Analyze this file." : "Analyze this image.");
        addMessage(userContent, "user", selectedImage, selectedFile ? selectedFile.name : null);
        userInput.value = "";

        const image = selectedImage;
        const file = selectedFile;
        selectedImage = null;
        selectedFile = null;
        selectedFileData = null;
        imageInput.value = "";
        fileInput.value = "";
        attachmentPreview.style.display = "none";

        sendBtn.disabled = true;
        photoButton.disabled = true;
        fileButton.disabled = true;
        userInput.disabled = true;

        addTyping();

        try {
            conversation.push({ role: "user", content: userContent });
            const formData = new FormData();
            formData.append("messages", JSON.stringify(conversation));
            if (file) {
                formData.append("file", file);
            } else if (image) {
                const blob = await (await fetch(image)).blob();
                const fileType = blob.type;
                const fileName = "image." + fileType.split("/")[1];
                const fileObj = new File([blob], fileName, { type: fileType });
                formData.append("file", fileObj);
            }

            const response = await fetch("/api/chat", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || "Server error");
            }
            const data = await response.json();
            const reply = data.reply || "No response received.";

            removeTyping();
            addMessage(reply, "assistant");
            conversation.push({ role: "assistant", content: reply });
        } catch (error) {
            removeTyping();
            addMessage("Error: " + error.message, "assistant");
            console.error(error);
        } finally {
            enableAll();
        }
    }

    // ─── Event listeners ──────────────────────────────────────
    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey && enterToSend) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ─── Settings panel ────────────────────────────────────────
    settingsButton.addEventListener("click", function(e) {
        e.stopPropagation();
        settingsPanel.classList.toggle("show");
        // Sync burger checkbox
        const burgerCheckbox = document.getElementById("burgerCheckbox");
        if (burgerCheckbox) {
            burgerCheckbox.checked = settingsPanel.classList.contains("show");
        }
    });
    settingsPanel.addEventListener("click", function(e) {
        e.stopPropagation();
    });
    document.addEventListener("click", function() {
        settingsPanel.classList.remove("show");
        // Uncheck burger when panel closes
        const burgerCheckbox = document.getElementById("burgerCheckbox");
        if (burgerCheckbox) burgerCheckbox.checked = false;
    });

    // ─── Theme ──────────────────────────────────────────────────
    themeToggle.addEventListener("click", function() {
        document.body.classList.toggle("light");
        themeToggle.classList.toggle("active");
        localStorage.setItem("jhonnyTheme", document.body.classList.contains("light") ? "light" : "dark");
    });
    if (localStorage.getItem("jhonnyTheme") === "light") {
        document.body.classList.add("light");
        themeToggle.classList.add("active");
    }

    // ─── Enter toggle ──────────────────────────────────────────
    enterToggle.addEventListener("click", function() {
        enterToSend = !enterToSend;
        enterToggle.classList.toggle("active", enterToSend);
    });

    // ─── Clear chat ────────────────────────────────────────────
    clearChat.addEventListener("click", function() {
        if (!confirm("Clear this conversation?")) return;
        messagesContainer.innerHTML = "";
        conversation = [{ role: "system", content: "You are Jhonny, a helpful AI assistant. Analyze messages, images and files when provided. Use markdown for formatting when appropriate." }];
        addMessage("Hello! I'm Jhonny. How can I help you?", "assistant");
    });

    // ─── Export chat ────────────────────────────────────────────
    exportChat.addEventListener("click", function() {
        let output = "JHONNY CHATBOX\n\n";
        const msgs = messagesContainer.querySelectorAll(".message");
        msgs.forEach(function(msg) {
            const role = msg.classList.contains("user") ? "YOU" : "JHONNY";
            const contentDiv = msg.querySelector(".message-content");
            const text = contentDiv ? contentDiv.textContent : msg.textContent;
            output += role + ":\n" + text + "\n\n";
        });
        const blob = new Blob([output], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "jhonny-chat.txt";
        link.click();
        URL.revokeObjectURL(url);
    });

    // ─── Reset settings ────────────────────────────────────────
    resetSettings.addEventListener("click", function() {
        document.body.classList.remove("light");
        themeToggle.classList.remove("active");
        enterToSend = true;
        enterToggle.classList.add("active");
        autoScroll = true;
        scrollToggle.classList.add("active");
        localStorage.removeItem("jhonnyTheme");
        localStorage.removeItem("jhonnyFontSize");
        localStorage.removeItem("jhonnyAutoScroll");
        applyFontSize(16);
    });

    // ─── START ──────────────────────────────────────────────────
    enableAll();
    addMessage("Hello! I'm Jhonny. How can I help you?", "assistant");

});
