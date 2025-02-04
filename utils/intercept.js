// 初始化全局变量
let screenPoints = [];
let hint;
let viewer;
let metaData = {
    points: [],
    timestamp: null,
    viewerPosition: null
};

function initCesiumQuadrilateralScreenshot(_viewer) {
    const isRightViewer = _viewer === window.rightViewer;
    const targetViewer = isRightViewer ? window.leftViewer : _viewer;

    if (!_viewer) {
        console.error('Viewer is required');
        return;
    }
    
    viewer = targetViewer;
    screenPoints = [];
    
    // 使用已有的提示元素
    hint = document.getElementById('screenshotHint');
    if (hint) {
        hint.textContent = '请点击4个点来定义截图区域：截图开始将固定视角';
        hint.style.display = 'block';
    }

    let handler = new Cesium.ScreenSpaceEventHandler(_viewer.scene.canvas);
    let moveHandler = new Cesium.ScreenSpaceEventHandler(_viewer.scene.canvas);
    
    // 存储handler以便后续清理
    _viewer._screenshotHandler = {
        handlers: [handler, moveHandler],
        destroy: function() {
            this.handlers.forEach(h => h && h.destroy());
            this.handlers = [];
        }
    };

    // 重置元数据
    metaData = {
        points: [],
        timestamp: null,
        viewerPosition: null
    };

    // 添加临时实体存储数组
    let tempEntities = [];
    
    handler.setInputAction(function(event) {
        if (screenPoints.length < 4) {
            // 获取屏幕坐标
            const screenX = event.position.x;
            const screenY = event.position.y;
            
            // 如果是右侧视图，转换坐标到左侧视图
            let targetScreenX = screenX;
            let targetScreenY = screenY;
            if (isRightViewer) {
                // 从右侧视图的屏幕坐标获取世界坐标
                const cartesian = _viewer.scene.pickPosition(event.position);
                if (cartesian) {
                    // 将世界坐标转换为左侧视图的屏幕坐标
                    const leftScreenPosition = targetViewer.scene.cartesianToCanvasCoordinates(cartesian);
                    if (leftScreenPosition) {
                        targetScreenX = leftScreenPosition.x;
                        targetScreenY = leftScreenPosition.y;
                    }
                }
            }
            
            // 使用转换后的坐标在目标视图中获取位置
            const cartesian = targetViewer.scene.pickPosition(new Cesium.Cartesian2(targetScreenX, targetScreenY));
            
            if (cartesian) {
                // 转换为经纬度坐标
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const height = cartographic.height;

                // 存储点信息
                const pointData = {
                    index: screenPoints.length + 1,
                    screen: { x: screenX, y: screenY },
                    geographic: { 
                        longitude: parseFloat(longitude.toFixed(6)), 
                        latitude: parseFloat(latitude.toFixed(6)), 
                        height: parseFloat(height.toFixed(2))
                    },
                    cartesian: {
                        x: parseFloat(cartesian.x.toFixed(3)),
                        y: parseFloat(cartesian.y.toFixed(3)),
                        z: parseFloat(cartesian.z.toFixed(3))
                    }
                };

                // 添加到元数据中
                metaData.points.push(pointData);

                // 移除临时点实体的显示，只存储点信息
                /*
                const tempEntity = viewer.entities.add({
                    position: cartesian,
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    },
                    label: {
                        text: `点 ${screenPoints.length + 1}`,
                        font: '14px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        pixelOffset: new Cesium.Cartesian2(0, -20),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });
                tempEntities.push(tempEntity);
                */

                screenPoints.push({
                    x: targetScreenX,
                    y: targetScreenY
                });

                console.log(`添加第 ${screenPoints.length} 个点:`, pointData);
                // 更新提示文本
                if (hint) {
                    if (screenPoints.length < 4) {
                        hint.textContent = `请继续点击，还需要 ${4 - screenPoints.length} 个点`;
                    } else {
                        hint.style.display = 'none';
                    }
                }
                
                if (screenPoints.length === 4) {
                    // 禁用相机控制
                    viewer.scene.screenSpaceCameraController.enableRotate = false;
                    viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    viewer.scene.screenSpaceCameraController.enableZoom = false;
                    viewer.scene.screenSpaceCameraController.enableTilt = false;
                    viewer.scene.screenSpaceCameraController.enableLook = false;

                    // 添加时间戳和视角信息
                    metaData.timestamp = new Date().toISOString();
                    metaData.viewerPosition = {
                        position: {
                            x: parseFloat(viewer.camera.position.x.toFixed(3)),
                            y: parseFloat(viewer.camera.position.y.toFixed(3)),
                            z: parseFloat(viewer.camera.position.z.toFixed(3))
                        },
                        heading: parseFloat(viewer.camera.heading.toFixed(6)),
                        pitch: parseFloat(viewer.camera.pitch.toFixed(6)),
                        roll: parseFloat(viewer.camera.roll.toFixed(6))
                    };

                    console.log('完成所有点的采集:', metaData);
                    
                    // 显示保存中状态
                    showSaveStatus('正在保存...', 'saving');
                    
                    // 立即创建截图和保存元数据
                    setTimeout(() => {
                        createScreenshotWithMetadata(viewer, screenPoints, metaData, function() {
                            // 清理回调
                            screenPoints = [];
                            _viewer._screenshotHandler.destroy();
                            hint.style.display = 'none';
                            delete _viewer._screenshotHandler;
                        });
                    }, 100);
                    
                    // 清理临时实体
                    tempEntities.forEach(entity => viewer.entities.remove(entity));
                    tempEntities = [];
                }

                // 在点击处理函数中添加状态更新
                if (screenPoints.length < 4) {
                    updateScreenshotStatus(`已选择 ${screenPoints.length} 个点`);
                }
                if (screenPoints.length === 4) {
                    updateScreenshotStatus('');  // 清除状态信息
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 修改移动监听器以更新正确的坐标信息
    moveHandler.setInputAction(function(movement) {
        if (isRightViewer) {
            const cartesian = _viewer.scene.pickPosition(movement.endPosition);
            if (cartesian) {
                const leftScreenPosition = targetViewer.scene.cartesianToCanvasCoordinates(cartesian);
                if (leftScreenPosition) {
                    updateCoordinateInfo(targetViewer, leftScreenPosition);
                }
            }
        } else {
            updateCoordinateInfo(viewer, movement.endPosition);
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

// 添加坐标信息更新函数
function updateCoordinateInfo(viewer, position) {
    const screenCoordElement = document.getElementById('screenCoord');
    const longitudeElement = document.getElementById('longitude');
    const latitudeElement = document.getElementById('latitude');
    const heightElement = document.getElementById('height');

    // 更新屏幕坐标
    screenCoordElement.textContent = `X: ${Math.round(position.x)}, Y: ${Math.round(position.y)}`;

    // 获取空间坐标
    const cartesian = viewer.scene.pickPosition(position);
    if (Cesium.defined(cartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;

        // 更新经纬度和高程
        longitudeElement.textContent = longitude.toFixed(6);
        latitudeElement.textContent = latitude.toFixed(6);
        heightElement.textContent = height ? height.toFixed(2) : '0.00';
    } else {
        // 如果未能获取空间坐标，显示默认值
        longitudeElement.textContent = '0.000000';
        latitudeElement.textContent = '0.000000';
        heightElement.textContent = '0.00';
    }
}

function createScreenshotWithMetadata(viewer, points, metadata, cleanupCallback) {
    if (!points || points.length !== 4) {
        console.error('需要4个点来定义截图区域');
        return null;
    }

    const timestamp = Date.now();
    const filename = `SC-${timestamp}`;

    // 创建元数据的深拷贝，避免被清除
    const metadataCopy = JSON.parse(JSON.stringify(metadata));
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    // 计算边界框
    const minX = Math.min(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxX = Math.max(...points.map(p => p.x));
    const maxY = Math.max(...points.map(p => p.y));
    const width = maxX - minX;
    const height = maxY - minY;

    // 设置画布大小为边界框大小
    canvas.width = width;
    canvas.height = height;

    // 创建裁剪路径
    context.beginPath();
    context.moveTo(points[0].x - minX, points[0].y - minY);
    context.lineTo(points[1].x - minX, points[1].y - minY);
    context.lineTo(points[2].x - minX, points[2].y - minY);
    context.lineTo(points[3].x - minX, points[3].y - minY);
    context.closePath();
    context.clip();

    // 获取原始canvas内容并绘制
    const sourceCanvas = viewer.scene.canvas;
    context.drawImage(sourceCanvas, minX, minY, width, height, 0, 0, width, height);

    // 修改导出逻辑为静默保存
    canvas.toBlob(async (blob) => {
        try {
            // 使用IPC通信
            const { ipcRenderer } = require('electron');
            if (!ipcRenderer) {
                throw new Error('IPC通信未初始化');
            }

            // 使用全局设置中的保存路径
            const savePath = window.globalVars.settings.savePath;
            if (!savePath) {
                throw new Error('请先在设置中配置保存路径');
            }

            // 转换blob为base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                try {
                    const base64data = reader.result;
                    
                    // 保存图片
                    const imgResult = await ipcRenderer.invoke('save-image', {
                        imageData: base64data,
                        defaultPath: savePath,
                        filename: `${filename}.png`
                    });

                    if (!imgResult.success) {
                        throw new Error(imgResult.error || '图片保存失败');
                    }

                    // 保存JSON
                    const jsonData = JSON.stringify(metadataCopy, null, 2);
                    const jsonResult = await ipcRenderer.invoke('save-json', {
                        jsonData,
                        defaultPath: savePath,
                        filename: `${filename}.json`
                    });

                    if (!jsonResult.success) {
                        throw new Error(jsonResult.error || 'JSON保存失败');
                    }

                    // 显示保存成功提示
                    showSaveStatus('保存成功', 'saved');

                    // 清理数据
                    if (typeof cleanupCallback === 'function') {
                        cleanupCallback();
                    }
                    
                    // 重置状态
                    resetScreenshotState(viewer);

                    // 在截图保存完成后添加刷新调用
                    setTimeout(() => {
                        refreshFileList();
                    }, 500); // 给文件系统一点时间完成写入
                } catch (error) {
                    console.error('保存过程出错:', error);
                    showSaveStatus(`保存失败: ${error.message}`, 'error');
                }
            };
        } catch (error) {
            console.error('保存失败:', error);
            showSaveStatus(`保存失败: ${error.message}`, 'error');
        }
    }, 'image/png');
}

// 添加重置状态的辅助函数
function resetScreenshotState(viewer) {
    // 只隐藏提示，不移除
    if (hint) {
        hint.style.display = 'none';
    }
    // 恢复相机控制
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;
    viewer.scene.screenSpaceCameraController.enableLook = true;

    // 隐藏取消按钮
    document.querySelectorAll('.screenshot-cancel').forEach(btn => {
        btn.style.display = 'none';
    });
    // 隐藏状态提示
    document.getElementById('screenshotStatus').style.display = 'none';
    // 重置所有相关状态
    screenPoints = [];
    metaData = {
        points: [],
        timestamp: null,
        viewerPosition: null
    };
}

// 导出函数到全局作用域
window.initCesiumQuadrilateralScreenshot = initCesiumQuadrilateralScreenshot;

// 添加更新截图状态的函数
function updateScreenshotStatus(message) {
    const statusElement = document.getElementById('screenshotStatus');
    if (message) {
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    } else {
        statusElement.style.display = 'none';
    }
}

// 添加显示状态提示的函数
function showSaveStatus(message, type = 'saving') {
    // 移除已有的状态提示
    const existingStatus = document.querySelector('.save-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    // 创建新的状态提示
    const status = document.createElement('div');
    status.className = `save-status ${type}`;
    status.innerHTML = `
        <i class="fas ${type === 'saving' ? 'fa-spinner' : 'fa-check'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(status);
    setTimeout(() => status.classList.add('show'), 100);

    if (type === 'saved') {
        setTimeout(() => {
            status.classList.remove('show');
            setTimeout(() => status.remove(), 300);
        }, 3000);
    }
}

// 添加格式化时间的函数
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 修改刷新文件列表的函数
async function refreshFileList() {
    const fileList = document.querySelector('.file-list');
    if (!fileList) return;

    try {
        const savePath = window.globalVars.settings.savePath;
        if (!savePath) {
            fileList.innerHTML = '<div class="file-item">请先设置保存路径</div>';
            return;
        }

        const result = await window.electron.getFileList(savePath);
        if (!result.success) {
            fileList.innerHTML = `<div class="file-item">获取文件列表失败: ${result.error}</div>`;
            return;
        }

        fileList.innerHTML = result.files.map(file => `
            <div class="file-item ${file.type}" onclick="window.electron.openFile('${file.path}')">
                <i class="fas ${file.type === 'png' ? 'fa-image' : 'fa-file-code'}"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-time">${formatTime(file.timestamp)}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('刷新文件列表失败:', error);
        fileList.innerHTML = '<div class="file-item">刷新文件列表失败</div>';
    }
}

// 暴露刷新文件列表函数到全局
window.refreshFileList = refreshFileList;

// 初始化时加载文件列表
document.addEventListener('DOMContentLoaded', () => {
    refreshFileList();
});

// 取消截图
window.cancelQuadrilateralScreenshot = function() {
    if (viewer) {
        // 恢复相机控制
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        viewer.scene.screenSpaceCameraController.enableTranslate = true;
        viewer.scene.screenSpaceCameraController.enableZoom = true;
        viewer.scene.screenSpaceCameraController.enableTilt = true;
        viewer.scene.screenSpaceCameraController.enableLook = true;

        // 清理handler
        if (viewer._screenshotHandler) {
            viewer._screenshotHandler.destroy();
            delete viewer._screenshotHandler;
        }

        // 隐藏提示和状态
        if (hint) {
            hint.style.display = 'none';
        }
        document.getElementById('screenshotStatus').style.display = 'none';

        // 隐藏取消按钮
        document.querySelectorAll('.screenshot-cancel').forEach(btn => {
            btn.style.display = 'none';
        });

        // 重置点和元数据
        screenPoints = [];
        metaData = {
            points: [],
            timestamp: null,
            viewerPosition: null
        };
    }
};