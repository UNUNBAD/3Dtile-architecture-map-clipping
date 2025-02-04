// 定义全局函数
window.updateModelList = function() {
    console.log('Updating model list');
    const modelListElement = document.getElementById('modelList');
    if (!modelListElement) {
        console.warn('Model list element not found');
        return;
    }

    const importedTilesets = JSON.parse(localStorage.getItem('importedTilesets') || '[]');
    modelListElement.innerHTML = '';

    importedTilesets.forEach(tileset => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <span class="item-name" title="${tileset.path}">${tileset.name}</span>
            <div class="item-actions">
                <button class="item-action-btn" onclick="loadLeftModel('${tileset.path}')" title="加载到左侧">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <button class="item-action-btn" onclick="loadRightModel('${tileset.path}')" title="加载到右侧">
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `;
        modelListElement.appendChild(item);
    });
};

window.showModelSelectDialog = function() {
    console.log('Opening model select dialog');
    const dialog = document.getElementById('modelSelectDialog');
    const listElement = document.getElementById('modelSelectList');
    
    try {
        const importedTilesets = JSON.parse(localStorage.getItem('importedTilesets') || '[]');
        console.log('Available tilesets:', importedTilesets);
        
        // 清空并重新填充列表
        listElement.innerHTML = '';
        
        importedTilesets.forEach(tileset => {
            const item = document.createElement('div');
            item.className = 'model-select-item';
            item.innerHTML = `
                <div class="model-name">${tileset.name}</div>
                <div class="model-path">${tileset.path}</div>
            `;
            
            item.addEventListener('click', function() {
                console.log('Selected tileset:', tileset);
                if (tileset.path) {
                    try {
                        const fs = require('fs');
                        if (fs.existsSync(tileset.path)) {
                            loadLeftModel(tileset.path);
                            closeModelSelectDialog();
                        } else {
                            console.error('File not found:', tileset.path);
                            alert('文件不存在：' + tileset.path);
                        }
                    } catch (error) {
                        console.error('Error checking file:', error);
                        alert('检查文件时出错：' + error.message);
                    }
                } else {
                    console.error('Invalid tileset path');
                    alert('无效的文件路径');
                }
            });
            
            listElement.appendChild(item);
        });

        if (importedTilesets.length === 0) {
            listElement.innerHTML = '<div style="color: #aaa; padding: 10px;">没有可用的模型，请先在主页导入</div>';
        }

        dialog.style.display = 'block';
    } catch (error) {
        console.error('Error loading tilesets:', error);
        alert('加载模型列表时出错：' + error.message);
    }
};

window.closeModelSelectDialog = function() {
    const dialog = document.getElementById('modelSelectDialog');
    dialog.style.display = 'none';
};

window.loadLeftModel = function(tilesetPath) {
    if (!tilesetPath) {
        tilesetPath = localStorage.getItem('selectedLeftModel');
        if (!tilesetPath) {
            console.log('No path provided');
            return;
        }
    }

    console.log('Loading left model:', tilesetPath);

    try {
        // 移除之前的模型
        if (window.globalVars.leftTileset) {
            window.globalVars.leftViewer.scene.primitives.remove(window.globalVars.leftTileset);
        }

        // 构建URL
        const url = `file:///${tilesetPath.replace(/\\/g, '/')}`;
        console.log('Loading from URL:', url);

        // 使用Cesium加载模型
        window.globalVars.leftTileset = new Cesium.Cesium3DTileset({
            url: url
        });

        window.globalVars.leftTileset.readyPromise
            .then(function (tileset) {
                window.globalVars.leftViewer.scene.primitives.add(tileset);
                window.globalVars.leftViewer.zoomTo(tileset);
                console.log('Left model loaded successfully');
                localStorage.removeItem('selectedLeftModel');
            })
            .catch(function (error) {
                console.error('左侧模型加载失败:', error);
                alert('模型加载失败，请确保选择了正确的tileset.json文件');
            });
    } catch (error) {
        console.error('Error loading model:', error);
        alert('加载模型时出错：' + error.message);
    }
};

window.removeLeftModel = function() {
    console.log('Removing left model');
    if (window.globalVars.leftTileset) {
        window.globalVars.leftViewer.scene.primitives.remove(window.globalVars.leftTileset);
        window.globalVars.leftTileset = null;
    }
};

