class ChatApp {
    constructor() {
        this.conversations = JSON.parse(localStorage.getItem('conversations')) || [];
        this.currentConversationId = null;
        this.API_KEY = '8a663a96dbefdfc50fd018eb202f8a9b.qPnpvgwmRPSlZsaB';
        this.API_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        this.initializeElements();
        this.bindEvents();
        this.loadConversations();
    }

    initializeElements() {
        this.sidebar = document.getElementById('sidebar');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.chatHistory = document.getElementById('chatHistory');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
        this.currentChatTitle = document.getElementById('currentChatTitle');
        this.renameChatBtn = document.getElementById('renameChat');
        this.deleteChatBtn = document.getElementById('deleteChat');
    }

    bindEvents() {
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.messageInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        this.messageInput.addEventListener('input', () => this.adjustTextareaHeight());
        this.renameChatBtn.addEventListener('click', () => this.renameCurrentChat());
        this.deleteChatBtn.addEventListener('click', () => this.deleteCurrentChat());
    }

    createNewChat() {
        const conversation = {
            id: Date.now(),
            title: '新对话',
            messages: [],
            createdAt: new Date().toISOString()
        };
        this.conversations.unshift(conversation);
        this.saveConversations();
        this.loadConversations();
        this.switchToConversation(conversation.id);
    }

    loadConversations() {
        this.chatHistory.innerHTML = '';
        this.conversations.forEach(conv => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            if (conv.id === this.currentConversationId) {
                chatItem.classList.add('active');
            }
            chatItem.innerHTML = `
                <div>${conv.title}</div>
                <div style="font-size: 0.8em; color: #666;">
                    ${new Date(conv.createdAt).toLocaleString()}
                </div>
            `;
            chatItem.addEventListener('click', () => this.switchToConversation(conv.id));
            this.chatHistory.appendChild(chatItem);
        });
    }

    switchToConversation(id) {
        this.currentConversationId = id;
        const conversation = this.conversations.find(c => c.id === id);
        this.currentChatTitle.textContent = conversation.title;
        this.loadMessages(conversation);
        this.loadConversations();
        if (window.innerWidth <= 768) {
            this.toggleSidebar();
        }
    }

    loadMessages(conversation) {
        this.messagesContainer.innerHTML = '';
        conversation.messages.forEach(msg => {
            this.appendMessage(msg);
        });
        this.scrollToBottom();
    }

    appendMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        let content = message.content;
        if (message.role === 'ai') {
            content = marked.parse(content);
        }
        
        messageDiv.innerHTML = `
            <div class="content">${content}</div>
            <div class="time">${new Date(message.timestamp).toLocaleString()}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        
        // 代码高亮
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;

        if (!this.currentConversationId) {
            this.createNewChat();
        }

        const conversation = this.conversations.find(c => c.id === this.currentConversationId);
        const userMessage = {
            role: 'user',
            content,
            timestamp: new Date().toISOString()
        };

        conversation.messages.push(userMessage);
        this.appendMessage(userMessage);
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        this.saveConversations();
        this.scrollToBottom();

        // 模拟AI回复
        await this.simulateAIResponse(conversation);
    }

    generateToken() {
        try {
            const [id, secret] = this.API_KEY.split('.');
            
            // 创建 JWT header
            const header = {
                "alg": "HS256",
                "sign_type": "SIGN"
            };
            
            // 创建 JWT payload
            const payload = {
                "api_key": id,
                "exp": Math.floor(Date.now() / 1000) + 3600,
                "timestamp": Math.floor(Date.now() / 1000)
            };

            // Base64Url 编码 header 和 payload
            const encodeBase64Url = (str) => {
                return btoa(str)
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
            };

            const encodedHeader = encodeBase64Url(JSON.stringify(header));
            const encodedPayload = encodeBase64Url(JSON.stringify(payload));

            // 创建签名内容
            const signContent = encodedHeader + '.' + encodedPayload;

            // 使用 HMAC-SHA256 创建签名
            const signatureObj = new KJUR.crypto.Mac({alg: 'HmacSHA256', pass: secret});
            signatureObj.updateString(signContent);
            const signature = signatureObj.doFinal();

            // 将签名转换为 Base64Url
            const encodedSignature = encodeBase64Url(signature);

            // 组合最终的 JWT
            const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
            
            return token;
        } catch (error) {
            console.error('Token generation failed:', error);
            throw new Error('Token generation failed: ' + error.message);
        }
    }

    async simulateAIResponse(conversation) {
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message ai';
        typingIndicator.innerHTML = '<div class="typing">▋</div>';
        this.messagesContainer.appendChild(typingIndicator);
        this.scrollToBottom();

        try {
            const requestBody = {
                model: "glm-4",
                messages: conversation.messages.map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.content
                }))
            };

            const token = this.generateToken();
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const response = await fetch(this.API_ENDPOINT, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || response.statusText);
            }

            const data = await response.json();
            
            this.messagesContainer.removeChild(typingIndicator);

            const aiMessage = {
                role: 'ai',
                content: data.choices[0].message.content,
                timestamp: new Date().toISOString()
            };

            conversation.messages.push(aiMessage);
            this.appendMessage(aiMessage);
            this.saveConversations();
            this.scrollToBottom();

        } catch (error) {
            console.error('API调用错误:', error);
            
            this.messagesContainer.removeChild(typingIndicator);

            const errorMessage = {
                role: 'ai',
                content: '抱歉，发生了一些错误。请稍后再试。\n\n错误详情：' + error.message,
                timestamp: new Date().toISOString()
            };

            conversation.messages.push(errorMessage);
            this.appendMessage(errorMessage);
            this.saveConversations();
            this.scrollToBottom();
        }
    }

    handleInputKeydown(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    adjustTextareaHeight() {
        const textarea = this.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('show');
    }

    async renameCurrentChat() {
        if (!this.currentConversationId) return;
        
        const conversation = this.conversations.find(c => c.id === this.currentConversationId);
        const newTitle = prompt('请输入新的对话标题:', conversation.title);
        
        if (newTitle && newTitle.trim()) {
            conversation.title = newTitle.trim();
            this.currentChatTitle.textContent = newTitle;
            this.saveConversations();
            this.loadConversations();
        }
    }

    deleteCurrentChat() {
        if (!this.currentConversationId) return;
        
        if (confirm('确定要删除这个对话吗？')) {
            this.conversations = this.conversations.filter(c => c.id !== this.currentConversationId);
            this.saveConversations();
            this.currentConversationId = null;
            this.loadConversations();
            this.messagesContainer.innerHTML = '';
            this.currentChatTitle.textContent = '新对话';
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    saveConversations() {
        localStorage.setItem('conversations', JSON.stringify(this.conversations));
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
}); 