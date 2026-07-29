document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatWindow = document.getElementById('chatWindow');
    const typingIndicator = document.getElementById('typingIndicator');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const suggestionChips = document.querySelectorAll('.aiop-suggestion-chip');

    if (chatWindow) {
        // Load chat history on start
        loadChatHistory();

        // Register form submit handler
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text) return;

                // 1. Append user message
                appendMessage({
                    sender: 'user',
                    content: text,
                    created_at: new Date()
                });
                chatInput.value = '';

                // 2. Show typing indicator
                showTyping(true);

                try {
                    // 3. Post to API
                    const response = await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });
                    
                    const result = await response.json();
                    showTyping(false);

                    if (result.success) {
                        // 4. Append bot message
                        appendMessage(result.botMessage);
                    } else {
                        appendMessage({
                            sender: 'bot',
                            content: `Error: ${result.error || 'Failed to process message.'}`,
                            created_at: new Date()
                        });
                    }
                } catch (error) {
                    console.error('Chat error:', error);
                    showTyping(false);
                    appendMessage({
                        sender: 'bot',
                        content: 'Sorry, I am having trouble connecting to OPay support systems right now.',
                        created_at: new Date()
                    });
                }
            });
        }

        // Register clear chat handler
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('Are you sure you want to clear this chat session?')) return;
                
                try {
                    const response = await fetch('/api/chat/clear', { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                        chatWindow.innerHTML = '';
                        appendMessage({
                            sender: 'bot',
                            content: 'Chat session cleared. How can I assist you now?',
                            created_at: new Date()
                        });
                    } else {
                        alert(result.error || 'Failed to clear session.');
                    }
                } catch (error) {
                    console.error('Clear chat error:', error);
                    alert('Network error clearing chat session.');
                }
            });
        }

        // Suggestion chips handler
        suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                chatInput.value = chip.textContent;
                chatForm.dispatchEvent(new Event('submit'));
            });
        });
    }

    // Load conversation history from API
    async function loadChatHistory() {
        try {
            showTyping(true);
            const response = await fetch('/api/chat/history');
            const result = await response.json();
            showTyping(false);

            if (result.success && result.messages && result.messages.length > 0) {
                // Clear any starter UI messages and load actual log history
                chatWindow.innerHTML = '';
                result.messages.forEach(msg => {
                    appendMessage(msg);
                });
            }
        } catch (error) {
            console.error('Load history error:', error);
            showTyping(false);
        }
    }

    // Append single bubble helper
    function appendMessage(msg) {
        if (!chatWindow) return;

        const wrapper = document.createElement('div');
        wrapper.className = `d-flex mb-3 ${msg.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`;

        const bubble = document.createElement('div');
        bubble.className = `aiop-chat-bubble aiop-chat-bubble-${msg.sender === 'user' ? 'user' : (msg.sender === 'bot' ? 'bot' : 'agent')}`;
        
        const textPara = document.createElement('p');
        textPara.className = 'mb-0';
        textPara.textContent = msg.content;
        bubble.appendChild(textPara);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'aiop-timestamp';
        const dateObj = new Date(msg.created_at || msg.timestamp);
        timeSpan.textContent = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(timeSpan);

        wrapper.appendChild(bubble);
        chatWindow.appendChild(wrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Toggle typing indicator visibility
    function showTyping(visible) {
        if (!typingIndicator) return;
        typingIndicator.style.display = visible ? 'block' : 'none';
        if (visible && chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    }
});
