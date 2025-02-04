// 等待DOM加载完成后再设置函数
document.addEventListener('DOMContentLoaded', () => {
    // 同步相机视角
    window.synchronizeCameras = function(viewer1, viewer2) {
        let synchronizing = false;

        // 同步相机设置
        function syncCamera(master, slave) {
            if (synchronizing) return;
            
            synchronizing = true;
            slave.camera.position = master.camera.position.clone();
            slave.camera.direction = master.camera.direction.clone();
            slave.camera.up = master.camera.up.clone();
            slave.camera.right = master.camera.right.clone();
            slave.camera.frustum = master.camera.frustum.clone();
            synchronizing = false;
        }

        // 设置相机事件监听
        viewer1.camera.changed.addEventListener(() => syncCamera(viewer1, viewer2));
        viewer2.camera.changed.addEventListener(() => syncCamera(viewer2, viewer1));
        viewer1.camera.moveEnd.addEventListener(() => syncCamera(viewer1, viewer2));
        viewer2.camera.moveEnd.addEventListener(() => syncCamera(viewer2, viewer1));

        // 添加定期同步检查，每16ms（约60fps）同步一次
        setInterval(() => {
            syncCamera(viewer1, viewer2);
            syncCamera(viewer2, viewer1);
        }, 15);
    };
});
