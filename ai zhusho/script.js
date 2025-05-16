// 文件管理相关变量
let uploadedFiles = [];
let currentFileIndex = -1;
let currentLanguage = 'javascript';
let currentErrors = [];
let ignoredErrors = [];
let currentErrorIndex = -1;

// 代码生成相关变量
let isCodeGenActive = false;

// 初始化代码编辑器功能
function initCodeEditor() {
    const codeTextarea = document.getElementById('code-textarea');
    const lineNumbers = document.getElementById('line-numbers');
    
    // 初始化行号
    updateLineNumbers();
    
    // 监听输入事件更新行号
    codeTextarea.addEventListener('input', () => {
        updateLineNumbers();
        // 当代码变更时，清除错误面板
        hideErrorPanel();
    });
    
    // 监听滚动事件同步行号和文本区域的滚动
    codeTextarea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = codeTextarea.scrollTop;
    });
    
    // 监听按键事件，处理Tab键和注释快捷键(Ctrl+/)
    codeTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeTextarea.selectionStart;
            const end = codeTextarea.selectionEnd;
            
            // 插入制表符（4个空格）
            codeTextarea.value = codeTextarea.value.substring(0, start) + '    ' + codeTextarea.value.substring(end);
            
            // 将光标移动到插入位置之后
            codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 4;
            
            // 更新行号
            updateLineNumbers();
        } else if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+/ 或 Command+/ 触发解释功能
            e.preventDefault();
            explainCode();
        }
    });
    
    // 添加右键菜单功能，用于引用选中的代码
    codeTextarea.addEventListener('contextmenu', (e) => {
        const selectedText = codeTextarea.value.substring(
            codeTextarea.selectionStart, 
            codeTextarea.selectionEnd
        );
        
        if (selectedText) {
            e.preventDefault();
            
            // 创建并显示上下文菜单
            showCodeContextMenu(e.clientX, e.clientY, selectedText);
        }
    });
    
    // 初始化编辑器按钮事件
    document.getElementById('run-btn').addEventListener('click', runCode);
    document.getElementById('save-btn').addEventListener('click', saveCode);
    document.getElementById('fix-error-btn').addEventListener('click', fixErrors);
    document.getElementById('toggle-editor-btn').addEventListener('click', toggleEditor);
    document.getElementById('explain-btn').addEventListener('click', explainCode);
    
    // 初始化错误面板关闭按钮
    document.getElementById('close-error-btn').addEventListener('click', hideErrorPanel);
    
    // 初始化语言选择下拉菜单
    document.getElementById('language-select').addEventListener('change', changeLanguage);
    
    // 初始化上传文件按钮
    document.getElementById('upload-file-btn').addEventListener('click', triggerFileUpload);
    
    // 初始化文件面板开关按钮事件
    document.getElementById('toggle-files-btn').addEventListener('click', toggleFilesCollapse);
    
    // 初始化错误面板
    initErrorPanel();
}

// 显示代码上下文菜单
function showCodeContextMenu(x, y, selectedText) {
    // 移除旧的上下文菜单（如果有）
    const oldMenu = document.getElementById('codeContextMenu');
    if (oldMenu) {
        document.body.removeChild(oldMenu);
    }
    
    // 创建新的上下文菜单
    const contextMenu = document.createElement('div');
    contextMenu.id = 'codeContextMenu';
    contextMenu.className = 'context-menu';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    
    // 添加引用选项
    const quoteOption = document.createElement('div');
    quoteOption.className = 'context-menu-item';
    quoteOption.textContent = '引用到对话框';
    quoteOption.addEventListener('click', () => {
        referCodeToChat(selectedText);
        hideCodeContextMenu();
    });
    
    // 添加解释选项
    const explainOption = document.createElement('div');
    explainOption.className = 'context-menu-item';
    explainOption.textContent = '获取代码解释';
    explainOption.addEventListener('click', () => {
        explainCode();
        hideCodeContextMenu();
    });
    
    contextMenu.appendChild(quoteOption);
    contextMenu.appendChild(explainOption);
    document.body.appendChild(contextMenu);
    
    // 点击其他地方关闭菜单
    document.addEventListener('click', hideCodeContextMenu);
}

// 隐藏代码上下文菜单
function hideCodeContextMenu() {
    const contextMenu = document.getElementById('codeContextMenu');
    if (contextMenu) {
        document.body.removeChild(contextMenu);
    }
    document.removeEventListener('click', hideCodeContextMenu);
}

// 将选中的代码引用到聊天框
function referCodeToChat(code) {
    const chatInput = document.getElementById('chat-input');
    const fileName = currentFileIndex !== -1 ? uploadedFiles[currentFileIndex].name : '未命名文件';
    
    // 获取当前光标位置
    const cursorPos = chatInput.selectionStart;
    
    // 构造引用文本
    const referText = `\n引用代码 (${fileName}):\n\`\`\`${currentLanguage}\n${code}\n\`\`\`\n`;
    
    // 在光标位置插入引用文本
    chatInput.value = 
        chatInput.value.substring(0, cursorPos) + 
        referText + 
        chatInput.value.substring(cursorPos);
    
    // 将光标移至引用文本之后
    const newCursorPos = cursorPos + referText.length;
    chatInput.selectionStart = chatInput.selectionEnd = newCursorPos;
    
    // 聚焦输入框
    chatInput.focus();
}

// 触发文件上传对话框
function triggerFileUpload() {
    document.getElementById('file-upload').click();
}

// 运行代码
function runCode() {
    const code = getEditorCode();
    if (!code.trim()) {
        displayMessage('bot', '请先编写代码后再运行。');
        return;
    }
    
    // 先检测错误
    const errors = detectErrors();
    
    // 如果有错误，显示错误面板
    if (errors.length > 0) {
        showErrorPanel(errors);
        displayMessage('bot', `检测到${errors.length}个潜在问题，请修复后再运行。`);
        return;
    }
    
    try {
        let result;
        
        // 根据不同语言执行不同操作
        switch (currentLanguage) {
            case 'javascript':
                // 尝试在沙盒中运行JavaScript代码
                result = evalInSandbox(code);
                break;
            case 'html':
                // 显示HTML预览
                showHtmlPreview(code);
                return;
            default:
                // 其他语言提示用户
                displayMessage('bot', `${currentLanguage} 代码需要在服务器端运行，此功能暂未实现。`);
                return;
        }
        
        // 显示执行结果
        displayMessage('bot', `执行结果：\n${result}`);
    } catch (error) {
        // 显示错误信息
        displayMessage('bot', `执行出错：\n${error.message}`);
    }
}

// 在沙盒中执行JavaScript代码
function evalInSandbox(code) {
    try {
        // 创建一个iframe作为沙盒
        const sandbox = document.createElement('iframe');
        sandbox.style.display = 'none';
        document.body.appendChild(sandbox);
        
        // 准备一个函数来捕获控制台输出
        const consoleOutput = [];
        const originalConsoleLog = console.log;
        console.log = function() {
            consoleOutput.push(Array.from(arguments).join(' '));
            originalConsoleLog.apply(console, arguments);
        };
        
        // 在沙盒环境中执行代码
        const result = sandbox.contentWindow.eval(code);
        
        // 恢复控制台输出
        console.log = originalConsoleLog;
        
        // 移除沙盒
        document.body.removeChild(sandbox);
        
        // 返回执行结果和控制台输出
        return (consoleOutput.length > 0 ? '控制台输出:\n' + consoleOutput.join('\n') + '\n\n' : '') + 
               (result !== undefined ? '返回值：\n' + String(result) : '代码执行成功');
    } catch (error) {
        throw error;
    }
}

