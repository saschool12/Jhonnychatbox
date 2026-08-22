const API_URL = "/api/chat";

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
const clearChat = document.getElementById("clearChat");
const exportChat = document.getElementById("exportChat");
const resetSettings = document.getElementById("resetSettings");
const messageCount = document.getElementById("messageCount");

let selectedImage = null;
let selectedFile = null;
let selectedFileData = null;
let enterToSend = true;

let conversation = [
    {
        role: "system",
        content: "You are Jhonny, a helpful AI assistant. Analyze messages, images and files when provided."
    }
];

// ─── SETTINGS ──────────────────────────────────────────────────────
settingsButton.addEventListener("click", function(e) {
    e.stopPropagation();
    settingsPanel.classList.toggle("show");
});
settingsPanel.addEventListener("click", function(e) {
    e.stopPropagation();
});
document.addEventListener("click", function() {
    settingsPanel.classList.remove("show");
});

// ─── THEME ────────────────────────────────────────────────────────
themeToggle.addEventListener("click", function() {
    document.body.classList.toggle("light");
    themeToggle.classList.toggle("active");
    localStorage.setItem("jhonnyTheme", document.body.classList.contains("light") ? "light" : "dark");
});
if (localStorage.getItem("jhonnyTheme") === "light") {
    document.body.classList.add("light");
    themeToggle.classList.add("active");
}

// ─── ENTER ────────────────────────────────────────────────────────
enterToggle.addEventListener("click", function() {
    enterToSend = !enterToSend;
    enterToggle.classList.toggle("active", enterToSend);
});

// ─── MESSAGE COUNT ────────────────────────────────────────────────
function updateMessageCount() {
    messageCount.textContent = messagesContainer.querySelectorAll(".message").length;
}

