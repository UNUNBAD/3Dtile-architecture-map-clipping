// 使用全局 THREE 对象
const THREE = window.THREE;

// 全局状态管理
const store = {
    state: {
        selectMesh: null,  // 当前选中的模型
        scene: null,      // 场景引用
        renderer: null    // 渲染器引用
    }
};

// 确保加载器可用
if (!THREE.GLTFLoader) {
    console.error('GLTFLoader not loaded');
}
if (!THREE.OBJLoader) {
    console.error('OBJLoader not loaded');
}
if (!THREE.FBXLoader) {
    console.error('FBXLoader not loaded');
}
if (!THREE.DRACOLoader) {
    console.error('DRACOLoader not loaded');
}

// 配置GLTF加载器和DRACO解码器
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
dracoLoader.setDecoderConfig({ type: 'js' });

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setPath('');

// 添加模型加载器
const loaders = {
    'obj': new THREE.OBJLoader(),
    'gltf': gltfLoader,
    'glb': gltfLoader,
    'fbx': new THREE.FBXLoader(),
    'bin': gltfLoader
};

// 材质管理类
class MaterialManager {
    constructor(scene, renderer) {
        this.scene = scene;
        store.state.scene = scene;      // 保存场景引用
        if (renderer && renderer.render) {
            store.state.renderer = renderer; // 只在renderer有效时保存
        }
        this.textureLoader = new THREE.TextureLoader();
    }

    // 设置当前选中的模型
    setSelectedMesh(mesh) {
        store.state.selectMesh = mesh;
    }

    // 获取当前选中的模型
    getSelectedMesh() {
        return store.state.selectMesh;
    }

    // 设置模型贴图
    onSetSystemModelMap({ url }) {
        // 当前uuid 
        const uuid = store.state.selectMesh?.uuid;
        if (!uuid) {
            console.warn('No mesh selected');
            return;
        }

        // 通过uuid 获取需要设置的材质
        const mesh = this.scene.getObjectByProperty('uuid', uuid);
        if (!mesh) {
            console.warn('No valid mesh found');
            return;
        }

        // 加载贴图
        this.textureLoader.load(url, 
            // 成功回调
            (mapTexture) => {
                // 遍历网格及其子对象
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        // 创建新的基础材质
                        const newMaterial = new THREE.MeshBasicMaterial({
                            color: 0xffffff,
                            map: mapTexture,
                            transparent: true,
                            opacity: 1.0,
                            side: THREE.DoubleSide,
                            polygonOffset: true,
                            polygonOffsetFactor: 1,
                            polygonOffsetUnits: 1
                        });

                        // 保存原始颜色
                        newMaterial.userData = {
                            originalColor: newMaterial.color.clone()
                        };

                        // 应用新材质
                        child.material = newMaterial;
                        child.material.needsUpdate = true;

                        // 检查是否已有线框
                        let wireframe = child.children.find(c => c.isLineSegments);
                        
                        // 如果没有线框，创建新的线框
                        if (!wireframe) {
                            const wireframeMaterial = new THREE.LineBasicMaterial({
                                color: 0x000000,
                                linewidth: 1
                            });
                            const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
                            wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
                            child.add(wireframe);
                        }
                    }
                });

                // 强制渲染更新
                if (store.state.renderer) {
                    store.state.renderer.render(this.scene, this.scene.camera);
                }
            },
            // 进度回调
            undefined,
            // 错误回调
            (error) => {
                console.error('Error loading texture:', error);
            }
        );
    }

    // 设置材质属性
    onSetModelMaterial(config) {
        const uuid = store.state.selectMesh?.uuid;
        if (!uuid) {
            console.warn('No mesh selected');
            return;
        }

        const mesh = this.scene.getObjectByProperty('uuid', uuid);
        if (!mesh || !mesh.material) {
            console.warn('No valid mesh or material found');
            return;
        }

        const { color, wireframe, depthWrite, opacity } = config;

        // 设置材质属性
        mesh.material.color.set(new THREE.Color(color));
        mesh.material.wireframe = wireframe;
        mesh.material.depthWrite = depthWrite;
        mesh.material.transparent = true;
        mesh.material.opacity = opacity;
        mesh.material.needsUpdate = true;
    }

    // 通过UUID获取模型
    getMeshByUUID(uuid) {
        return this.scene.getObjectByProperty('uuid', uuid);
    }
}

