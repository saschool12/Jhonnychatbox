// ─── Wait for DOM to load ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {

    // ─── Elements ──────────────────────────────────────────────
    const messagesContainer = document.getElementById("chatMessages");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const photoButton = document.getElementById("photoButton");
    const fileButton = document.getElementById("fileButton");
    const settingsButton = document.getElementById("settingsButton");
    const settingsPanel = document.getElementById("settingsPanel");
    const themeToggle = document.getElementById("themeToggle");
    const enterToggle = document.getElementById("enterToggle");
    const clearChat = document.getElementById("clearChat");
    const exportChat = document.getElementById("exportChat");
    const resetSettings = document.getElementById("resetSettings");
    const messageCount = document.getElementById("messageCount");

    // ─── State ──────────────────────────────────────────────────
    let enterToSend = true;
    let conversation = [
        { role: "system", content: "You are Jhonny, a helpful AI assistant." }
    ];

    // ─── Force enable everything ──────────────────────────────
    function enableAll() {
        sendBtn.disabled = false;
        photoButton.disabled = false;
        fileButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
        console.log("✅ All enabled");
    }

    // ─── Add message ──────────────────────────────────────────
    function addMessage(content, role) {
        const message = document.createElement("div");
        message.className = "message " + role;
        message.textContent = content;
        messagesContainer.appendChild(message);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        messageCount.textContent = messagesContainer.querySelectorAll(".message").length;
    }

    // ─── Typing indicator ─────────────────────────────────────
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

    // ─── Send message ──────────────────────────────────────────
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, "user");
        userInput.value = "";

        sendBtn.disabled = true;
        userInput.disabled = true;
        addTyping();

        try {
            conversation.push({ role: "user", content: text });
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: conversation })
            });
            const data = await response.json();
            const reply = data.reply || "No response.";
            removeTyping();
            addMessage(reply, "assistant");
            conversation.push({ role: "assistant", content: reply });
        } catch (error) {
            removeTyping();
            addMessage("Error: " + error.message, "assistant");
        } finally {
            sendBtn.disabled = false;
            userInput.disabled = false;
            userInput.focus();
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

    // ─── Settings toggle ──────────────────────────────────────
    settingsButton.addEventListener("click", function(e) {
        e.stopPropagation();
        settingsPanel.classList.toggle("show");
    });
    document.addEventListener("click", function() {
        settingsPanel.classList.remove("show");
    });

    // ─── Theme toggle ──────────────────────────────────────────
    themeToggle.addEventListener("click", function() {
        document.body.classList.toggle("light");
        themeToggle.classList.toggle("active");
    });

    // ─── Enter toggle ──────────────────────────────────────────
    enterToggle.addEventListener("click", function() {
        enterToSend = !enterToSend;
        enterToggle.classList.toggle("active", enterToSend);
    });

    // ─── Clear chat ────────────────────────────────────────────
    clearChat.addEventListener("click", function() {
        if (!confirm("Clear conversation?")) return;
        messagesContainer.innerHTML = "";
        conversation = [{ role: "system", content: "You are Jhonny, a helpful AI assistant." }];
        addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");
    });

    // ─── Export chat ────────────────────────────────────────────
    exportChat.addEventListener("click", function() {
        let output = "JHONNY CHATBOX\n\n";
        const msgs = messagesContainer.querySelectorAll(".message");
        msgs.forEach(function(m) {
            const role = m.classList.contains("user") ? "YOU" : "JHONNY";
            output += role + ":\n" + m.textContent + "\n\n";
        });
        const blob = new Blob([output], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "jhonny-chat.txt";
        link.click();
        URL.revokeObjectURL(url);
    });

    // ─── Reset ──────────────────────────────────────────────────
    resetSettings.addEventListener("click", function() {
        document.body.classList.remove("light");
        themeToggle.classList.remove("active");
        enterToSend = true;
        enterToggle.classList.add("active");
    });

    // ─── Start ──────────────────────────────────────────────────
    enableAll();
    addMessage("Hello! I'm Jhonny. How can I help you today?", "assistant");
    console.log("✅ Jhonny Chatbox started!");
});
