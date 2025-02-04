// 等待DOM加载完成后再设置函数
document.addEventListener('DOMContentLoaded', () => {
    // 开始截图
    window.startScreenshot = function(viewerType) {
        console.log('Starting screenshot for viewer:', viewerType);
        
        // 获取对应的viewer元素
        const viewerElement = document.getElementById(viewerType + 'Viewer');
        if (!viewerElement) {
            console.error('Viewer element not found:', viewerType + 'Viewer');
            return;
        }

        // 获取viewer对象
        const viewer = viewerType === 'left' ? window.globalVars.leftViewer : window.globalVars.rightViewer;
        if (!viewer) {
            console.error('Viewer not initialized:', viewerType);
            return;
        }

        try {
            // 创建截图区域
            const screenshotArea = document.createElement('div');
            screenshotArea.className = 'screenshot-area';
            screenshotArea.style.position = 'absolute';
            screenshotArea.style.border = '2px dashed #fff';
            screenshotArea.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            screenshotArea.style.display = 'none';
            viewerElement.appendChild(screenshotArea);

            // 设置状态
            window.globalVars.currentScreenshot = {
                viewer: viewer,
                element: viewerElement,
                area: screenshotArea,
                isDrawing: false,
                startX: 0,
                startY: 0
            };

            // 添加鼠标事件监听
            viewerElement.addEventListener('mousedown', handleMouseDown);
            viewerElement.addEventListener('mousemove', handleMouseMove);
            viewerElement.addEventListener('mouseup', handleMouseUp);

            // 显示提示
            const hint = document.getElementById('screenshotHint');
            if (hint) {
                hint.textContent = '请在视图中拖动鼠标选择截图区域';
                hint.style.display = 'block';
            }

            console.log('Screenshot mode activated');
        } catch (error) {
            console.error('Error setting up screenshot:', error);
            alert('设置截图功能时出错');
        }
    };

    // 处理鼠标按下事件
    function handleMouseDown(e) {
        if (!window.globalVars.currentScreenshot) return;
        
        const rect = window.globalVars.currentScreenshot.element.getBoundingClientRect();
        window.globalVars.currentScreenshot.isDrawing = true;
        window.globalVars.currentScreenshot.startX = e.clientX - rect.left;
        window.globalVars.currentScreenshot.startY = e.clientY - rect.top;
        window.globalVars.currentScreenshot.area.style.display = 'block';
        window.globalVars.currentScreenshot.area.style.left = window.globalVars.currentScreenshot.startX + 'px';
        window.globalVars.currentScreenshot.area.style.top = window.globalVars.currentScreenshot.startY + 'px';
    }

    // 处理鼠标移动事件
    function handleMouseMove(e) {
        if (!window.globalVars.currentScreenshot || !window.globalVars.currentScreenshot.isDrawing) return;

        const rect = window.globalVars.currentScreenshot.element.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - window.globalVars.currentScreenshot.startX;
        const height = currentY - window.globalVars.currentScreenshot.startY;

        window.globalVars.currentScreenshot.area.style.width = Math.abs(width) + 'px';
        window.globalVars.currentScreenshot.area.style.height = Math.abs(height) + 'px';

        if (width < 0) {
            window.globalVars.currentScreenshot.area.style.left = currentX + 'px';
        }
        if (height < 0) {
            window.globalVars.currentScreenshot.area.style.top = currentY + 'px';
        }
    }

    // 处理鼠标松开事件
    function handleMouseUp() {
        if (!window.globalVars.currentScreenshot || !window.globalVars.currentScreenshot.isDrawing) return;

        window.globalVars.currentScreenshot.isDrawing = false;
        takeScreenshot();
    }

    // 执行截图
    function takeScreenshot() {
        if (!window.globalVars.currentScreenshot) return;

        try {
            const area = window.globalVars.currentScreenshot.area;
            const rect = area.getBoundingClientRect();
            const viewer = window.globalVars.currentScreenshot.viewer;

            // 获取截图
            const screenshot = viewer.scene.canvas.toDataURL();

            // 显示预览
            const resultImage = document.getElementById('screenshotImage');
            const resultDiv = document.getElementById('screenshotResult');
            if (resultImage && resultDiv) {
                resultImage.src = screenshot;
                resultDiv.style.display = 'block';
            }

            // 清理截图区域
            cleanupScreenshot();
            
            console.log('Screenshot taken successfully');
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('截图时出错');
            cleanupScreenshot();
        }
    }

    // 清理截图相关元素和事件
    function cleanupScreenshot() {
        if (!window.globalVars.currentScreenshot) return;

        const { element, area } = window.globalVars.currentScreenshot;
        
        // 移除事件监听
        element.removeEventListener('mousedown', handleMouseDown);
        element.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('mouseup', handleMouseUp);

        // 移除截图区域
        if (area && area.parentNode) {
            area.parentNode.removeChild(area);
        }

        // 隐藏提示
        const hint = document.getElementById('screenshotHint');
        if (hint) {
            hint.style.display = 'none';
        }

        // 清除当前截图状态
        window.globalVars.currentScreenshot = null;
    }

    // 关闭截图预览
    window.closeScreenshot = function() {
        const resultDiv = document.getElementById('screenshotResult');
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }
    };

    // 下载截图
    window.downloadScreenshot = async function() {
        if (!window.globalVars.currentScreenshot) return;

        if (window.electron) {
            try {
                const imageData = window.globalVars.currentScreenshot.toDataURL();
                const defaultPath = window.globalVars.settings.savePath || 'screenshots';
                const filename = `screenshot-${Date.now()}.png`;
                const fullPath = await window.electron.saveImage({
                    imageData,
                    defaultPath,
                    filename
                });

                if (window.globalVars.settings.enablePythonProcess && fullPath) {
                    await window.electron.processPython({
                        imagePath: fullPath
                    });
                }
            } catch (error) {
                console.error('保存截图失败:', error);
            }
        } else {
            const link = document.createElement('a');
            link.download = `screenshot-${Date.now()}.png`;
            link.href = window.globalVars.currentScreenshot.toDataURL();
            link.click();
        }
    };

    // 取消截图
    window.cancelScreenshot = function() {
        const leftHandler = window.globalVars.leftViewer._screenshotHandler;
        const rightHandler = window.globalVars.rightViewer._screenshotHandler;

        // 恢复相机控制
        window.globalVars.leftViewer.scene.screenSpaceCameraController.enableRotate = true;
        window.globalVars.leftViewer.scene.screenSpaceCameraController.enableTranslate = true;
        window.globalVars.leftViewer.scene.screenSpaceCameraController.enableZoom = true;
        window.globalVars.leftViewer.scene.screenSpaceCameraController.enableTilt = true;
        window.globalVars.leftViewer.scene.screenSpaceCameraController.enableLook = true;

        window.globalVars.rightViewer.scene.screenSpaceCameraController.enableRotate = true;
        window.globalVars.rightViewer.scene.screenSpaceCameraController.enableTranslate = true;
        window.globalVars.rightViewer.scene.screenSpaceCameraController.enableZoom = true;
        window.globalVars.rightViewer.scene.screenSpaceCameraController.enableTilt = true;
        window.globalVars.rightViewer.scene.screenSpaceCameraController.enableLook = true;

        // 清理截图相关内容
        if (leftHandler) {
            leftHandler.destroy();
            delete window.globalVars.leftViewer._screenshotHandler;
        }
        if (rightHandler) {
            rightHandler.destroy();
            delete window.globalVars.rightViewer._screenshotHandler;
        }

        // 隐藏取消按钮
        document.querySelectorAll('.screenshot-cancel').forEach(btn => {
            btn.style.display = 'none';
        });

        // 隐藏提示和状态
        document.getElementById('screenshotStatus').style.display = 'none';
        
        const hint = document.getElementById('screenshotHint');
        if (hint) {
            hint.style.display = 'none';
        }
    };

    // 更新截图状态的函数
    window.updateScreenshotStatus = function(message) {
        const statusElement = document.getElementById('screenshotStatus');
        if (message) {
            statusElement.textContent = message;
            statusElement.style.display = 'block';
        } else {
            statusElement.style.display = 'none';
        }
    };
});