// 显示HTML预览
function showHtmlPreview(htmlCode) {
    // 创建一个弹出窗口显示HTML预览
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(htmlCode);
    previewWindow.document.close();
}

// 保存代码
function saveCode() {
    const code = getEditorCode();
    
    if (!code.trim()) {
        displayMessage('bot', '没有可保存的代码。');
        return;
    }
    
    // 获取当前文件名或生成默认文件名
    const fileName = currentFileIndex !== -1 ? 
        uploadedFiles[currentFileIndex].name : 
        `code.${getExtensionByLanguage(currentLanguage)}`;
    
    // 创建一个Blob对象
    const blob = new Blob([code], { type: 'text/plain' });
    
    // 创建下载链接
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = fileName;
    
    // 触发下载
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // 显示保存成功消息
    displayMessage('bot', `代码已保存为 ${fileName}`);
}

// 根据语言获取文件扩展名
function getExtensionByLanguage(language) {
    const extensionMap = {
        'javascript': 'js',
        'html': 'html',
        'css': 'css',
        'python': 'py',
        'java': 'java'
    };
    
    return extensionMap[language] || 'txt';
}

// 切换语言
function changeLanguage(event) {
    currentLanguage = event.target.value;
    
    // 如果当前有文件选中，保存当前文件内容
    if (currentFileIndex !== -1) {
        uploadedFiles[currentFileIndex].content = getEditorCode();
    }
    
    // 更新编辑器显示
    updateEditorDisplay();
}

// 更新编辑器显示
function updateEditorDisplay() {
    const textarea = document.getElementById('code-textarea');
    
    // 如果有文件选中，显示文件内容
    if (currentFileIndex !== -1) {
        textarea.value = uploadedFiles[currentFileIndex].content;
    } else {
        // 否则显示示例代码
        textarea.value = getExampleCodeByLanguage(currentLanguage);
    }
    
    // 更新行号
    updateLineNumbers();
}

// 获取语言对应的示例代码
function getExampleCodeByLanguage(language) {
    switch (language) {
        case 'javascript':
            return '// 在这里编写 JavaScript 代码\nconsole.log("Hello, World!");';
        case 'html':
            return '<!DOCTYPE html>\n<html>\n<head>\n    <title>HTML 示例</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>';
        case 'css':
            return '/* 在这里编写 CSS 样式 */\nbody {\n    font-family: Arial, sans-serif;\n    color: #333;\n}';
        case 'python':
            return '# 在这里编写 Python 代码\nprint("Hello, World!")';
        case 'java':
            return '// 在这里编写 Java 代码\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}';
        default:
            return '// 在这里编写您的代码';
    }
}

// 切换编辑器显示/隐藏
function toggleEditor() {
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    
    if (centerPanel.style.display === 'none') {
        // 显示编辑器
        centerPanel.style.display = 'flex';
        rightPanel.style.width = '38%';
        document.getElementById('toggle-editor-btn').textContent = '隐藏编辑器';
    } else {
        // 隐藏编辑器
        centerPanel.style.display = 'none';
        rightPanel.style.width = '100%';
        document.getElementById('toggle-editor-btn').textContent = '显示编辑器';
    }
    
    // 保存编辑器显示状态
    localStorage.setItem('editorHidden', centerPanel.style.display === 'none');
}

// 加载编辑器状态
function loadEditorState() {
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    
    // 加载显示状态
    const isHidden = localStorage.getItem('editorHidden') === 'true';
    if (isHidden) {
        centerPanel.style.display = 'none';
        rightPanel.style.width = '100%';
        document.getElementById('toggle-editor-btn').textContent = '显示编辑器';
    }
}

// 更新行号
function updateLineNumbers() {
    const codeTextarea = document.getElementById('code-textarea');
    const lineNumbers = document.getElementById('line-numbers');
    
    // 计算行数
    const lines = codeTextarea.value.split('\n');
    const lineCount = lines.length;
    
    // 清空行号容器
    lineNumbers.innerHTML = '';
    
    // 添加行号
    for (let i = 1; i <= lineCount; i++) {
        const lineNumber = document.createElement('div');
        lineNumber.textContent = i;
        lineNumber.className = 'line-number';
        lineNumbers.appendChild(lineNumber);
    }
}

// 获取编辑器的代码内容
function getEditorCode() {
    return document.getElementById('code-textarea').value;
}

// 设置编辑器的代码内容
function setEditorCode(code) {
    document.getElementById('code-textarea').value = code;
    updateLineNumbers();
}

// 格式化消息文本
function formatMessage(text) {
    if (!text) return '';
    
    // 检查是否包含HTML标签（如代码解释）
    if (text.includes('<pre class="original-code">') || 
        text.includes('<div class="explanation-line">') ||
        text.includes('<p class="explanation-title">')) {
        // 如果包含HTML标签，直接返回
        return text;
    }
    
    // 处理标题和换行
    let lines = text.split('\n');
    let formattedLines = lines.map(line => {
        // 处理标题（**文本**）
        line = line.replace(/\*\*(.*?)\*\*/g, '<span class="bold-text">$1</span>');
        return line;
    });
    
    // 将 ### 替换为换行，并确保每个部分都是一个段落
    let processedText = formattedLines.join('\n');
    let sections = processedText
        .split('###')
        .filter(section => section.trim())
        .map(section => {
            // 移除多余的换行和空格
            let lines = section.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) return '';
            
            // 处理每个部分
            let result = '';
            let currentIndex = 0;
            
            while (currentIndex < lines.length) {
                let line = lines[currentIndex].trim();
                
                // 如果是数字开头（如 "1.")
                if (/^\d+\./.test(line)) {
                    result += `<p class="section-title">${line}</p>`;
                }
                // 如果是小标题（以破折号开头）
                else if (line.startsWith('-')) {
                    result += `<p class="subsection"><span class="bold-text">${line.replace(/^-/, '').trim()}</span></p>`;
                }
                // 如果是正文（包含冒号的行）
                else if (line.includes(':')) {
                    let [subtitle, content] = line.split(':').map(part => part.trim());
                    result += `<p><span class="subtitle">${subtitle}</span>: ${content}</p>`;
                }
                // 普通文本
                else {
                    result += `<p>${line}</p>`;
                }
                currentIndex++;
            }
            return result;
        });
    
    return sections.join('');
}

