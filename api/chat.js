const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

let messages = [];

function addMessage(text, type) {
    const message = document.createElement("div");

    message.className = "message " + type;
    message.textContent = text;

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoading(loading) {
    sendButton.disabled = loading;
    sendButton.textContent = loading ? "Sending..." : "Send";
}

async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    addMessage(message, "user");

    messageInput.value = "";

    messages.push({
        role: "user",
        content: message
    });

    setLoading(true);

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Something went wrong"
            );
        }

        const reply = data.reply || "No response received.";

        messages.push({
            role: "assistant",
            content: reply
        });

        addMessage(reply, "assistant");

    } catch (error) {
        console.error("Chat Error:", error);

        addMessage(
            "Error: " + error.message,
            "assistant"
        );
    }

    setLoading(false);
    messageInput.focus();
}

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

messageInput.focus();        return res.status(200).json({
            reply: reply
        });


    } catch (error) {

        console.error(
            "Jhonny API Error:",
            error
        );


        return res.status(500).json({

            error:
                error?.message ||
                "Something went wrong."

        });

    }

}
