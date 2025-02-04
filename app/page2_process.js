const { spawn } = require('child_process');
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
let pythonProcess = null;
let isProcessing = false;

function updateStatus(status) {
    document.getElementById('status').textContent = status;
}

function appendLog(message) {
    const logArea = document.getElementById('logArea');
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    logArea.innerHTML += `${logMessage}\n`;
    logArea.scrollTop = logArea.scrollHeight;
}

// 添加页面加载时的初始化函数
async function initializePage() {
    try {
        updateStatus('设置路径后点击开始处理');
        // 加载设置中的保存路径
        const result = await ipcRenderer.invoke('load-settings');
        if (result.success && result.settings.savePath) {
            document.getElementById('inputFolder').value = result.settings.savePath;
            
            // 加载文件列表
            await loadFileList(result.settings.savePath);
            updateStatus('就绪');
        }
    } catch (error) {
        updateStatus('初始化失败');
        appendLog('初始化失败: ' + error);
    }
}

// 添加加载文件列表的函数
async function loadFileList(dirPath) {
    try {
        const result = await ipcRenderer.invoke('get-file-list', dirPath);
        if (result.success) {
            updateFileList(result.files);
        } else {
            appendLog('加载文件列表失败: ' + result.error);
        }
    } catch (error) {
        appendLog('加载文件列表失败: ' + error);
    }
}

// 更新文件列表显示函数
function updateFileList(files) {
    const fileListElement = document.getElementById('fileList');
    fileListElement.innerHTML = '';
    
    // 对文件进行分组（PNG和JSON配对）
    const fileGroups = {};
    files.forEach(file => {
        const baseName = file.name.replace(/\.(png|json)$/i, '');
        if (!fileGroups[baseName]) {
            fileGroups[baseName] = {};
        }
        fileGroups[baseName][file.type.toLowerCase()] = file;
    });

    // 创建文件组显示
    Object.entries(fileGroups).forEach(([baseName, group]) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-group';
        
        const hasPng = group.png !== undefined;
        const hasJson = group.json !== undefined;
        const timestamp = group.png ? group.png.timestamp : group.json.timestamp;

        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-name">${baseName}</span>
                <span class="file-status">
                    <i class="fas fa-image" style="color: ${hasPng ? '#4CAF50' : '#f44336'}"></i>
                    <i class="fas fa-code" style="color: ${hasJson ? '#4CAF50' : '#f44336'}"></i>
                </span>
                <span class="file-time">${new Date(timestamp).toLocaleString()}</span>
            </div>
            ${hasPng && hasJson ? '<span class="ready-status">✅ 就绪</span>' : '<span class="pending-status">⏳ 等待配对文件</span>'}
        `;
        fileListElement.appendChild(fileItem);
    });
}

function getPythonPaths() {
    const isDev = process.env.NODE_ENV === 'development';
    const basePath = isDev ? process.cwd() : process.resourcesPath;
    
    // 使用 PyInstaller 打包后的可执行文件路径
    if (process.platform === 'win32') {
        return {
            pythonExe: path.join(basePath, isDev ? 'dist/python/001.exe' : 'python/001.exe')
        };
    } else {
        return {
            pythonExe: path.join(basePath, isDev ? 'dist/python/001' : 'python/001')
        };
    }
}

async function startProcessing() {
    if (isProcessing) {
        appendLog('已经在处理中...');
        return;
    }

    const inputFolder = document.getElementById('inputFolder').value;

    // 检查文件夹是否存在
    if (!fs.existsSync(inputFolder)) {
        appendLog('错误: 输入文件夹不存在');
        return;
    }

    // 获取Python可执行文件路径
    const { pythonExe } = getPythonPaths();

    if (!fs.existsSync(pythonExe)) {
        appendLog('错误: Python程序未找到: ' + pythonExe);
        return;
    }

    appendLog('启动处理...');
    appendLog('程序路径: ' + pythonExe);
    appendLog('输入文件夹: ' + inputFolder);
    
    // 只传入输入文件夹路径
    pythonProcess = spawn(pythonExe, [inputFolder]);
    isProcessing = true;
    updateStatus('处理中');

    pythonProcess.stdout.on('data', (data) => {
        appendLog(data.toString().trim());
    });

    pythonProcess.stderr.on('data', (data) => {
        appendLog(`错误: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        isProcessing = false;
        if (code === 0) {
            updateStatus('处理完成');
            appendLog('处理成功完成');
            // 处理完成后刷新文件列表
            loadFileList(inputFolder);
        } else {
            updateStatus('处理异常结束');
            appendLog(`处理异常结束，退出代码：${code}`);
        }
    });

    pythonProcess.on('error', (error) => {
        isProcessing = false;
        updateStatus('启动失败');
        appendLog('启动处理失败: ' + error.message);
    });
}

function stopProcessing() {
    if (!isProcessing) {
        appendLog('没有正在运行的处理任务');
        return;
    }

    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
        isProcessing = false;
        updateStatus('已停止');
        appendLog('处理已停止');
    }
}

// 添加页面加载和卸载的处理
window.onload = initializePage;

// 页面关闭时清理
window.onbeforeunload = () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
};