// 显示消息
function displayMessage(role, message) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}`;
    
    const avatar = document.createElement('img');
    avatar.src = role === 'user' ? 'user-avatar.png' : 'bot-avatar.png';
    avatar.alt = role === 'user' ? 'User' : 'Bot';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 检查消息是否包含代码解释或代码修复
    const isCodeExplanation = role === 'bot' && (
        message.includes('<p class="explanation-title">') ||
        message.includes('<pre class="original-code">') ||
        message.includes('<div class="fixed-code-container">') ||
        message.includes('<div class="fix-explanation">')
    );
    
    // 如果是代码解释或修复，使用更宽的布局
    if (isCodeExplanation) {
        messageContent.className += ' code-explanation-message';
        // 设置消息内容的最大宽度为更大的值，确保代码完整显示
        messageContent.style.maxWidth = '100%';
        messageContent.style.width = '100%';
    }
    
    // 用户消息直接显示，机器人消息需要格式化
    messageContent.innerHTML = role === 'user' ? message : formatMessage(message);

    messageElement.appendChild(avatar);
    messageElement.appendChild(messageContent);
    messagesContainer.appendChild(messageElement);
    
    // 如果是AI的消息，添加后续对话提示词
    if (role === 'bot') {
        addFollowUpPrompts(message);
    }
    
    // 平滑滚动到底部
    messageElement.scrollIntoView({ behavior: 'smooth' });
}

// 添加后续对话提示词
function addFollowUpPrompts(message) {
    const messagesContainer = document.getElementById('messages');
    const promptContainer = document.createElement('div');
    promptContainer.className = 'follow-up-prompts';
    
    // 根据消息内容生成相关的提示词
    const prompts = generateFollowUpPrompts(message);
    
    // 创建提示词按钮
    prompts.forEach(prompt => {
        const promptButton = document.createElement('button');
        promptButton.className = 'prompt-button';
        promptButton.textContent = prompt;
        promptButton.addEventListener('click', () => {
            // 将提示词填入输入框
            const chatInput = document.getElementById('chat-input');
            chatInput.value = prompt;
            chatInput.focus();
        });
        promptContainer.appendChild(promptButton);
    });
    
    // 将提示词容器添加到消息容器中
    messagesContainer.appendChild(promptContainer);
}

// 根据消息内容生成相关的提示词
function generateFollowUpPrompts(message) {
    const prompts = [];
    
    // 检查消息中是否包含代码
    if (message.includes('```')) {
        prompts.push('请详细解释这段代码的工作原理');
        prompts.push('这段代码有什么可以优化的地方？');
        prompts.push('这段代码可能存在哪些潜在问题？');
    }
    
    // 检查消息中是否包含错误信息
    if (message.toLowerCase().includes('error') || message.includes('错误')) {
        prompts.push('如何修复这个错误？');
        prompts.push('这个错误可能的原因是什么？');
        prompts.push('如何避免类似的错误？');
    }
    
    // 检查消息中是否包含解释
    if (message.includes('解释') || message.includes('说明')) {
        prompts.push('能举个具体的例子吗？');
        prompts.push('这个解释有什么实际应用场景？');
        prompts.push('还有其他相关的知识点吗？');
    }
    
    // 添加通用提示词
    prompts.push('请提供更多细节');
    prompts.push('能举个例子吗？');
    prompts.push('还有其他方法吗？');
    
    // 去重并限制数量
    return [...new Set(prompts)].slice(0, 5);
}

// 初始化文件上传功能
function initFileUpload() {
    const fileUpload = document.getElementById('file-upload');
    
    // 监听文件上传事件
    fileUpload.addEventListener('change', handleFileUpload);
}

// 处理文件上传
function handleFileUpload(event) {
    const files = event.target.files;
    
    if (files.length === 0) return;
    
    // 遍历每个上传的文件
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 创建文件对象
        const fileObj = {
            id: Date.now() + i, // 生成唯一ID
            name: file.name,
            content: '',
            type: getFileType(file.name)
        };
        
        // 读取文件内容
        const reader = new FileReader();
        reader.onload = function(e) {
            fileObj.content = e.target.result;
            // 添加到上传文件列表
            uploadedFiles.push(fileObj);
            // 更新文件列表显示
            renderFilesList();
            
            // 如果是第一个上传的文件，自动选中并显示
            if (uploadedFiles.length === 1) {
                selectFile(0);
            }
        };
        reader.readAsText(file);
    }
    
    // 重置上传控件
    event.target.value = '';
}

// 获取文件类型
function getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    const typeMap = {
        'js': 'javascript',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'ts': 'typescript',
        'md': 'markdown',
        'txt': 'text'
    };
    
    return typeMap[extension] || 'text';
}

// 渲染文件列表
function renderFilesList() {
    const filesList = document.getElementById('files-list');
    
    if (uploadedFiles.length === 0) {
        filesList.innerHTML = '<div class="empty-files-message">暂无文件，请上传</div>';
        return;
    }
    
    filesList.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = `file-item ${index === currentFileIndex ? 'active' : ''}`;
        fileItem.dataset.index = index;
        fileItem.innerHTML = `
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-delete" title="删除文件">×</div>
        `;
        
        // 添加选择文件的点击事件
        fileItem.querySelector('.file-name').addEventListener('click', () => {
            selectFile(index);
        });
        
        // 添加删除文件的点击事件
        fileItem.querySelector('.file-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFile(index);
        });
        
        filesList.appendChild(fileItem);
    });
}

// 选择文件
function selectFile(index) {
    if (index < 0 || index >= uploadedFiles.length) return;
    
    // 保存当前文件的内容（如果有）
    if (currentFileIndex !== -1) {
        uploadedFiles[currentFileIndex].content = getEditorCode();
    }
    
    currentFileIndex = index;
    const selectedFile = uploadedFiles[index];
    
    // 更新编辑器内容
    setEditorCode(selectedFile.content);
    
    // 更新文件名显示
    document.getElementById('current-file-name').textContent = selectedFile.name;
    
    // 更新文件列表的激活状态
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.index) === index) {
            item.classList.add('active');
        }
    });
}

// 删除文件
function deleteFile(index) {
    if (index < 0 || index >= uploadedFiles.length) return;
    
    // 移除文件
    uploadedFiles.splice(index, 1);
    
    // 如果删除的是当前选中的文件
    if (index === currentFileIndex) {
        currentFileIndex = -1;
        setEditorCode('');
        document.getElementById('current-file-name').textContent = '代码编辑器';
        
        // 如果还有其他文件，选择第一个
        if (uploadedFiles.length > 0) {
            selectFile(0);
        }
    } else if (index < currentFileIndex) {
        // 如果删除的文件位于当前文件之前，更新当前文件索引
        currentFileIndex--;
    }
    
    // 更新文件列表
    renderFilesList();
}

// 文件面板折叠/展开切换
function toggleFilesCollapse() {
    const filesPanel = document.getElementById('files-panel');
    filesPanel.classList.toggle('files-collapsed');
    
    // 保存文件面板状态
    localStorage.setItem('filesCollapsed', filesPanel.classList.contains('files-collapsed'));
}

// 上传面板显示/隐藏切换
function toggleUploadPanel() {
    const uploadPanel = document.getElementById('upload-panel');
    uploadPanel.classList.toggle('hidden-upload-panel');
    
    // 保存上传面板显示状态
    localStorage.setItem('uploadPanelHidden', uploadPanel.classList.contains('hidden-upload-panel'));
}

// 加载文件面板状态
function loadFilesPanelState() {
    const filesPanel = document.getElementById('files-panel');
    
    // 加载显示状态
    const isHidden = localStorage.getItem('filesPanelHidden') === 'true';
    if (isHidden) {
        filesPanel.classList.add('hidden-files-panel');
    }
    
    // 加载折叠状态
    const isCollapsed = localStorage.getItem('filesCollapsed') === 'true';
    if (isCollapsed) {
        filesPanel.classList.add('files-collapsed');
    }
}

// 加载上传面板状态
function loadUploadPanelState() {
    const uploadPanel = document.getElementById('upload-panel');
    
    // 加载显示状态
    const isHidden = localStorage.getItem('uploadPanelHidden') === 'true';
    if (isHidden) {
        uploadPanel.classList.add('hidden-upload-panel');
    }
}

