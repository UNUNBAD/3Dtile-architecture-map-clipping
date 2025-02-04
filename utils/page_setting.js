// 等待DOM加载完成后再设置函数
document.addEventListener('DOMContentLoaded', () => {
    // 添加显示提示的函数
    function showToast(message, type = 'success') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `settings-toast ${type}-toast`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 添加显示类
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // 将设置相关函数添加到全局作用域
    window.loadSettings = async function() {
        try {
            // 从本地存储加载设置
            const savedSettings = localStorage.getItem('cesiumViewerSettings');
            if (savedSettings) {
                window.globalVars.settings = {...window.globalVars.settings, ...JSON.parse(savedSettings)};
            }
            
            // 如果有electron环境，从文件加载设置（优先级更高）
            if (window.electron) {
                const result = await window.electron.loadSettings();
                if (result.success) {
                    window.globalVars.settings = {...window.globalVars.settings, ...result.settings};
                }
            }

            // 更新UI
            document.getElementById('leftMapEnabled').checked = window.globalVars.settings.leftMapEnabled;
            document.getElementById('rightMapEnabled').checked = window.globalVars.settings.rightMapEnabled;
            document.getElementById('savePath').value = window.globalVars.settings.savePath;
            document.getElementById('enablePythonProcess').checked = window.globalVars.settings.enablePythonProcess;
            document.getElementById('outputPath').value = window.globalVars.settings.outputPath;
            document.getElementById('monitorPath').value = window.globalVars.settings.monitorPath;
            document.getElementById('enableAutoMonitor').checked = window.globalVars.settings.enableAutoMonitor;
            updateMapVisibility();
            
            if (window.globalVars.settings.enableAutoMonitor && window.electron) {
                window.electron.startMonitor({
                    outputPath: window.globalVars.settings.outputPath,
                    monitorPath: window.globalVars.settings.monitorPath
                });
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    };

    // 添加路径格式化函数
    function formatWindowsPath(path) {
        if (!path) return '';
        
        // 移除多余的空格
        path = path.trim();
        
        // 确保驱动器字母后有反斜杠
        if (path.match(/^[A-Za-z]:/)) {
            path = path.replace(/^([A-Za-z]:)(?!\\)/, '$1\\');
        }
        
        // 确保路径以反斜杠结尾
        if (!path.endsWith('\\')) {
            path = path + '\\';
        }
        
        // 替换所有正斜杠为反斜杠
        path = path.replace(/\//g, '\\');
        
        // 移除多余的反斜杠
        path = path.replace(/\\+/g, '\\');
        
        return path;
    }

    window.saveSettings = async function() {
        try {
            // 更新设置对象
            window.globalVars.settings.leftMapEnabled = document.getElementById('leftMapEnabled').checked;
            window.globalVars.settings.rightMapEnabled = document.getElementById('rightMapEnabled').checked;
            // 格式化保存路径
            window.globalVars.settings.savePath = formatWindowsPath(document.getElementById('savePath').value);
            window.globalVars.settings.enablePythonProcess = document.getElementById('enablePythonProcess').checked;
            // 格式化其他路径
            window.globalVars.settings.outputPath = formatWindowsPath(document.getElementById('outputPath').value);
            window.globalVars.settings.monitorPath = formatWindowsPath(document.getElementById('monitorPath').value);
            window.globalVars.settings.enableAutoMonitor = document.getElementById('enableAutoMonitor').checked;
            
            // 更新输入框显示格式化后的路径
            document.getElementById('savePath').value = window.globalVars.settings.savePath;
            document.getElementById('outputPath').value = window.globalVars.settings.outputPath;
            document.getElementById('monitorPath').value = window.globalVars.settings.monitorPath;
            
            // 保存到本地存储
            localStorage.setItem('cesiumViewerSettings', JSON.stringify(window.globalVars.settings));
            
            // 如果有electron环境，保存到文件
            if (window.electron) {
                const result = await window.electron.saveSettings(window.globalVars.settings);
                if (!result.success) {
                    console.error('保存设置到文件失败:', result.error);
                    showToast('保存设置失败: ' + result.error, 'error');
                    return;
                }
            }

            updateMapVisibility();

            // 处理监控功能
            if (window.electron) {
                try {
                    if (window.globalVars.settings.enableAutoMonitor) {
                        const monitorResult = await window.electron.startMonitor({
                            outputPath: window.globalVars.settings.outputPath,
                            monitorPath: window.globalVars.settings.monitorPath
                        });
                        if (!monitorResult.success) {
                            console.error('启动监控失败:', monitorResult.error);
                            showToast('启动监控失败: ' + monitorResult.error, 'error');
                            return;
                        }
                    } else {
                        const stopResult = await window.electron.stopMonitor();
                        if (!stopResult.success) {
                            console.error('停止监控失败:', stopResult.error);
                            showToast('停止监控失败: ' + stopResult.error, 'error');
                            return;
                        }
                    }
                } catch (monitorError) {
                    console.error('监控操作失败:', monitorError);
                    showToast('监控操作失败: ' + monitorError.message, 'error');
                    return;
                }
            }

            // 显示成功提示
            showToast('设置保存成功');
            
            toggleSettings();
        } catch (error) {
            console.error('保存设置失败:', error);
            showToast('保存设置失败: ' + error.message, 'error');
        }
    };

    window.toggleSettings = function() {
        const panel = document.getElementById('settingsPanel');
        if (panel.style.display === 'none' || !panel.style.display) {
            document.getElementById('leftMapEnabled').checked = window.globalVars.settings.leftMapEnabled;
            document.getElementById('rightMapEnabled').checked = window.globalVars.settings.rightMapEnabled;
            document.getElementById('savePath').value = window.globalVars.settings.savePath || '';
            document.getElementById('enablePythonProcess').checked = window.globalVars.settings.enablePythonProcess;
            document.getElementById('outputPath').value = window.globalVars.settings.outputPath || '';
            document.getElementById('monitorPath').value = window.globalVars.settings.monitorPath || '';
            document.getElementById('enableAutoMonitor').checked = window.globalVars.settings.enableAutoMonitor;
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    };

    window.updateMapVisibility = function() {
        const leftViewer = document.getElementById('leftViewer');
        const rightViewer = document.getElementById('rightViewer');
        
        if (leftViewer) {
            leftViewer.style.display = window.globalVars.settings.leftMapEnabled ? 'block' : 'none';
            if (window.globalVars.settings.leftMapEnabled) {
                leftViewer.style.flex = '1';
            }
        }
        
        if (rightViewer) {
            rightViewer.style.display = window.globalVars.settings.rightMapEnabled ? 'block' : 'none';
            if (window.globalVars.settings.rightMapEnabled) {
                rightViewer.style.flex = '1';
            }
        }

        if (window.globalVars.settings.leftMapEnabled && !window.globalVars.settings.rightMapEnabled) {
            leftViewer.style.flex = '1';
        } else if (!window.globalVars.settings.leftMapEnabled && window.globalVars.settings.rightMapEnabled) {
            rightViewer.style.flex = '1';
        }
    };

    // 添加浏览文件夹功能
    window.browsePath = async function(inputId) {
        if (window.electron) {
            try {
                const result = await window.electron.selectFolder();
                if (result.success) {
                    const input = document.getElementById(inputId);
                    input.value = result.path;
                    // 触发input事件以更新设置
                    input.dispatchEvent(new Event('input'));
                }
            } catch (error) {
                console.error('选择文件夹失败:', error);
                showToast('选择文件夹失败: ' + error.message, 'error');
            }
        }
    };
});