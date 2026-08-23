document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const app = $("app");
    const sidebar = $("sidebar");
    const messagesContainer = $("chatMessages");
    const welcome = $("welcome");
    const input = $("userInput");
    const sendBtn = $("sendBtn");

    const newChatButton = $("newChatButton");
    const topNewChat = $("topNewChat");

    const photoButton = $("photoButton");
    const imageInput = $("imageInput");

    const fileButton = $("fileButton");
    const fileInput = $("fileInput");

    const attachmentPreview = $("attachmentPreview");
    const attachmentName = $("attachmentName");
    const attachmentSize = $("attachmentSize");
    const attachmentIcon = $("attachmentIcon");
    const removeAttachment = $("removeAttachment");

    const chatHistory = $("chatHistory");
    const searchChats = $("searchChats");

    const mobileMenu = $("mobileMenu");

    const settingsButton = $("settingsButton");
    const settingsOverlay = $("settingsOverlay");
    const closeSettings = $("closeSettings");

    const themeToggle = $("themeToggle");
    const enterToggle = $("enterToggle");

    const fontSizeSlider = $("fontSizeSlider");
    const fontSizeLabel = $("fontSizeLabel");

    const clearChat = $("clearChat");
    const logoutButton = $("logoutButton");

    const authModal = $("authModal");
    const authTitle = $("authTitle");
    const authUsername = $("authUsername");
    const authPassword = $("authPassword");
    const authSubmitBtn = $("authSubmitBtn");
    const authSwitchText = $("authSwitchText");
    const authSwitchLink = $("authSwitchLink");
    const authError = $("authError");

    const usernameDisplay = $("usernameDisplay");
    const userAvatar = $("userAvatar");

    let token = localStorage.getItem("jhonnyToken");
    let currentUser = localStorage.getItem("jhonnyUser");

    let authMode = "login";

    let selectedImage = null;
    let selectedFile = null;

    let enterToSend =
        localStorage.getItem("jhonnyEnter") !== "false";

    let chats = [];

    try {
        chats = JSON.parse(
            localStorage.getItem("jhonnyChats") || "[]"
        );
    } catch {
        chats = [];
    }

    let currentChat = null;

    let conversation = [
        {
            role: "system",
            content:
                "You are Jhonny, a helpful AI assistant. Give clear, accurate and useful answers. Use Markdown when helpful."
        }
    ];

    function showAuth() {
        authModal.style.display = "flex";
        app.style.display = "none";
    }

    function showApp() {
        authModal.style.display = "none";
        app.style.display = "flex";

        if (currentUser) {
            usernameDisplay.textContent = currentUser;

            userAvatar.textContent =
                currentUser.charAt(0).toUpperCase();
        }
    }

    function showAuthError(message, success = false) {
        authError.textContent = message;

        authError.style.color =
            success ? "#77ff99" : "#ff7777";
    }

    function setAuthButton(text, disabled = false) {
        authSubmitBtn.textContent = text;
        authSubmitBtn.disabled = disabled;
    }

    if (token && currentUser) {
        showApp();
        createNewChat(false);
    } else {
        showAuth();
    }

    function switchAuthMode() {
        authMode =
            authMode === "login"
                ? "register"
                : "login";

        showAuthError("");

        if (authMode === "login") {
            authTitle.textContent = "Welcome back";
            authSubmitBtn.textContent = "Login";

            authSwitchText.innerHTML =
                `Don't have an account?
                <a href="#" id="authSwitchLink">
                    Register
                </a>`;
        } else {
            authTitle.textContent = "Create your account";
            authSubmitBtn.textContent = "Register";

            authSwitchText.innerHTML =
                `Already have an account?
                <a href="#" id="authSwitchLink">
                    Login
                </a>`;
        }

        const link = $("authSwitchLink");

        if (link) {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                switchAuthMode();
            });
        }
    }

    authSwitchLink.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            switchAuthMode();
        }
    );

    async function authenticate(username, password) {
        const endpoint =
            authMode === "login"
                ? "/api/login"
                : "/api/register";

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 15000);

        let response;

        try {
            response = await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        username,
                        password
                    }),

                    signal: controller.signal
                }
            );
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(
                    "The server took too long to respond. Check your Vercel API."
                );
            }

            throw new Error(
                "Cannot connect to the server."
            );
        } finally {
            clearTimeout(timeout);
        }

        const responseText =
            await response.text();

        let data = {};

        try {
            data =
                responseText
                    ? JSON.parse(responseText)
                    : {};
        } catch {
            throw new Error(
                responseText ||
                `Server returned HTTP ${response.status}`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                `Request failed with HTTP ${response.status}`
            );
        }

        return data;
    }
        authSubmitBtn.addEventListener(
        "click",
        async () => {
            const username =
                authUsername.value.trim();

            const password =
                authPassword.value;

            showAuthError("");

            if (!username || !password) {
                showAuthError(
                    "Please enter your username and password."
                );

                return;
            }

            if (authMode === "register") {
                if (username.length < 3) {
                    showAuthError(
                        "Username must be at least 3 characters."
                    );

                    return;
                }

                if (password.length < 6) {
                    showAuthError(
                        "Password must be at least 6 characters."
                    );

                    return;
                }
            }

            if (authMode === "login") {
                setAuthButton(
                    "Logging in...",
                    true
                );
            } else {
                setAuthButton(
                    "Creating account...",
                    true
                );
            }

            try {
                const data =
                    await authenticate(
                        username,
                        password
                    );

                if (authMode === "register") {
                    showAuthError(
                        "Account created successfully! You can now log in.",
                        true
                    );

                    authMode = "login";

                    authTitle.textContent =
                        "Welcome back";

                    authSubmitBtn.textContent =
                        "Login";

                    authPassword.value = "";

                    return;
                }

                if (!data.token) {
                    throw new Error(
                        "The server did not return a login token."
                    );
                }

                token = data.token;

                currentUser =
                    data.username ||
                    username;

                localStorage.setItem(
                    "jhonnyToken",
                    token
                );

                localStorage.setItem(
                    "jhonnyUser",
                    currentUser
                );

                authUsername.value = "";
                authPassword.value = "";

                showApp();

                createNewChat(false);

            } catch (error) {
                console.error(
                    "Authentication error:",
                    error
                );

                showAuthError(
                    error.message ||
                    "Login failed."
                );

            } finally {
                if (authMode === "login") {
                    setAuthButton(
                        "Login",
                        false
                    );
                } else {
                    setAuthButton(
                        "Register",
                        false
                    );
                }
            }
        }
    );

    authPassword.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                authSubmitBtn.click();
            }
        }
    );

    authUsername.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                authPassword.focus();
            }
        }
    );

    function createNewChat(save = true) {
        if (save && currentChat) {
            saveCurrentChat();
        }

        currentChat = {
            id: Date.now(),
            title: "New chat",
            messages: []
        };

        conversation = [
            {
                role: "system",
                content:
                    "You are Jhonny, a helpful AI assistant. Give clear, accurate and useful answers. Use Markdown when helpful."
            }
        ];

        messagesContainer.innerHTML = "";

        welcome.style.display = "block";

        renderHistory();

        input.value = "";
        input.style.height = "auto";

        removeSelectedFile();

        input.focus();
    }

    function saveCurrentChat() {
        if (!currentChat) return;

        if (!currentChat.messages.length) {
            return;
        }

        const existing =
            chats.findIndex(
                (chat) =>
                    chat.id === currentChat.id
            );

        if (existing >= 0) {
            chats[existing] = currentChat;
        } else {
            chats.unshift(currentChat);
        }

        localStorage.setItem(
            "jhonnyChats",
            JSON.stringify(chats)
        );

        renderHistory();
    }

    function renderHistory(filter = "") {
        chatHistory.innerHTML = "";

        const filtered =
            chats.filter((chat) =>
                (chat.title || "New chat")
                    .toLowerCase()
                    .includes(
                        filter.toLowerCase()
                    )
            );

        filtered.forEach((chat) => {
            const button =
                document.createElement("button");

            button.className =
                "history-item";

            if (
                currentChat &&
                chat.id === currentChat.id
            ) {
                button.classList.add("active");
            }

            button.textContent =
                chat.title || "New chat";

            button.addEventListener(
                "click",
                () => {
                    loadChat(chat.id);

                    if (
                        window.innerWidth <= 700
                    ) {
                        sidebar.classList.remove(
                            "open"
                        );
                    }
                }
            );

            chatHistory.appendChild(button);
        });
    }

    function loadChat(id) {
        const chat =
            chats.find(
                (item) => item.id === id
            );

        if (!chat) return;

        currentChat = chat;

        conversation = [
            {
                role: "system",
                content:
                    "You are Jhonny, a helpful AI assistant. Give clear, accurate and useful answers. Use Markdown when helpful."
            },

            ...chat.messages.map(
                (message) => ({
                    role: message.role,
                    content: message.content
                })
            )
        ];

        messagesContainer.innerHTML = "";

        welcome.style.display = "none";

        chat.messages.forEach(
            (message) => {
                addMessage(
                    message.content,
                    message.role,
                    message.image || null,
                    message.fileName || null
                );
            }
        );

        renderHistory();
    }

    function escapeHTML(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderMarkdown(text) {
        let html =
            escapeHTML(text);

        html = html.replace(
            /^### (.+)$/gm,
            "<h3>$1</h3>"
        );

        html = html.replace(
            /^## (.+)$/gm,
            "<h2>$1</h2>"
        );

        html = html.replace(
            /^# (.+)$/gm,
            "<h1>$1</h1>"
        );

        html = html.replace(
            /\*\*(.+?)\*\*/g,
            "<strong>$1</strong>"
        );

        html = html.replace(
            /\*(.+?)\*/g,
            "<em>$1</em>"
        );

        html = html.replace(
            /`([^`]+)`/g,
            '<code class="inline-code">$1</code>'
        );

        html = html.replace(
            /^\- (.+)$/gm,
            "<li>$1</li>"
        );

        html = html.replace(
            /(<li>.*<\/li>\n?)+/g,
            "<ul>$&</ul>"
        );

        html = html.replace(
            /\n/g,
            "<br>"
        );

        return html;
    }

    function formatContent(text) {
        const blocks = [];

        let processed =
            text.replace(
                /```(\w*)\s*([\s\S]*?)```/g,
                (
                    _,
                    language,
                    code
                ) => {
                    const id =
                        blocks.length;

                    blocks.push({
                        language:
                            language || "text",
                        code:
                            code.trim()
                    });

                    return `___CODE_${id}___`;
                }
            );

        let html =
            renderMarkdown(processed);

        blocks.forEach(
            (block, index) => {
                const safeCode =
                    escapeHTML(
                        block.code
                    );

                html = html.replace(
                    `___CODE_${index}___`,
                    `
                    <div class="code-block">
                        <div class="code-header">
                            <span class="code-language">
                                ${escapeHTML(
                                    block.language
                                )}
                            </span>

                            <button
                                class="code-copy-btn"
                                data-code="${encodeURIComponent(
                                    block.code
                                )}"
                            >
                                Copy
                            </button>
                        </div>

                        <pre class="code-pre"><code class="code-code">${safeCode}</code></pre>
                    </div>
                    `
                );
            }
        );

        return html;
    }
        function addMessage(
        content,
        role,
        image = null,
        fileName = null
    ) {
        welcome.style.display = "none";

        const message =
            document.createElement("div");

        message.className =
            `message ${role}`;

        message.innerHTML = `
            <div class="message-avatar">
                ${
                    role === "assistant"
                        ? "J"
                        : "U"
                }
            </div>

            <div class="message-body">
                <div class="message-role">
                    ${
                        role === "assistant"
                            ? "Jhonny"
                            : "You"
                    }
                </div>

                <div class="message-content"></div>
            </div>
        `;

        const contentDiv =
            message.querySelector(
                ".message-content"
            );

        if (image) {
            const img =
                document.createElement("img");

            img.src = image;

            img.className =
                "message-image";

            contentDiv.appendChild(img);
        }

        if (fileName) {
            const fileBox =
                document.createElement("div");

            fileBox.className =
                "file-box";

            fileBox.innerHTML = `
                <div class="file-icon">
                    FILE
                </div>

                <div class="file-name">
                    ${escapeHTML(fileName)}
                </div>
            `;

            contentDiv.appendChild(fileBox);
        }

        if (content) {
            const text =
                document.createElement("div");

            text.innerHTML =
                formatContent(content);

            contentDiv.appendChild(text);
        }

        if (
            role === "assistant" &&
            content
        ) {
            const copy =
                document.createElement("button");

            copy.className =
                "copy-button";

            copy.textContent = "Copy";

            copy.addEventListener(
                "click",
                async () => {
                    try {
                        await navigator
                            .clipboard
                            .writeText(
                                content
                            );

                        copy.textContent =
                            "Copied!";

                        setTimeout(
                            () => {
                                copy.textContent =
                                    "Copy";
                            },
                            1500
                        );

                    } catch {
                        copy.textContent =
                            "Failed";
                    }
                }
            );

            contentDiv.appendChild(copy);
        }

        messagesContainer.appendChild(
            message
        );

        scrollToBottom();
    }

    function scrollToBottom() {
        const area =
            messagesContainer.parentElement;

        area.scrollTop =
            area.scrollHeight;
    }

    function addTyping() {
        const typing =
            document.createElement("div");

        typing.className =
            "message assistant";

        typing.id = "typing";

        typing.innerHTML = `
            <div class="message-avatar">
                J
            </div>

            <div class="message-body">
                <div class="message-role">
                    Jhonny
                </div>

                <div class="typing">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(
            typing
        );

        scrollToBottom();
    }

    async function sendMessage() {
        const text =
            input.value.trim();

        if (
            !text &&
            !selectedImage &&
            !selectedFile
        ) {
            return;
        }

        const userContent =
            text ||
            (
                selectedFile
                    ? "Analyze this file."
                    : "Analyze this image."
            );

        addMessage(
            userContent,
            "user",
            selectedImage,
            selectedFile
                ? selectedFile.name
                : null
        );

        if (!currentChat) {
            createNewChat(false);
        }

        currentChat.messages.push({
            role: "user",
            content: userContent,
            image: selectedImage,
            fileName:
                selectedFile
                    ? selectedFile.name
                    : null
        });

        if (
            currentChat.title ===
            "New chat"
        ) {
            currentChat.title =
                text
                    ? text.slice(0, 40)
                    : "Uploaded file";
        }

        conversation.push({
            role: "user",
            content: userContent
        });

        const imageToSend =
            selectedImage;

        const fileToSend =
            selectedFile;

        input.value = "";

        input.style.height =
            "auto";

        removeSelectedFile();

        addTyping();

        sendBtn.disabled = true;

        try {
            const formData =
                new FormData();

            formData.append(
                "messages",
                JSON.stringify(
                    conversation
                )
            );

            if (imageToSend) {
                const blob =
                    await fetch(
                        imageToSend
                    ).then(
                        (response) =>
                            response.blob()
                    );

                formData.append(
                    "file",
                    blob,
                    "image.png"
                );
            }

            if (fileToSend) {
                formData.append(
                    "file",
                    fileToSend,
                    fileToSend.name
                );
            }

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => {
                        controller.abort();
                    },
                    60000
                );

            let response;

            try {
                response =
                    await fetch(
                        "/api/chat",
                        {
                            method: "POST",

                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            },

                            body:
                                formData,

                            signal:
                                controller.signal
                        }
                    );
            } finally {
                clearTimeout(timeout);
            }

            const responseText =
                await response.text();

            let data = {};

            try {
                data =
                    responseText
                        ? JSON.parse(
                            responseText
                        )
                        : {};
            } catch {
                throw new Error(
                    responseText ||
                    `Server returned HTTP ${response.status}`
                );
            }

            if (!response.ok) {
                if (
                    response.status === 401
                ) {
                    logout();
                }

                throw new Error(
                    data.error ||
                    data.message ||
                    `AI request failed (${response.status})`
                );
            }

            const reply =
                data.reply ||
                data.message ||
                "I couldn't generate a response.";

            const typing =
                $("typing");

            if (typing) {
                typing.remove();
            }

            addMessage(
                reply,
                "assistant"
            );

            conversation.push({
                role: "assistant",
                content: reply
            });

            currentChat.messages.push({
                role: "assistant",
                content: reply
            });

            saveCurrentChat();

        } catch (error) {
            console.error(
                "Chat error:",
                error
            );

            const typing =
                $("typing");

            if (typing) {
                typing.remove();
            }

            addMessage(
                `Error: ${error.message}`,
                "assistant"
            );

        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }

    sendBtn.addEventListener(
        "click",
        sendMessage
    );

    input.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                enterToSend
            ) {
                event.preventDefault();
                sendMessage();
            }
        }
    );

    input.addEventListener(
        "input",
        () => {
            input.style.height =
                "auto";

            input.style.height =
                Math.min(
                    input.scrollHeight,
                    180
                ) + "px";
        }
    );

    photoButton.addEventListener(
        "click",
        () => {
            imageInput.click();
        }
    );

    fileButton.addEventListener(
        "click",
        () => {
            fileInput.click();
        }
    );

    imageInput.addEventListener(
        "change",
        () => {
            const file =
                imageInput.files[0];

            if (!file) return;

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {
                alert(
                    "Please select an image."
                );

                imageInput.value = "";

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                (event) => {
                    selectedImage =
                        event.target.result;

                    selectedFile = null;

                    showAttachment(
                        file,
                        true
                    );
                };

            reader.readAsDataURL(file);
        }
    );

    fileInput.addEventListener(
        "change",
        () => {
            const file =
                fileInput.files[0];

            if (!file) return;

            if (
                file.size >
                10 * 1024 * 1024
            ) {
                alert(
                    "Maximum file size is 10 MB."
                );

                fileInput.value = "";

                return;
            }

            selectedFile = file;
            selectedImage = null;

            showAttachment(
                file,
                false
            );
        }
    );

    function showAttachment(
        file,
        isImage
    ) {
        attachmentPreview.style.display =
            "block";

        attachmentName.textContent =
            file.name;

        attachmentSize.textContent =
            formatSize(file.size);

        attachmentIcon.textContent =
            isImage
                ? "IMAGE"
                : "FILE";
    }

    function formatSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (
            bytes <
            1024 * 1024
        ) {
            return (
                (bytes / 1024)
                    .toFixed(1) +
                " KB"
            );
        }

        return (
            (bytes / 1024 / 1024)
                .toFixed(1) +
            " MB"
        );
    }

    function removeSelectedFile() {
        selectedImage = null;
        selectedFile = null;

        imageInput.value = "";
        fileInput.value = "";

        attachmentPreview.style.display =
            "none";
    }

    removeAttachment.addEventListener(
        "click",
        removeSelectedFile
    );
        newChatButton.addEventListener(
        "click",
        () => {
            createNewChat(true);
        }
    );

    topNewChat.addEventListener(
        "click",
        () => {
            createNewChat(true);
        }
    );

    document
        .querySelectorAll(
            ".suggestions button"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        input.value =
                            button.dataset
                                .prompt;

                        input.focus();

                        sendMessage();
                    }
                );
            }
        );

    searchChats.addEventListener(
        "input",
        () => {
            renderHistory(
                searchChats.value
            );
        }
    );

    settingsButton.addEventListener(
        "click",
        () => {
            settingsOverlay.classList.add(
                "show"
            );
        }
    );

    closeSettings.addEventListener(
        "click",
        () => {
            settingsOverlay.classList.remove(
                "show"
            );
        }
    );

    settingsOverlay.addEventListener(
        "click",
        (event) => {
            if (
                event.target ===
                settingsOverlay
            ) {
                settingsOverlay.classList.remove(
                    "show"
                );
            }
        }
    );

    themeToggle.addEventListener(
        "click",
        () => {
            themeToggle.classList.toggle(
                "active"
            );
        }
    );

    enterToggle.classList.toggle(
        "active",
        enterToSend
    );

    enterToggle.addEventListener(
        "click",
        () => {
            enterToSend =
                !enterToSend;

            enterToggle.classList.toggle(
                "active",
                enterToSend
            );

            localStorage.setItem(
                "jhonnyEnter",
                enterToSend
            );
        }
    );

    const savedFont =
        localStorage.getItem(
            "jhonnyFontSize"
        ) || "16";

    fontSizeSlider.value =
        savedFont;

    fontSizeLabel.textContent =
        `${savedFont}px`;

    document.documentElement.style.setProperty(
        "--message-size",
        `${savedFont}px`
    );

    fontSizeSlider.addEventListener(
        "input",
        () => {
            const size =
                fontSizeSlider.value;

            fontSizeLabel.textContent =
                `${size}px`;

            document.documentElement.style.setProperty(
                "--message-size",
                `${size}px`
            );

            localStorage.setItem(
                "jhonnyFontSize",
                size
            );
        }
    );

    mobileMenu.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle(
                "open"
            );
        }
    );

    function logout() {
        localStorage.removeItem(
            "jhonnyToken"
        );

        localStorage.removeItem(
            "jhonnyUser"
        );

        token = null;
        currentUser = null;
        currentChat = null;
        chats = [];

        conversation = [
            {
                role: "system",
                content:
                    "You are Jhonny, a helpful AI assistant. Give clear, accurate and useful answers."
            }
        ];

        messagesContainer.innerHTML = "";

        showAuth();
    }

    logoutButton.addEventListener(
        "click",
        logout
    );

    clearChat.addEventListener(
        "click",
        () => {
            if (
                !confirm(
                    "Clear this conversation?"
                )
            ) {
                return;
            }

            createNewChat(true);

            settingsOverlay.classList.remove(
                "show"
            );
        }
    );

    messagesContainer.addEventListener(
        "click",
        async (event) => {
            const button =
                event.target.closest(
                    ".code-copy-btn"
                );

            if (!button) return;

            const code =
                decodeURIComponent(
                    button.dataset.code
                );

            try {
                await navigator
                    .clipboard
                    .writeText(code);

                button.textContent =
                    "Copied!";

                setTimeout(
                    () => {
                        button.textContent =
                            "Copy";
                    },
                    1500
                );

            } catch {
                button.textContent =
                    "Failed";
            }
        }
    );

    renderHistory();
});