// 显示错误面板
function showErrorPanel(errors) {
    currentErrors = errors;
    currentErrorIndex = -1;
    const errorPanel = document.getElementById('error-panel');
    const errorContent = document.getElementById('error-content');
    const errorCount = document.getElementById('error-count');
    
    if (!errorPanel || !errorContent) return;
    
    // 清空错误内容
    errorContent.innerHTML = '';
    
    // 更新错误计数
    if (errorCount) {
        const errorsByLevel = countErrorsByLevel(errors);
        errorCount.innerHTML = `
            <span class="error-count error">${errorsByLevel.error}</span> 
            <span class="error-count warning">${errorsByLevel.warning}</span> 
            <span class="error-count info">${errorsByLevel.info}</span>
        `;
    }
    
    // 添加错误导航按钮
    const navContainer = document.createElement('div');
    navContainer.className = 'error-nav';
    
    const prevButton = document.createElement('button');
    prevButton.className = 'error-nav-btn';
    prevButton.innerHTML = '&lt; 上一个';
    prevButton.addEventListener('click', navigateToPreviousError);
    
    const nextButton = document.createElement('button');
    nextButton.className = 'error-nav-btn';
    nextButton.innerHTML = '下一个 &gt;';
    nextButton.addEventListener('click', navigateToNextError);
    
    navContainer.appendChild(prevButton);
    navContainer.appendChild(nextButton);
    errorContent.appendChild(navContainer);
    
    // 添加错误信息
    if (errors.length === 0) {
        errorContent.innerHTML += '<div class="no-errors">没有发现错误</div>';
    } else {
        // 按严重性排序错误
        const sortedErrors = [...errors].sort((a, b) => {
            const severityOrder = { error: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        
        // 过滤掉被忽略的错误
        const filteredErrors = sortedErrors.filter(error => 
            !isErrorIgnored(error)
        );
        
        // 显示错误
        filteredErrors.forEach((error, index) => {
            const errorLine = document.createElement('div');
            errorLine.className = `error-line severity-${error.severity}`;
            errorLine.dataset.index = index;
            errorLine.dataset.line = error.line;
            errorLine.dataset.id = error.id || `error_${error.line}_${index}`;
            
            const severityIcon = getSeverityIcon(error.severity);
            
            errorLine.innerHTML = `
                <span class="error-severity ${error.severity}">${severityIcon}</span>
                <span class="error-line-number">第 ${error.line} 行:</span> 
                <span class="error-message">${error.message}</span>
                <div class="error-actions">
                    <button class="error-ignore-btn" title="忽略此错误">忽略</button>
                    <button class="error-quote-btn" title="引用到对话框">引用</button>
                </div>
            `;
            
            // 点击错误行时，高亮对应的代码行
            errorLine.querySelector('.error-line-number, .error-message').addEventListener('click', () => {
                currentErrorIndex = index;
                highlightErrorLine(error.line, index);
            });
            
            // 点击引用按钮时，将错误信息引用到聊天框
            errorLine.querySelector('.error-quote-btn').addEventListener('click', () => {
                referErrorToChat(error);
            });
            
            // 点击忽略按钮时，忽略此错误
            errorLine.querySelector('.error-ignore-btn').addEventListener('click', () => {
                ignoreError(error);
                errorLine.classList.add('ignored');
                // 更新错误计数
                if (errorCount) {
                    const newErrorsByLevel = countErrorsByLevel(currentErrors.filter(e => !isErrorIgnored(e)));
                    errorCount.innerHTML = `
                        <span class="error-count error">${newErrorsByLevel.error}</span> 
                        <span class="error-count warning">${newErrorsByLevel.warning}</span> 
                        <span class="error-count info">${newErrorsByLevel.info}</span>
                    `;
                }
            });
            
            errorContent.appendChild(errorLine);
        });
    }
    
    // 显示错误面板
    errorPanel.classList.add('show');
}

// 获取错误严重性图标
function getSeverityIcon(severity) {
    switch (severity) {
        case 'error':
            return '✕';
        case 'warning':
            return '⚠';
        case 'info':
            return 'ℹ';
        default:
            return '';
    }
}

// 计算各级别错误数量
function countErrorsByLevel(errors) {
    const counts = {
        error: 0,
        warning: 0,
        info: 0
    };
    
    errors.forEach(error => {
        if (!isErrorIgnored(error)) {
            counts[error.severity] = (counts[error.severity] || 0) + 1;
        }
    });
    
    return counts;
}

// 导航到下一个错误
function navigateToNextError() {
    if (!currentErrors || currentErrors.length === 0) return;
    
    const filteredErrors = currentErrors.filter(error => !isErrorIgnored(error));
    if (filteredErrors.length === 0) return;
    
    currentErrorIndex = (currentErrorIndex + 1) % filteredErrors.length;
    const error = filteredErrors[currentErrorIndex];
    
    highlightErrorLine(error.line, currentErrorIndex);
    highlightErrorInPanel(currentErrorIndex);
}

// 导航到上一个错误
function navigateToPreviousError() {
    if (!currentErrors || currentErrors.length === 0) return;
    
    const filteredErrors = currentErrors.filter(error => !isErrorIgnored(error));
    if (filteredErrors.length === 0) return;
    
    currentErrorIndex = (currentErrorIndex - 1 + filteredErrors.length) % filteredErrors.length;
    const error = filteredErrors[currentErrorIndex];
    
    highlightErrorLine(error.line, currentErrorIndex);
    highlightErrorInPanel(currentErrorIndex);
}

// 高亮错误面板中的错误
function highlightErrorInPanel(errorIndex) {
    const errorLines = document.querySelectorAll('.error-line');
    errorLines.forEach(line => {
        line.classList.remove('active');
        if (line.dataset.index == errorIndex) {
            line.classList.add('active');
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

// 高亮代码中的错误行
function highlightErrorLine(lineNumber, errorIndex) {
    const codeTextarea = document.getElementById('code-textarea');
    const lines = codeTextarea.value.split('\n');
    
    if (lineNumber <= 0 || lineNumber > lines.length) {
        return;
    }
    
    // 计算行的开始和结束位置
    let startPos = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
        startPos += lines[i].length + 1; // +1 表示换行符
    }
    
    const endPos = startPos + lines[lineNumber - 1].length;
    
    // 设置选择范围
    codeTextarea.focus();
    codeTextarea.setSelectionRange(startPos, endPos);
    
    // 确保选中的行可见
    const lineHeight = 20; // 每行的高度（与CSS中保持一致）
    const padding = 10; // 文本区域的内边距
    codeTextarea.scrollTop = (lineNumber - 1) * lineHeight - codeTextarea.clientHeight / 2 + padding;
    
    // 高亮错误面板中对应的错误
    highlightErrorInPanel(errorIndex);
}

// 忽略错误
function ignoreError(error) {
    const errorId = error.id || `error_${error.line}_${error.message}`;
    const filename = currentFileIndex !== -1 ? uploadedFiles[currentFileIndex].name : 'unknown';
    
    // 创建完整的错误标识
    const fullErrorId = {
        id: errorId,
        filename: filename,
        line: error.line,
        message: error.message,
        type: error.type,
        severity: error.severity
    };
    
    // 添加到忽略列表
    ignoredErrors.push(fullErrorId);
    
    // 保存到本地存储
    saveIgnoredErrors();
}

// 检查错误是否被忽略
function isErrorIgnored(error) {
    const errorId = error.id || `error_${error.line}_${error.message}`;
    const filename = currentFileIndex !== -1 ? uploadedFiles[currentFileIndex].name : 'unknown';
    
    return ignoredErrors.some(ignored => 
        ignored.id === errorId || 
        (ignored.filename === filename && 
         ignored.line === error.line && 
         ignored.message === error.message)
    );
}

// 保存忽略的错误到本地存储
function saveIgnoredErrors() {
    localStorage.setItem('ignoredErrors', JSON.stringify(ignoredErrors));
}

// 加载忽略的错误
function loadIgnoredErrors() {
    const saved = localStorage.getItem('ignoredErrors');
    if (saved) {
        ignoredErrors = JSON.parse(saved);
    }
}

// 初始化错误面板控制
function initErrorPanel() {
    loadIgnoredErrors();
    
    // 添加清除所有忽略项的按钮
    const errorHeader = document.querySelector('.error-header');
    if (errorHeader) {
        const clearIgnoresBtn = document.createElement('button');
        clearIgnoresBtn.className = 'clear-ignores-btn';
        clearIgnoresBtn.textContent = '清除忽略';
        clearIgnoresBtn.title = '清除所有忽略的错误';
        clearIgnoresBtn.addEventListener('click', () => {
            ignoredErrors = [];
            saveIgnoredErrors();
            
            // 重新检测错误并更新错误面板
            const errors = detectErrors();
            showErrorPanel(errors);
        });
        
        errorHeader.insertBefore(clearIgnoresBtn, errorHeader.querySelector('.close-error-btn'));
    }
}

// 隐藏错误面板
function hideErrorPanel() {
    const errorPanel = document.getElementById('error-panel');
    if (errorPanel) {
        errorPanel.classList.remove('show');
    }
    currentErrors = [];
    currentErrorIndex = -1;
}

// 检测代码错误
function detectErrors() {
    const code = getEditorCode();
    if (!code.trim()) {
        return [];
    }
    
    let errors = [];
    
    switch (currentLanguage) {
        case 'javascript':
            errors = detectJavaScriptErrors(code);
            break;
        case 'html':
            errors = detectHtmlErrors(code);
            break;
        case 'css':
            errors = detectCssErrors(code);
            break;
        case 'python':
            // Python错误检测需要服务器支持
            displayMessage('bot', '由于浏览器限制，Python错误检测需要服务器支持，目前尚未实现。');
            break;
        case 'java':
            // Java错误检测需要服务器支持
            displayMessage('bot', '由于浏览器限制，Java错误检测需要服务器支持，目前尚未实现。');
            break;
        default:
            displayMessage('bot', `暂不支持${currentLanguage}的错误检测。`);
    }
    
    return errors;
}

// 检测JavaScript错误
function detectJavaScriptErrors(code) {
    const errors = [];
    
    try {
        // 尝试通过Function构造函数解析代码
        // 这只会检查语法错误，不会执行代码
        new Function(code);
    } catch (error) {
        // 解析错误信息
        const errorMessage = error.message;
        const lineMatch = errorMessage.match(/line\s+(\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1]) : 1;
        
        errors.push({
            line: line,
            message: errorMessage.replace(/^.+?:\s*/, ''), // 移除前缀，只保留错误描述
            type: 'syntax',
            severity: 'error',
            id: `syntax_error_${line}`
        });
    }
    
    // 常见逻辑错误和最佳实践检查
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // 检查未声明的变量（简化版，仅作示例）
        if (line.match(/\b(let|const|var)\s+\w+\s*=\s*\w+/) && !line.match(/\b(let|const|var)\s+\w+\s*=\s*(document|window|console)\b/)) {
            const varName = line.match(/\b(let|const|var)\s+(\w+)/)[2];
            const valueMatch = line.match(/\b(let|const|var)\s+\w+\s*=\s*(\w+)/);
            if (valueMatch && !valueMatch[2].match(/^(true|false|null|undefined|\d+)$/)) {
                errors.push({
                    line: lineNum,
                    message: `可能使用了未声明的变量: ${valueMatch[2]}`,
                    type: 'logical',
                    severity: 'warning',
                    id: `undeclared_var_${lineNum}`
                });
            }
        }
        
        // 检查遗漏的分号（仅在非代码块结束行）
        if (!line.match(/[{}\[\]]$/) && !line.match(/;$/) && line.trim() !== '' && !line.match(/^\s*\/\//) && !line.match(/^\s*for\s*\(/)) {
            errors.push({
                line: lineNum,
                message: '可能遗漏了分号',
                type: 'style',
                severity: 'info',
                id: `missing_semicolon_${lineNum}`
            });
        }
        
        // 检查console.log (开发调试代码)
        if (line.match(/console\.log/)) {
            errors.push({
                line: lineNum,
                message: '生产代码中应移除console.log语句',
                type: 'bestpractice',
                severity: 'info',
                id: `console_log_${lineNum}`
            });
        }
    });
    
    return errors;
}

// 检测HTML错误
function detectHtmlErrors(code) {
    const errors = [];
    const lines = code.split('\n');
    
    // 简单的标签平衡检查
    const openTags = [];
    const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // 提取所有标签
        const tagMatches = line.match(/<\/?[a-z][a-z0-9]*(?:\s+[^>]*)?>/gi) || [];
        
        tagMatches.forEach(tag => {
            // 解析标签名
            const tagNameMatch = tag.match(/<\/?([a-z][a-z0-9]*)/i);
            if (!tagNameMatch) return;
            
            const tagName = tagNameMatch[1].toLowerCase();
            const isClosingTag = tag.startsWith('</');
            const isSelfClosing = selfClosingTags.includes(tagName) || tag.endsWith('/>');
            
            if (isClosingTag) {
                // 检查是否有匹配的开始标签
                if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
                    errors.push({
                        line: lineNum,
                        message: `关闭标签 </${tagName}> 没有匹配的开始标签`,
                        type: 'syntax',
                        severity: 'error',
                        id: `unmatched_closing_tag_${lineNum}`
                    });
                } else {
                    openTags.pop();
                }
            } else if (!isSelfClosing) {
                openTags.push(tagName);
            }
        });
        
        // 检查常见HTML错误
        if (line.match(/style\s*=\s*"[^"]*"/i)) {
            errors.push({
                line: lineNum,
                message: '建议将内联样式移到CSS文件中',
                type: 'bestpractice',
                severity: 'info',
                id: `inline_style_${lineNum}`
            });
        }
        
        if (line.match(/onclick\s*=\s*"[^"]*"/i)) {
            errors.push({
                line: lineNum,
                message: '建议将内联事件处理器移到JavaScript文件中',
                type: 'bestpractice',
                severity: 'info',
                id: `inline_event_${lineNum}`
            });
        }
    });
    
    // 检查未关闭的标签
    openTags.forEach(tag => {
        errors.push({
            line: lines.length,
            message: `标签 <${tag}> 未闭合`,
            type: 'syntax',
            severity: 'error',
            id: `unclosed_tag_${tag}`
        });
    });
    
    return errors;
}

// 检测CSS错误
function detectCssErrors(code) {
    const errors = [];
    const lines = code.split('\n');
    
    let inRule = false;
    let bracketCount = 0;
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // 检查括号是否平衡
        for (const char of line) {
            if (char === '{') bracketCount++;
            if (char === '}') bracketCount--;
        }
        
        // 检查分号缺失
        if (inRule && !line.match(/^\s*}/) && !line.match(/;\s*$/) && line.match(/:/)) {
            errors.push({
                line: lineNum,
                message: '可能遗漏了分号',
                type: 'syntax',
                severity: 'warning',
                id: `missing_semicolon_css_${lineNum}`
            });
        }
        
        // 更新规则状态
        if (line.includes('{')) inRule = true;
        if (line.includes('}')) inRule = false;
        
        // 检查过时的属性
        if (line.match(/\bfilter\s*:/)) {
            errors.push({
                line: lineNum,
                message: 'filter属性可能需要添加前缀或使用现代替代方案',
                type: 'compatibility',
                severity: 'warning',
                id: `outdated_filter_${lineNum}`
            });
        }
        
        // 检查!important（通常应避免使用）
        if (line.match(/!important/)) {
            errors.push({
                line: lineNum,
                message: '避免使用!important，应该提高选择器优先级',
                type: 'bestpractice',
                severity: 'info',
                id: `important_usage_${lineNum}`
            });
        }
    });
    
    // 检查括号不平衡
    if (bracketCount !== 0) {
        errors.push({
            line: lines.length,
            message: '花括号不平衡，检查是否缺少开始或结束花括号',
            type: 'syntax',
            severity: 'error',
            id: `unbalanced_brackets`
        });
    }
    
    return errors;
}

