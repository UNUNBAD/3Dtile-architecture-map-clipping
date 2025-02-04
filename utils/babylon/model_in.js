window.addEventListener('DOMContentLoaded', function() {
    console.log('初始化开始');
    
    // 获取 Canvas 元素
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true);
    let currentScene = null;

    // 创建场景
    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        
        // 添加相机
        const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 10, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        
        // 添加环境光
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 1.0;

        return scene;
    }

    // 加载模型函数
    const loadModel = async function(file) {
        try {
            console.log('开始加载模型:', file.name);
            
            // 清理当前场景
            if (currentScene) {
                currentScene.dispose();
            }

            // 创建新场景
            currentScene = createScene();
            
            // 创建文件URL
            const fileURL = URL.createObjectURL(file);
            
            // 根据文件扩展名选择加载器
            const extension = file.name.split('.').pop().toLowerCase();
            
            console.log('使用文件URL:', fileURL);
            console.log('文件扩展名:', extension);

            if (extension === 'obj') {
                // 使用FileReader读取OBJ文件
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        try {
                            // 确保OBJ加载器已注册
                            if (!BABYLON.SceneLoader.IsPluginForExtensionAvailable(".obj")) {
                                console.log('注册OBJ加载器');
                                BABYLON.SceneLoader.RegisterPlugin(new BABYLON.OBJFileLoader());
                            }

                            // 配置OBJ加载器
                            const objLoader = BABYLON.SceneLoader.GetPluginForExtension(".obj");
                            if (objLoader) {
                                objLoader.useMtlAsTextureAndMaterial = true;
                                objLoader.computeNormals = true;
                            }

                            // 加载OBJ模型
                            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                                "",
                                "data:",
                                e.target.result,
                                currentScene
                            );

                            console.log('模型加载成功');

                            // 调整相机视角
                            const meshes = result.meshes;
                            if (meshes.length > 0) {
                                const boundingBox = meshes[0].getBoundingInfo().boundingBox;
                                const center = boundingBox.centerWorld;
                                const size = boundingBox.maximumWorld.subtract(boundingBox.minimumWorld);
                                const maxSize = Math.max(size.x, size.y, size.z);
                                
                                const camera = currentScene.getCameraByName("camera");
                                camera.setTarget(center);
                                camera.radius = maxSize * 2;
                            }
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsText(file);
                });
            } else {
                // 加载其他格式模型
                const result = await BABYLON.SceneLoader.ImportMeshAsync(
                    "",
                    "",
                    fileURL,
                    currentScene
                );

                console.log('模型加载成功');
                URL.revokeObjectURL(fileURL);

                // 调整相机视角
                const meshes = result.meshes;
                if (meshes.length > 0) {
                    const boundingBox = meshes[0].getBoundingInfo().boundingBox;
                    const center = boundingBox.centerWorld;
                    const size = boundingBox.maximumWorld.subtract(boundingBox.minimumWorld);
                    const maxSize = Math.max(size.x, size.y, size.z);
                    
                    const camera = currentScene.getCameraByName("camera");
                    camera.setTarget(center);
                    camera.radius = maxSize * 2;
                }
            }

        } catch (error) {
            console.error('模型加载失败:', error);
            alert('模型加载失败: ' + error.message);
        }
    };

    // 设置文件输入处理
    const modelInput = document.getElementById('modelInput');
    const loadModelBtn = document.getElementById('loadModelBtn');
    const debugBtn = document.getElementById('debugBtn');

    if (!modelInput || !loadModelBtn || !debugBtn) {
        console.error('找不到必要的 DOM 元素');
        return;
    }

    loadModelBtn.addEventListener('click', function() {
        console.log('点击加载按钮');
        modelInput.click();
    });

    debugBtn.addEventListener('click', function() {
        console.log('切换调试模式');
        if (currentScene) {
            if (currentScene.debugLayer.isVisible()) {
                currentScene.debugLayer.hide();
            } else {
                currentScene.debugLayer.show();
            }
        }
    });

    modelInput.addEventListener('change', function(event) {
        console.log('文件选择变更');
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            console.log('选择的文件:', file.name);
            
            const extension = file.name.split('.').pop().toLowerCase();
            if (!['gltf', 'glb', 'obj', 'stl'].includes(extension)) {
                alert('请选择支持的3D模型文件格式 (.gltf, .glb, .obj, .stl)');
                return;
            }
            
            loadModel(file);
        }
    });

    // 渲染循环
    engine.runRenderLoop(function() {
        if (currentScene) {
            currentScene.render();
        }
    });

    // 处理窗口大小变化
    window.addEventListener('resize', function() {
        engine.resize();
    });

    console.log('初始化完成');
});