// ─── FORMAT MESSAGE CONTENT (SAFE) ───────────────────────────────
function formatMessageContent(text) {
    // Escape HTML
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Convert code blocks ```language ... ``` to HTML
    escaped = escaped.replace(
        /```(\w*)\s*([\s\S]*?)```/g,
        function(match, language, code) {
            code = code.replace(/^\s+|\s+$/g, '');
            const lang = language || 'plaintext';
            return `
                <div class="code-block" data-code="${encodeURIComponent(code)}">
                    <div class="code-header">
                        <span class="code-language">${lang}</span>
                        <button class="code-copy-btn">Copy</button>
                    </div>
                    <pre class="code-pre"><code class="code-code">${code}</code></pre>
                </div>
            `;
        }
    );

    // Inline `code`
    escaped = escaped.replace(
        /`([^`]+)`/g,
        '<code class="inline-code">$1</code>'
    );

    // Newlines to <br>
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
}

// ─── ADD MESSAGE ──────────────────────────────────────────────────
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
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    updateMessageCount();
}

// ─── EVENT DELEGATION FOR CODE COPY BUTTONS ──────────────────────
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
    }).catch(() => {
        alert("Unable to copy code.");
    });
});

// ─── TYPING ────────────────────────────────────────────────────────
function addTyping() {
    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.id = "typingIndicator";
    typing.innerHTML = `<span></span><span></span><span></span>`;
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function removeTyping() {
    const typing = document.getElementById("typingIndicator");
    if (typing) typing.remove();
}

// ─── IMAGE ────────────────────────────────────────────────────────
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
});

// ─── FILE ─────────────────────────────────────────────────────────
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
});

// ─── ATTACHMENT ──────────────────────────────────────────────────
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

// ─── REMOVE ATTACHMENT ──────────────────────────────────────────
removeAttachment.addEventListener("click", function() {
    selectedImage = null;
    selectedFile = null;
    selectedFileData = null;
    imageInput.value = "";
    fileInput.value = "";
    attachmentPreview.style.display = "none";
});

// ─── SEND MESSAGE ─────────────────────────────────────────────────
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

        const response = await fetch(API_URL, { method: "POST", body: formData });
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
        sendBtn.disabled = false;
        photoButton.disabled = false;
        fileButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey && enterToSend) {
        e.preventDefault();
        sendMessage();
    }
});

// ─── CLEAR ────────────────────────────────────────────────────────
clearChat.addEventListener("click", function() {
    if (!confirm("Clear this conversation?")) return;
    messagesContainer.innerHTML = "";
    conversation = [{ role: "system", content: "You are Jhonny, a helpful AI assistant." }];
    addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");
});

// ─── EXPORT ──────────────────────────────────────────────────────
exportChat.addEventListener("click", function() {
    let output = "JHONNY CHATBOX\n\n";
    const messages = messagesContainer.querySelectorAll(".message");
    messages.forEach(function(msg) {
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

// ─── RESET ────────────────────────────────────────────────────────
resetSettings.addEventListener("click", function() {
    document.body.classList.remove("light");
    themeToggle.classList.remove("active");
    enterToSend = true;
    enterToggle.classList.add("active");
    localStorage.removeItem("jhonnyTheme");
});

// ─── START ──────────────────────────────────────────────────────
addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");    if (role === "assistant" && content) {
        const copy = document.createElement("button");
        copy.className = "copy-button";
        copy.textContent = "Copy";
        copy.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(content);
                copy.textContent = "Copied!";
                setTimeout(function() { copy.textContent = "Copy"; }, 1500);
            } catch {
                alert("Unable to copy.");
            }
        });
        message.appendChild(copy);
    }

    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    updateMessageCount();
}

// ─── FORMAT MESSAGE CONTENT (detects code blocks) ──────────────
function formatMessageContent(text) {
    // Escape HTML
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Convert markdown code blocks ```language ... ``` to HTML
    escaped = escaped.replace(
        /```(\w*)\s*([\s\S]*?)```/g,
        function(match, language, code) {
            code = code.replace(/^\s+|\s+$/g, '');
            const lang = language || 'plaintext';
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${lang}</span>
                        <button class="code-copy-btn" onclick="copyCode(this)">Copy</button>
                    </div>
                    <pre class="code-pre"><code class="code-code">${code}</code></pre>
                </div>
            `;
        }
    );

    // Convert inline `code` to <code> tags
    escaped = escaped.replace(
        /`([^`]+)`/g,
        '<code class="inline-code">$1</code>'
    );

    // Convert newlines to <br>
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
}

// ─── COPY CODE FROM CODE BLOCK ──────────────────────────────────
window.copyCode = function(button) {
    const codeBlock = button.closest('.code-block');
    const codeElement = codeBlock.querySelector('.code-code');
    const text = codeElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = 'Copy'; }, 2000);
    }).catch(() => {
        alert('Unable to copy code.');
    });
};

// TYPING
function addTyping() {
    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.id = "typingIndicator";
    typing.innerHTML = `<span></span><span></span><span></span>`;
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function removeTyping() {
    const typing = document.getElementById("typingIndicator");
    if (typing) typing.remove();
}

// IMAGE
photoButton.addEventListener("click", function() { imageInput.click(); });
imageInput.addEventListener("change", function() {
    const file = imageInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image."); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        selectedImage = event.target.result;
        showAttachment(file, true);
    };
    reader.readAsDataURL(file);
});

// FILE
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
});

// ATTACHMENT
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

// REMOVE
removeAttachment.addEventListener("click", function() {
    selectedImage = null;
    selectedFile = null;
    selectedFileData = null;
    imageInput.value = "";
    fileInput.value = "";
    attachmentPreview.style.display = "none";
});

// ─── SEND MESSAGE ──────────────────────────────────────────────────
async function sendMessage() {
    const text = userInput.value.trim();

    if (!text && !selectedImage && !selectedFile) {
        return;
    }

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

        const response = await fetch(API_URL, {
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
        sendBtn.disabled = false;
        photoButton.disabled = false;
        fileButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// SEND BUTTON
sendBtn.addEventListener("click", sendMessage);

// ENTER
userInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey && enterToSend) {
        event.preventDefault();
        sendMessage();
    }
});

// CLEA
clearChat.addEventListener("click", function() {
    if (!confirm("Clear this conversation?")) return;
    messagesContainer.innerHTML = "";
    conversation = [{ role: "system", content: "You are Jhonny, a helpful AI assistant." }];
    addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");
});

// EXPORT
exportChat.addEventListener("click", function() {
    let output = "JHONNY CHATBOX\n\n";
    const messages = messagesContainer.querySelectorAll(".message");
    messages.forEach(function(message) {
        const role = message.classList.contains("user") ? "YOU" : "JHONNY";
        // Get text content without the copy button
        const contentDiv = message.querySelector(".message-content");
        const text = contentDiv ? contentDiv.textContent : message.textContent;
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

// RESET
resetSettings.addEventListener("click", function() {
    document.body.classList.remove("light");
    themeToggle.classList.remove("active");
    enterToSend = true;
    enterToggle.classList.add("active");
    localStorage.removeItem("jhonnyTheme");
});

// START
addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");            try {
                await navigator.clipboard.writeText(content);
                copy.textContent = "Copied!";
                setTimeout(function() { copy.textContent = "Copy"; }, 1500);
            } catch {
                alert("Unable to copy.");
            }
        });
        message.appendChild(copy);
    }

    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    updateMessageCount();
}

// TYPING
function addTyping() {
    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.id = "typingIndicator";
    typing.innerHTML = `<span></span><span></span><span></span>`;
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function removeTyping() {
    const typing = document.getElementById("typingIndicator");
    if (typing) typing.remove();
}

// IMAGE
photoButton.addEventListener("click", function() { imageInput.click(); });
imageInput.addEventListener("change", function() {
    const file = imageInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image."); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        selectedImage = event.target.result;
        showAttachment(file, true);
    };
    reader.readAsDataURL(file);
});

// FILE
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
});

// ATTACHMENT
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

// REMOVE
removeAttachment.addEventListener("click", function() {
    selectedImage = null;
    selectedFile = null;
    selectedFileData = null;
    imageInput.value = "";
    fileInput.value = "";
    attachmentPreview.style.display = "none";
});

// ====== ✅ NEW SEND MESSAGE (FIXED) ======
async function sendMessage() {
    const text = userInput.value.trim();

    if (!text && !selectedImage && !selectedFile) {
        return;
    }

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

        const response = await fetch(API_URL, {
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
        sendBtn.disabled = false;
        photoButton.disabled = false;
        fileButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// SEND BUTTON
sendBtn.addEventListener("click", sendMessage);

// ENTER
userInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey && enterToSend) {
        event.preventDefault();
        sendMessage();
    }
});

// CLEAR
clearChat.addEventListener("click", function() {
    if (!confirm("Clear this conversation?")) return;
    messagesContainer.innerHTML = "";
    conversation = [{ role: "system", content: "You are Jhonny, a helpful AI assistant." }];
    addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");
});

// EXPORT
exportChat.addEventListener("click", function() {
    let output = "JHONNY CHATBOX\n\n";
    const messages = messagesContainer.querySelectorAll(".message");
    messages.forEach(function(message) {
        const role = message.classList.contains("user") ? "YOU" : "JHONNY";
        output += role + ":\n" + message.innerText + "\n\n";
    });
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jhonny-chat.txt";
    link.click();
    URL.revokeObjectURL(url);
});

// RESET
resetSettings.addEventListener("click", function() {
    document.body.classList.remove("light");
    themeToggle.classList.remove("active");
    enterToSend = true;
    enterToggle.classList.add("active");
    localStorage.removeItem("jhonnyTheme");
});

// START
addMessage("Hello! I'm Jhonny, Bot of The Group 7 What Can I Help You?");