// 修复代码错误
function fixErrors() {
    // 先检测错误
    const errors = detectErrors();
    if (errors.length === 0) {
        displayMessage('bot', '未检测到需要修复的错误。');
        return;
    }
    
    // 显示错误面板
    showErrorPanel(errors);
    
    // 向AI请求修复建议
    requestFixSuggestions(errors);
}

// 向AI请求修复建议
function requestFixSuggestions(errors) {
    const code = getEditorCode();
    if (!code.trim()) return;
    
    const errorMessages = errors.map(err => `第${err.line}行 [${err.severity}]: ${err.message}`).join('\n');
    
    // 显示加载动画
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    
    const apiKey = 'sk-4d74d15fe0c54990bbe2c75851f570ca';
    const endpoint = 'https://api.deepseek.com/chat/completions';
    
    // 在聊天框中显示错误信息
    displayMessage('user', `请帮我修复以下代码中的错误：\n\n错误信息：\n${errorMessages}\n\n\`\`\`${currentLanguage}\n${code}\n\`\`\``);
    
    // 准备请求负载
    const payload = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: "你是一位专业的代码审查专家，擅长发现和修复代码错误。请提供简洁明了的修复建议，直接给出修复后的代码。在回复中，请先简要说明问题和修复方案，然后给出完整的修复后代码，使用代码块标记。" },
            { role: "user", content: `请帮我修复以下${currentLanguage}代码中的错误：\n\n错误信息：\n${errorMessages}\n\n代码：\n\`\`\`${currentLanguage}\n${code}\n\`\`\`\n\n请直接给出修复后的完整代码，并简要说明所做的修改。` }
        ],
        stream: false,
        max_tokens: 8000,
        temperature: 0.2
    };
    
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        if (data.choices && data.choices.length > 0) {
            const responseContent = data.choices[0].message.content;
            
            // 尝试提取代码块
            const codeBlockMatch = responseContent.match(/```(?:.*?)\n([\s\S]*?)```/);
            let fixedCode = codeBlockMatch ? codeBlockMatch[1] : null;
            
            // 在对话框中显示修复建议，包括完整的修复后代码
            displayMessage('bot', formatFixedCodeResponse(responseContent, code, fixedCode));
                
                // 添加"应用修复"按钮
                addApplyFixButton(fixedCode);
        } else {
            displayMessage('bot', '获取修复建议失败，请稍后再试。');
        }
    })
    .catch(error => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        displayMessage('bot', '获取修复建议时出错，请稍后再试。');
        console.error('Error:', error);
    });
}