// 创建默认网格
export function createDefaultMesh() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ 
        color: 0x808080,
        transparent: true,
        opacity: 1.0
    });
    return new THREE.Mesh(geometry, material);
}

// 重置为默认模型
export function resetToDefaultModel(scene, camera, controls, currentMesh) {
    if (currentMesh) {
        scene.remove(currentMesh);
    }
    
    const defaultMesh = createDefaultMesh();
    scene.add(defaultMesh);
    
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
    
    return {
        selectedMesh: defaultMesh
    };
}

// 添加场景初始化函数
function initSceneLights(scene) {
    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 添加半球光
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
}

// 加载模型
export function loadModel(file, scene, camera, controls, renderer, callback) {
    console.log('开始加载模型:', file.name);
    
    const materialManager = new MaterialManager(scene, renderer);
    const fileName = file.name;
    const fileType = fileName.split('.').pop().toLowerCase();
    
    if (!loaders[fileType]) {
        alert('不支持的文件类型！');
        return;
    }

    // 确保场景有光源
    initSceneLights(scene);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            console.log('文件读取完成，开始解析');
            const loader = loaders[fileType];
            
            // 根据文件类型处理模型加载
            if (fileType === 'gltf' || fileType === 'glb') {
                console.log('使用GLTF加载器解析模型');
                loader.parse(
                    e.target.result,
                    '',
                    (gltf) => {
                        console.log('GLTF解析成功:', gltf);
                        const model = gltf.scene;
                        handleLoadedModel(model, fileName, scene, camera, controls, renderer, callback);
                    },
                    (error) => {
                        console.error('模型加载失败:', error);
                        alert('模型加载失败: ' + error.message);
                    }
                );
            } else if (fileType === 'obj' || fileType === 'fbx') {
                console.log('使用', fileType.toUpperCase(), '加载器加载模型');
                const url = URL.createObjectURL(file);
                loader.load(
                    url,
                    (object) => {
                        console.log(fileType.toUpperCase(), '加载成功:', object);
                        handleLoadedModel(object, fileName, scene, camera, controls, renderer, callback);
                        URL.revokeObjectURL(url);
                    },
                    (xhr) => {
                        console.log((xhr.loaded / xhr.total * 100) + '% 已加载');
                    },
                    (error) => {
                        console.error('模型加载失败:', error);
                        alert('模型加载失败: ' + error.message);
                        URL.revokeObjectURL(url);
                    }
                );
            }
        } catch (error) {
            console.error('模型加载失败:', error);
            alert('模型加载失败: ' + error.message);
        }
    };
    
    // 根据文件类型选择读取方式
    if (fileType === 'gltf' || fileType === 'glb') {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsDataURL(file);
    }
}

