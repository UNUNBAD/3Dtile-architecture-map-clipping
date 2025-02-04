// 等待DOM和Cesium完全加载后再设置事件
document.addEventListener('DOMContentLoaded', function() {
    // 确保viewer已经初始化
    const checkViewers = setInterval(() => {
        if (window.globalVars.leftViewer && window.globalVars.rightViewer) {
            clearInterval(checkViewers);
            
            // 设置左侧点击事件
            window.globalVars.leftViewer.screenSpaceEventHandler.setInputAction(function (movement) {
                if (!window.globalVars.leftViewer._screenshotHandler) {
                    var position = window.globalVars.leftViewer.scene.pickPosition(movement.position);
                    if (Cesium.defined(position)) {
                        window.globalVars.leftViewer.entities.add({
                            position: position,
                            point: {
                                pixelSize: 10,
                                color: Cesium.Color.RED,
                                outlineColor: Cesium.Color.WHITE,
                                outlineWidth: 2,
                                heightReference: Cesium.HeightReference.NONE
                            }
                        });
                    }
                }
                
                var feature = window.globalVars.leftViewer.scene.pick(movement.position);
                if (feature instanceof Cesium.Cesium3DTileFeature) {
                    var propertyIds = feature.getPropertyIds();
                    var length = propertyIds.length;
                    for (var i = 0; i < length; ++i) {
                        var propertyId = propertyIds[i];
                        console.log(propertyId + ': ' + feature.getProperty(propertyId));
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

            // 设置右侧点击事件
            window.globalVars.rightViewer.screenSpaceEventHandler.setInputAction(function (movement) {
                if (!window.globalVars.rightViewer._screenshotHandler) {
                    var position = window.globalVars.rightViewer.scene.pickPosition(movement.position);
                    if (Cesium.defined(position)) {
                        window.globalVars.rightViewer.entities.add({
                            position: position,
                            point: {
                                pixelSize: 10,
                                color: Cesium.Color.RED,
                                outlineColor: Cesium.Color.WHITE,
                                outlineWidth: 2,
                                heightReference: Cesium.HeightReference.NONE
                            }
                        });
                    }
                }
                
                var feature = window.globalVars.rightViewer.scene.pick(movement.position);
                if (feature instanceof Cesium.Cesium3DTileFeature) {
                    var propertyIds = feature.getPropertyIds();
                    var length = propertyIds.length;
                    for (var i = 0; i < length; ++i) {
                        var propertyId = propertyIds[i];
                        console.log(propertyId + ': ' + feature.getProperty(propertyId));
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
            
            console.log('点击事件已设置完成');
        }
    }, 100); // 每100ms检查一次
});