// 格式化修复后代码的响应
function formatFixedCodeResponse(response, originalCode, fixedCode) {
    // 如果没有提取到代码块，直接返回原始响应
    if (!fixedCode) {
        return response;
    }
    
    // 提取解释部分（代码块之前的内容）
    let explanation = response.split('```')[0].trim();
    
    // 构建格式化的响应
    let formattedResponse = `<div class="fix-explanation">${explanation}</div>`;
    
    // 比较原始代码和修复后的代码
    const diffResult = generateCodeDiff(originalCode, fixedCode);
    
    // 添加对比视图
    formattedResponse += `
    <div class="code-diff-container">
        <div class="diff-header">
            <span class="diff-title">代码修复对比</span>
            <div class="diff-legend">
                <span class="diff-removed-line">删除</span>
                <span class="diff-added-line">添加</span>
                <span class="diff-unchanged-line">未变</span>
            </div>
        </div>
        <div class="code-diff">${diffResult}</div>
    </div>
    <div class="fixed-code-container">
        <div class="fixed-code-header">修复后完整代码</div>
        <pre class="fixed-code"><code class="language-${currentLanguage}">${escapeHtml(fixedCode)}</code></pre>
    </div>`;
    
    return formattedResponse;
}

// 生成代码差异
function generateCodeDiff(oldCode, newCode) {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    let diffHtml = '';
    
    // 使用简单的行比较算法
    const maxLines = Math.max(oldLines.length, newLines.length);
    let diffCount = 0;
    
    for (let i = 0; i < maxLines; i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : null;
        const newLine = i < newLines.length ? newLines[i] : null;
        
        if (oldLine === newLine) {
            // 相同行，只显示一个
            if (oldLine !== null) {
                diffHtml += `<div class="diff-line unchanged"><span class="line-number">${i+1}</span><span class="line-content">${escapeHtml(oldLine)}</span></div>`;
            }
        } else {
            diffCount++;
            // 不同行，显示删除和添加
            if (oldLine !== null) {
                diffHtml += `<div class="diff-line removed"><span class="line-number">${i+1}</span><span class="line-content">${escapeHtml(oldLine)}</span></div>`;
            }
            if (newLine !== null) {
                diffHtml += `<div class="diff-line added"><span class="line-number">${i+1}</span><span class="line-content">${escapeHtml(newLine)}</span></div>`;
            }
        }
        
        // 如果差异非常多（超过100行），只省略中间部分
        if (diffCount > 100 && i < maxLines - 15 && maxLines > 150) {
            diffHtml += `<div class="diff-line ellipsis">... 省略 ${maxLines - i - 15} 行 ...</div>`;
            i = maxLines - 15 - 1; // 跳到末尾的15行
            diffCount = 0;
        }
    }
    
    return diffHtml;
}

// HTML转义函数
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 添加"应用修复"按钮
function addApplyFixButton(fixedCode) {
    if (!fixedCode) return;
    
    const messagesContainer = document.getElementById('messages');
    const lastMessage = messagesContainer.lastElementChild;
    
    if (lastMessage && lastMessage.classList.contains('message') && lastMessage.classList.contains('bot')) {
        // 检查是否已有"应用修复"按钮
        if (lastMessage.querySelector('.apply-fix-btn')) {
            return;
        }
        
        // 创建按钮
        const applyFixBtn = document.createElement('button');
        applyFixBtn.className = 'apply-fix-btn';
        applyFixBtn.textContent = '应用修复';
        applyFixBtn.addEventListener('click', () => {
            applyFixedCode(fixedCode);
        });
        
        // 添加按钮到消息中
        lastMessage.querySelector('.message-content').appendChild(document.createElement('br'));
        lastMessage.querySelector('.message-content').appendChild(applyFixBtn);
    }
}

