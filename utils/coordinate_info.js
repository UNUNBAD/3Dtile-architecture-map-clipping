// 等待DOM加载完成后再设置函数
document.addEventListener('DOMContentLoaded', () => {
    // 添加坐标信息更新函数
    window.updateCoordinateInfo = function(side, viewer, position) {
        if (!position) return;

        const screenCoordElement = document.getElementById('screenCoord');
        const longitudeElement = document.getElementById('longitude');
        const latitudeElement = document.getElementById('latitude');
        const heightElement = document.getElementById('height');

        if (!screenCoordElement || !longitudeElement || !latitudeElement || !heightElement) {
            return;
        }

        // 更新屏幕坐标
        screenCoordElement.textContent = `X: ${Math.round(position.x)}, Y: ${Math.round(position.y)}`;

        try {
            // 获取空间坐标
            const scene = viewer.scene;
            if (!scene) return;

            const cartesian = scene.pickPosition(position);
            if (Cesium.defined(cartesian)) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const height = cartographic.height;

                // 更新经纬度和高程
                longitudeElement.textContent = longitude.toFixed(6);
                latitudeElement.textContent = latitude.toFixed(6);
                heightElement.textContent = height ? height.toFixed(2) : '0.00';
            }
        } catch (error) {
            console.warn('获取坐标信息失败:', error);
            // 设置默认值
            longitudeElement.textContent = '0.000000';
            latitudeElement.textContent = '0.000000';
            heightElement.textContent = '0.00';
        }
    };

    // 添加事件监听器
    const setupCoordinateTracking = () => {
        if (!window.globalVars.leftViewer || !window.globalVars.rightViewer) {
            setTimeout(setupCoordinateTracking, 100);
            return;
        }

        // 添加左侧视图的鼠标移动监听
        const leftMoveHandler = new Cesium.ScreenSpaceEventHandler(window.globalVars.leftViewer.scene.canvas);
        leftMoveHandler.setInputAction(function(movement) {
            updateCoordinateInfo('left', window.globalVars.leftViewer, movement.endPosition);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 添加右侧视图的鼠标移动监听
        const rightMoveHandler = new Cesium.ScreenSpaceEventHandler(window.globalVars.rightViewer.scene.canvas);
        rightMoveHandler.setInputAction(function(movement) {
            updateCoordinateInfo('right', window.globalVars.rightViewer, movement.endPosition);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };

    setupCoordinateTracking();
});