window.loadRightModel = function(tilesetPath) {
    if (!tilesetPath) {
        tilesetPath = localStorage.getItem('selectedRightModel');
        if (!tilesetPath) {
            console.log('No path provided');
            return;
        }
    }

    console.log('Loading right model:', tilesetPath);

    try {
        // 移除之前的模型
        if (window.globalVars.rightTileset) {
            window.globalVars.rightViewer.scene.primitives.remove(window.globalVars.rightTileset);
        }

        // 构建URL
        const url = `file:///${tilesetPath.replace(/\\/g, '/')}`;
        console.log('Loading from URL:', url);

        // 使用Cesium加载模型
        window.globalVars.rightTileset = new Cesium.Cesium3DTileset({
            url: url
        });

        window.globalVars.rightTileset.readyPromise
            .then(function (tileset) {
                window.globalVars.rightViewer.scene.primitives.add(tileset);
                window.globalVars.rightViewer.zoomTo(tileset);
                console.log('Right model loaded successfully');
                localStorage.removeItem('selectedRightModel');
            })
            .catch(function (error) {
                console.error('右侧模型加载失败:', error);
                alert('模型加载失败，请确保选择了正确的tileset.json文件');
            });
    } catch (error) {
        console.error('Error loading model:', error);
        alert('加载模型时出错：' + error.message);
    }
};

window.removeRightModel = function() {
    console.log('Removing right model');
    if (window.globalVars.rightTileset) {
        window.globalVars.rightViewer.scene.primitives.remove(window.globalVars.rightTileset);
        window.globalVars.rightTileset = null;
    }
};

// 确保全局变量存在
if (!window.globalVars) {
    console.warn('Global vars not initialized, creating empty object');
    window.globalVars = {
        leftViewer: null,
        rightViewer: null,
        leftTileset: null,
        rightTileset: null
    };
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, initializing...');
    // 初始化时加载已保存的模型列表
    updateModelList();

    // 监听localStorage变化，更新模型列表
    window.addEventListener('storage', (e) => {
        if (e.key === 'importedTilesets') {
            console.log('ImportedTilesets changed, updating list');
            updateModelList();
        }
    });
});

// ...existing code...

// 确保refreshFileList是全局可访问的
window.refreshFileList = function() {
    const savePath = window.globalVars.settings.savePath || document.getElementById('savePath').value;
    const savePathHint = document.getElementById('savePathHint');
    const fileListDiv = document.querySelector('.file-list');

    if (!savePath) {
        savePathHint.style.display = 'block';
        fileListDiv.innerHTML = '';
        return;
    }

    try {
        const fs = require('fs');
        const path = require('path');

        // 确保路径存在
        if (!fs.existsSync(savePath)) {
            console.error('Path does not exist:', savePath);
            return;
        }

        // 读取目录中的所有文件
        const files = fs.readdirSync(savePath)
            .filter(file => file.endsWith('.png') || file.endsWith('.jpg')) // 只显示图片文件
            .map(file => {
                const filePath = path.join(savePath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    time: stats.mtime // 获取文件修改时间
                };
            })
            .sort((a, b) => b.time - a.time); // 按时间降序排序

        // 更新文件列表显示
        fileListDiv.innerHTML = files.map(file => `
            <div class="file-item">
                <i class="fas fa-image"></i>
                <span class="file-name" title="${file.path}">${file.name}</span>
                <span class="file-time">${file.time.toLocaleString()}</span>
            </div>
        `).join('');

        savePathHint.style.display = 'none';
        
    } catch (error) {
        console.error('Error refreshing file list:', error);
        fileListDiv.innerHTML = `<div class="error-message">读取文件列表失败: ${error.message}</div>`;
    }
}

// 确保在settings加载完成后调用刷新
document.addEventListener('DOMContentLoaded', () => {
    // 初始刷新
    setTimeout(refreshFileList, 1000); // 给予足够的时间等待设置加载
    
    // 每30秒自动刷新一次
    setInterval(refreshFileList, 30000);
});

// 在页面加载完成后立即刷新文件列表
document.addEventListener('DOMContentLoaded', () => {
    // 等待全局设置加载完成后刷新文件列表
    setTimeout(() => {
        refreshFileList();
    }, 500); // 给予适当延时确保设置已加载
});

// 在加载设置后也需要检查路径
function onSettingsLoaded() {
    const savePath = document.getElementById('savePath').value;
    const savePathHint = document.getElementById('savePathHint');
    
    if (!savePath) {
        savePathHint.style.display = 'block';
    } else {
        savePathHint.style.display = 'none';
        refreshFileList();
    }
}
// ...existing code...