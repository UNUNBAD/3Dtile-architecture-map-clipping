// 初始化相机
function initCamera(container) {
    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        100000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    return camera;
}

// 初始化渲染器
function initRenderer(container) {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    return renderer;
}

// 初始化控制器
function initControls(camera, renderer) {
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.1;
    controls.maxDistance = 10000;
    controls.maxPolarAngle = Math.PI;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.5;
    return controls;
}

// 初始化场景
function initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // 添加平行光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // 添加半球光
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // 添加网格辅助线
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);

    return scene;
}

// 处理窗口大小变化
function handleResize(camera, renderer, container) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// 动画循环
function animate(scene, camera, controls, renderer) {
    requestAnimationFrame(() => animate(scene, camera, controls, renderer));
    controls.update();
    
    if (scene.children.length > 0) {
        renderer.render(scene, camera);
    }
}

// 导出模块
export {
    initCamera,
    initRenderer,
    initControls,
    initScene,
    handleResize,
    animate
};