// 应用修复后的代码
function applyFixedCode(fixedCode) {
    // 保存当前编辑器滚动位置
    const codeTextarea = document.getElementById('code-textarea');
    const scrollTop = codeTextarea.scrollTop;
    
    // 设置修复后的代码
    setEditorCode(fixedCode);
    
    // 恢复滚动位置
    codeTextarea.scrollTop = scrollTop;
    
    // 隐藏错误面板
    hideErrorPanel();
    
    // 显示成功消息
    displayMessage('bot', '已应用修复建议。');
}

// 添加主题切换功能
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    
    // 同时切换容器的深色模式
    document.querySelectorAll('.editor-container, .chat-container, .messages').forEach(el => {
        el.classList.toggle('dark-mode');
    });
    
    // 保存主题设置
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

// 初始化代码生成与补全功能
function initCodeGeneration() {
    const codeGenBtn = document.getElementById('code-gen-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (!codeGenBtn || !chatInput) return;
    
    // 设置按钮标题
    codeGenBtn.title = '代码生成与补全 (点击显示提示词)';
    
    // 创建提示词菜单
    const promptMenu = document.createElement('div');
    promptMenu.className = 'prompt-menu';
    promptMenu.id = 'prompt-menu';
    
    // 常用代码生成提示词列表
    const promptOptions = [
        { id: 'function', text: '生成代码：实现一个函数，功能是' },
        { id: 'class', text: '生成代码：创建一个类，用于' },
        { id: 'algorithm', text: '生成代码：实现算法，要求' },
        { id: 'ui', text: '生成代码：创建UI组件，要求' },
        { id: 'api', text: '生成代码：编写API接口，功能是' },
        { id: 'debug', text: '生成代码：修复以下问题' },
        { id: 'optimize', text: '生成代码：优化以下代码' },
        { id: 'test', text: '生成代码：为以下代码编写测试' }
    ];
    
    // 添加提示词选项
    promptOptions.forEach(option => {
        const promptItem = document.createElement('div');
        promptItem.className = 'prompt-item';
        promptItem.textContent = option.text.replace('生成代码：', '');
        
        // 点击提示词时添加到输入框
        promptItem.addEventListener('click', () => {
            chatInput.value = option.text + ' ';
            promptMenu.classList.remove('show');
            
            // 聚焦输入框并将光标移到末尾
            chatInput.focus();
            chatInput.selectionStart = chatInput.selectionEnd = chatInput.value.length;
        });
        
        promptMenu.appendChild(promptItem);
    });
    
    // 将菜单添加到聊天容器
    document.querySelector('.input-container').appendChild(promptMenu);
    
    // 点击按钮显示/隐藏提示词菜单
    codeGenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptMenu.classList.toggle('show');
    });
    
    // 点击其他地方关闭菜单
    document.addEventListener('click', () => {
        promptMenu.classList.remove('show');
    });
    
    // 设置输入框提示
    chatInput.placeholder = '描述你需要生成的代码功能...';
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化文件上传功能
    initFileUpload();
    
    // 初始化代码编辑器
    initCodeEditor();
    
    // 加载编辑器状态
    loadEditorState();
    
    // 加载文件面板状态
    loadFilesPanelState();
    
    // 加载上传面板状态
    loadUploadPanelState();
    
    // 渲染初始文件列表
    renderFilesList();
    
    // 更新编辑器显示
    updateEditorDisplay();
    
    // 初始化代码生成功能
    initCodeGeneration();
    
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.querySelectorAll('.left-panel, .center-panel, .right-panel, .upload-panel, .files-panel, .chat-container, .messages').forEach(el => {
            el.classList.add('dark-mode');
        });
    }
});

// 修改sendMessage函数，优化代码生成提示词处理
function sendMessage() {
    const inputElement = document.getElementById('chat-input');
    const message = inputElement.value;
    if (!message.trim()) return;

    // 获取当前编辑器的代码
    const code = getEditorCode();
    
    // 获取当前文件信息
    const fileInfo = currentFileIndex !== -1 ? 
        `文件名: ${uploadedFiles[currentFileIndex].name}\n` : '';
    
    // 将用户消息显示在聊天框中
    displayMessage('user', message);
    inputElement.value = '';

    // 显示加载动画
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }

    const apiKey = 'sk-4d74d15fe0c54990bbe2c75851f570ca';
    const endpoint = 'https://api.deepseek.com/chat/completions';

    // 检测消息是否包含代码生成前缀
    let promptPrefix = '';
    let userMessage = message;
    let systemPrompt = "你是一位专业的编程助手，擅长根据用户需求生成高质量、可运行的代码，并提供清晰的代码解释。";
    
    if (message.startsWith('生成代码：')) {
        userMessage = message.substring('生成代码：'.length).trim();
        
        // 根据不同类型的提示词优化系统提示
        if (message.includes('实现一个函数')) {
            promptPrefix = '请实现一个高质量、可复用的函数，根据以下需求：';
            systemPrompt = "你是一位函数设计专家，擅长编写高效、可读性强、符合最佳实践的函数。你的代码应该包含适当的参数验证、错误处理和详细的注释。";
        } else if (message.includes('创建一个类')) {
            promptPrefix = '请设计并实现一个符合面向对象原则的类，根据以下需求：';
            systemPrompt = "你是一位面向对象编程专家，擅长设计遵循SOLID原则的类结构。你的代码应该包含清晰的接口、合理的封装和详细的文档。";
        } else if (message.includes('实现算法')) {
            promptPrefix = '请实现一个高效、正确的算法，根据以下需求：';
            systemPrompt = "你是一位算法专家，擅长实现高效、正确的算法解决方案。你的代码应该考虑时间和空间复杂度，并包含详细的算法解释。";
        } else if (message.includes('创建UI组件')) {
            promptPrefix = '请实现一个优雅、用户友好的UI组件，根据以下需求：';
            systemPrompt = "你是一位前端UI开发专家，擅长创建美观、响应式、易用的UI组件。你的代码应该考虑不同屏幕尺寸、可访问性和用户体验。";
        } else if (message.includes('编写API接口')) {
            promptPrefix = '请实现一个符合RESTful风格的API接口，根据以下需求：';
            systemPrompt = "你是一位API设计专家，擅长创建符合RESTful原则的API接口。你的代码应该包含适当的错误处理、输入验证和详细的API文档。";
        } else if (message.includes('修复以下问题')) {
            promptPrefix = '请分析并修复以下代码中的问题：';
            systemPrompt = "你是一位代码调试专家，擅长发现并修复代码中的错误和问题。你会先分析问题根源，然后提供修复方案和改进建议。";
        } else if (message.includes('优化以下代码')) {
            promptPrefix = '请优化以下代码，提高其性能、可读性和可维护性：';
            systemPrompt = "你是一位代码优化专家，擅长重构和优化代码。你会分析现有代码，并提供更高效、更简洁、更易维护的实现方式。";
        } else if (message.includes('编写测试')) {
            promptPrefix = '请为以下代码编写全面的单元测试：';
            systemPrompt = "你是一位测试专家，擅长编写全面的单元测试和集成测试。你的测试代码应该覆盖各种边缘情况，并确保代码的正确性和稳定性。";
        } else {
            promptPrefix = '请根据以下描述生成高质量的代码：';
        }
    }

    // 准备请求负载
    const payload = {
        model: "deepseek-chat",
        messages: [
            { 
                role: "system", 
                content: systemPrompt
            },
            { 
                role: "user", 
                content: `${promptPrefix}\n${fileInfo}当前代码环境: ${code ? '```\n' + code + '\n```' : '当前没有代码'}\n\n用户需求: ${userMessage}` 
            }
        ],
        stream: false,
        temperature: 0.3
    };

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        if (data.choices && data.choices.length > 0) {
            displayMessage('bot', data.choices[0].message.content);
        } else {
            displayMessage('bot', '出错了，请稍后再试。');
        }
    })
    .catch(error => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        displayMessage('bot', '出错了，请稍后再试。');
        console.error('Error:', error);
    });
}