// 处理加载完成的模型
function handleLoadedModel(model, fileName, scene, camera, controls, renderer, callback) {
    try {
        console.log('开始处理模型:', fileName);
        
        // 移除当前模型
        const currentMesh = store.state.selectMesh;
        if (currentMesh) {
            scene.remove(currentMesh);
        }

        // 检查模型是否有效
        if (!model) {
            throw new Error('模型对象为空');
        }

        // 处理加载的模型
        let meshCount = 0;
        const meshes = []; // 存储所有网格

        model.traverse((child) => {
            if (child.isMesh) {
                meshCount++;
                console.log(`处理网格 ${meshCount}:`, {
                    name: child.name,
                    vertices: child.geometry.attributes.position.count,
                    position: child.position.toArray()
                });

                // 创建两个材质：一个用于实体，一个用于线框
                const meshMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,  // 白色
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 1.0,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1
                });

                const wireframeMaterial = new THREE.LineBasicMaterial({
                    color: 0x000000,  // 黑色线框
                    linewidth: 1
                });

                // 保存原始颜色
                meshMaterial.userData = {
                    originalColor: meshMaterial.color.clone()
                };

                // 创建线框几何体
                const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
                
                // 设置主网格材质
                child.material = meshMaterial;
                
                // 添加线框作为子对象
                child.add(wireframe);

                // 确保每个网格都可以被射线检测
                child.raycast = THREE.Mesh.prototype.raycast;
                
                // 添加到网格列表
                meshes.push(child);
            }
        });

        if (meshCount === 0) {
            throw new Error('模型中没有找到任何网格');
        }

        console.log('找到网格数量:', meshCount);

        // 计算模型包围盒
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        console.log('模型信息:', {
            size: size.toArray(),
            center: center.toArray()
        });

        // 添加到场景
        scene.add(model);
        store.state.selectMesh = model;

        // 只在renderer有效时设置射线检测
        if (renderer && renderer.domElement) {
            // 设置射线检测器
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            let hoveredMesh = null;

            // 修改鼠标事件处理
            const onMouseMove = (event) => {
                // 计算鼠标位置的标准化设备坐标
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                // 更新射线
                raycaster.setFromCamera(mouse, camera);

                // 检测相交的对象
                const intersects = raycaster.intersectObjects(meshes, true);

                // 恢复之前悬停对象的颜色
                if (hoveredMesh && (!intersects.length || intersects[0].object !== hoveredMesh)) {
                    hoveredMesh.material.color.copy(hoveredMesh.material.userData.originalColor);
                    hoveredMesh.material.needsUpdate = true;
                    hoveredMesh = null;
                }

                // 设置新的悬停对象的颜色
                if (intersects.length > 0) {
                    const mesh = intersects[0].object;
                    if (mesh !== hoveredMesh) {
                        hoveredMesh = mesh;
                        mesh.material.color.setHex(0xff0000); // 设置悬停颜色为红色
                        mesh.material.needsUpdate = true;
                    }
                }

                // 请求动画帧进行渲染
                requestAnimationFrame(() => {
                    if (renderer && typeof renderer.render === 'function') {
                        renderer.render(scene, camera);
                    }
                });
            };

            // 添加事件监听器
            renderer.domElement.addEventListener('mousemove', onMouseMove);

            // 保存清理函数
            model.userData.cleanup = () => {
                renderer.domElement.removeEventListener('mousemove', onMouseMove);
            };
        }

        // 调整相机位置到模型中心
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;

        // 计算相机位置：在模型中心的右上方
        const cameraPosition = center.clone();
        cameraPosition.x += distance;
        cameraPosition.y += distance;
        cameraPosition.z += distance;

        // 设置相机
        camera.position.copy(cameraPosition);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();

        // 确保场景中有光源
        let hasLight = false;
        scene.traverse((child) => {
            if (child.isLight) hasLight = true;
        });

        if (!hasLight) {
            console.log('添加场景光源');
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.copy(camera.position);
            scene.add(directionalLight);

            const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
            hemisphereLight.position.set(0, maxDim, 0);
            scene.add(hemisphereLight);
        }

        // 请求动画帧进行渲染
        requestAnimationFrame(() => {
            if (renderer && typeof renderer.render === 'function') {
                renderer.render(scene, camera);
            }
        });

        console.log('最终信息:', {
            modelPosition: model.position.toArray(),
            modelCenter: center.toArray(),
            cameraPosition: camera.position.toArray(),
            cameraTarget: controls.target.toArray()
        });

        if (callback) {
            callback(model, fileName);
        }

        console.log('模型加载完成:', fileName);

    } catch (error) {
        console.error('\n 模型处理失败:', error);
        alert('模型处理失败: ' + error.message);
    }
}

export { MaterialManager, store };