// 将错误信息引用到聊天框
function referErrorToChat(error) {
    const chatInput = document.getElementById('chat-input');
    const fileName = currentFileIndex !== -1 ? uploadedFiles[currentFileIndex].name : '未命名文件';
    
    // 获取错误所在行的代码
    const lines = document.getElementById('code-textarea').value.split('\n');
    const errorLine = error.line > 0 && error.line <= lines.length ? lines[error.line - 1] : '';
    
    // 获取当前光标位置
    const cursorPos = chatInput.selectionStart;
    
    // 构造引用文本
    const referText = `\n引用错误 (${fileName}, 第 ${error.line} 行):\n\`\`\`${currentLanguage}\n${errorLine}\n\`\`\`\n错误信息: ${error.message}\n`;
    
    // 在光标位置插入引用文本
    chatInput.value = 
        chatInput.value.substring(0, cursorPos) + 
        referText + 
        chatInput.value.substring(cursorPos);
    
    // 将光标移至引用文本之后
    const newCursorPos = cursorPos + referText.length;
    chatInput.selectionStart = chatInput.selectionEnd = newCursorPos;
    
    // 聚焦输入框
    chatInput.focus();
}

// 解释代码功能
function explainCode() {
    // 获取选中的代码或当前所有代码
    const codeTextarea = document.getElementById('code-textarea');
    let code = '';
    let isPartialCode = false;
    
    // 检查是否有文本被选中
    if (codeTextarea.selectionStart !== codeTextarea.selectionEnd) {
        // 获取选中的文本
        code = codeTextarea.value.substring(
            codeTextarea.selectionStart, 
            codeTextarea.selectionEnd
        );
        isPartialCode = true;
    } else {
        // 获取所有代码
        code = getEditorCode();
    }
    
    if (!code.trim()) {
        displayMessage('bot', '请先输入或选择要解释的代码。');
        return;
    }
    
    // 请求代码解释
    requestCodeExplanation(code, isPartialCode);
}

// 请求代码解释
function requestCodeExplanation(code, isPartialCode) {
    // 显示加载动画
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    
    const apiKey = 'sk-4d74d15fe0c54990bbe2c75851f570ca';
    const endpoint = 'https://api.deepseek.com/chat/completions';
    
    // 获取当前编程语言
    const language = currentLanguage;
    
    // 构建提示词，请求逐行解释
    const prompt = `请对以下${language}代码提供详细的逐行解释。解释应该清晰易懂，帮助理解代码的功能和工作原理。
    
每行解释应该包含行号，格式为"第X行: [解释]"。对于关键代码或复杂逻辑，请提供更详细的解释。

代码:
\`\`\`${language}
${code}
\`\`\`

请按照以下格式提供解释，务必对每一行代码都进行详细解释：
第1行: [这一行的详细解释]
第2行: [这一行的详细解释]
...

请确保不要略过任何代码行，即使是空行或简单的行也要给予适当的解释。对于复杂的代码块，应该提供更详细的解释，描述其功能、实现原理和目的。`;
    
    // 准备请求负载
    const payload = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: "你是一位专业的代码讲解专家，擅长提供完整、清晰、详细的代码解释，会对每一行代码都进行解释，不会略过任何部分。你的解释深入浅出，帮助初学者完全理解代码。" },
            { role: "user", content: prompt }
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 16000
    };
    
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        if (data.choices && data.choices.length > 0) {
            const responseContent = data.choices[0].message.content;
            
            // 在对话框中显示解释
            displayCodeExplanation(code, responseContent, language, isPartialCode);
        } else {
            displayMessage('bot', '获取代码解释失败，请稍后再试。');
        }
    })
    .catch(error => {
        // 隐藏加载动画
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        displayMessage('bot', '获取代码解释时出错，请稍后再试。');
        console.error('Error:', error);
    });
}

// 在对话框中显示带有解释的代码
function displayCodeExplanation(originalCode, explanation, language, isPartialCode) {
    // 处理解释文本
    const fileName = currentFileIndex !== -1 ? uploadedFiles[currentFileIndex].name : '未命名代码';
    const title = isPartialCode ? `代码片段解释 (${fileName})` : `代码解释 (${fileName})`;
    
    // 构造HTML显示
    let formattedExplanation = `<p class="explanation-title">${title}</p>`;
    
    // 添加原始代码
    formattedExplanation += `<pre class="original-code"><code class="language-${language}">${originalCode}</code></pre>`;
    
    // 处理解释部分
    // 提取行号和解释
    const explanationLines = explanation.split('\n');
    let cleanedExplanation = '';
    
    // 跳过前面的无关文本，直到找到第一个解释行
    let foundFirstExplanation = false;
    let skipLeadingText = true;
    
    for (const line of explanationLines) {
        // 跳过空行和代码块标记
        if (!line.trim() || line.includes('```')) {
            // 如果已经找到第一个解释行，那么保留空行以便格式化
            if (foundFirstExplanation) {
                cleanedExplanation += `<div class="explanation-text">&nbsp;</div>`;
            }
            continue;
        }
        
        // 检查是否是行解释（匹配"第X行："或"行X："等格式）
        if (line.match(/^(第\s*\d+\s*行|行\s*\d+\s*[:：])/)) {
            foundFirstExplanation = true;
            skipLeadingText = false;
            cleanedExplanation += `<div class="explanation-line">${line}</div>`;
        } else if (line.match(/^\d+[\.\s]*[:：]/)) {
            // 匹配数字开头后跟冒号的格式 (如 "1: ", "2. " 等)
            foundFirstExplanation = true;
            skipLeadingText = false;
            cleanedExplanation += `<div class="explanation-line">${line}</div>`;
        } else {
            // 如果已经找到第一个解释行，或者不再跳过前导文本，那么添加普通解释文本
            if (!skipLeadingText) {
                cleanedExplanation += `<div class="explanation-text">${line}</div>`;
            }
        }
    }
    
    // 如果没有找到任何匹配的行解释格式，则使用整个响应
    if (!foundFirstExplanation) {
        cleanedExplanation = '';
        for (const line of explanationLines) {
            if (!line.includes('```')) {
                cleanedExplanation += `<div class="explanation-text">${line}</div>`;
            }
        }
    }
    
    formattedExplanation += `<div class="code-explanation">${cleanedExplanation}</div>`;
    
    // 添加到对话中
    displayMessage('bot', formattedExplanation);
}

// 添加下拉菜单功能
function toggleDropdown(event) {
    event.preventDefault();
    document.getElementById('dropdownMenu').classList.toggle('show');
}

// 点击其他地方关闭下拉菜单
window.onclick = function(event) {
    if (!event.target.matches('.dropdown button')) {
        const dropdowns = document.getElementsByClassName('dropdown-content');
        for (const dropdown of dropdowns) {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    }
}

// 添加回车发送功能
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
});

// 文件面板显示/隐藏切换
function toggleFilesPanel() {
    const filesPanel = document.getElementById('files-panel');
    filesPanel.classList.toggle('hidden-files-panel');
    
    // 保存文件面板显示状态
    localStorage.setItem('filesPanelHidden', filesPanel.classList.contains('hidden-files-panel'));
}