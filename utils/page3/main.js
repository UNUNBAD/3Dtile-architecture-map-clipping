// 导入模块
import { createDefaultMesh, resetToDefaultModel, loadModel } from './model_load.js';
import { setupRaycaster, clearHighlights } from './hight_light.js';
import { initCamera, initRenderer, initControls, initScene, handleResize, animate } from './camera.js';

// 全局状态管理
const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    selectedMesh: null,
    highlightMeshes: [],
    currentTexture: null,
    textureHistory: new Map(), // 存储每个面的贴图历史
    dragOverHighlight: null,   // 拖拽悬停高亮
    undoStack: [],            // 撤销栈
    redoStack: [],            // 重做栈
    batchOptions: {           // 批量贴图选项
        similarFaces: false,
        connectedFaces: false,
        similarityThreshold: 0.95
    },
    highlightEnabled: true  // 添加高亮开关状态
};

// 配置GLTF加载器和DRACO解码器
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
dracoLoader.setDecoderConfig({ type: 'js' }); // 使用JavaScript解码器

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setPath(''); // 设置基础路径

// 添加模型加载器
const loaders = {
    'obj': new THREE.OBJLoader(),
    'gltf': gltfLoader,
    'glb': gltfLoader,
    'fbx': new THREE.FBXLoader(),
    'bin': gltfLoader // 使用配置好的gltfLoader
};

// 初始化Three.js场景
function init() {
    const container = document.getElementById('modelViewer');
    
    // 初始化场景组件
    state.scene = initScene();
    state.camera = initCamera(container);
    state.renderer = initRenderer(container);
    state.controls = initControls(state.camera, state.renderer);
    
    // 创建默认模型
    const defaultMesh = createDefaultMesh();
    state.selectedMesh = defaultMesh;
    state.scene.add(defaultMesh);

    // 设置射线检测器和鼠标悬停
    setupMouseInteraction();
    
    // 设置拖拽事件
    setupDragAndDrop();

    // 设置UV控制事件
    setupUVControls();

    // 设置文件夹输入处理
    setupFolderInput();

    // 开始动画循环
    animate(state.scene, state.camera, state.controls, state.renderer);
}

// 设置鼠标交互
function setupMouseInteraction() {
    const viewer = document.getElementById('modelViewer');
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let currentHoverMesh = null;

    viewer.addEventListener('mousemove', (e) => {
        if (!state.highlightEnabled) return;

        const rect = viewer.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, state.camera);
        const intersects = raycaster.intersectObject(state.selectedMesh, true);

        // 清除之前的高亮
        if (currentHoverMesh) {
            state.scene.remove(currentHoverMesh);
            currentHoverMesh.geometry.dispose();
            currentHoverMesh.material.dispose();
            currentHoverMesh = null;
        }

        // 创建新的高亮
        if (intersects.length > 0 && intersects[0].face) {
            const highlightMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                opacity: 0.3,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: true
            });

            const highlightGeometry = new THREE.BufferGeometry();
            const positions = intersects[0].object.geometry.attributes.position;
            const face = intersects[0].face;

            const vertices = new Float32Array([
                positions.getX(face.a), positions.getY(face.a), positions.getZ(face.a),
                positions.getX(face.b), positions.getY(face.b), positions.getZ(face.b),
                positions.getX(face.c), positions.getY(face.c), positions.getZ(face.c)
            ]);

            highlightGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            currentHoverMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
            currentHoverMesh.position.copy(intersects[0].object.position);
            currentHoverMesh.rotation.copy(intersects[0].object.rotation);
            currentHoverMesh.scale.copy(intersects[0].object.scale);
            state.scene.add(currentHoverMesh);
        }
    });

    // 鼠标离开viewer时清除高亮
    viewer.addEventListener('mouseleave', () => {
        if (currentHoverMesh) {
            state.scene.remove(currentHoverMesh);
            currentHoverMesh.geometry.dispose();
            currentHoverMesh.material.dispose();
            currentHoverMesh = null;
        }
    });
}

// 设置文件夹输入处理
function setupFolderInput() {
    const folderInput = document.getElementById('folderInput');
    folderInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/'));
        
        const preview = document.getElementById('texturePreview');
        preview.innerHTML = '';

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.draggable = true;
                
                img.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', img.src);
                });
                
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

// 更新拖拽事件处理
function setupDragAndDrop() {
    const viewer = document.getElementById('modelViewer');
    
    viewer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        viewer.classList.add('drag-over');
    });

    viewer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        viewer.classList.remove('drag-over');
    });

    viewer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    viewer.addEventListener('drop', async (e) => {
        e.preventDefault();
        viewer.classList.remove('drag-over');

        const face = getFaceAtPosition(
            ((e.clientX - viewer.getBoundingClientRect().left) / viewer.clientWidth) * 2 - 1,
            -((e.clientY - viewer.getBoundingClientRect().top) / viewer.clientHeight) * 2 + 1
        );

        if (!face) {
            alert('请将图片拖放到模型表面');
            return;
        }

        let imageData;
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (!file.type.startsWith('image/')) {
                alert('请拖拽图片文件');
                return;
            }
            imageData = await readFileAsDataURL(file);
        } else {
            imageData = e.dataTransfer.getData('text/plain');
        }

        try {
            const texture = await createTextureFromData(imageData);
            applyTextureToFace(texture, face.object, face.face);
        } catch (error) {
            console.error('贴图应用失败:', error);
            alert('贴图应用失败: ' + error.message);
        }
    });
}

// 从文件创建DataURL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 从DataURL创建纹理
function createTextureFromData(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const texture = new THREE.Texture(image);
            texture.needsUpdate = true;
            resolve(texture);
        };
        image.onerror = reject;
        image.src = dataUrl;
    });
}

// 获取指定位置的面
function getFaceAtPosition(x, y) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(x, y);
    
    raycaster.setFromCamera(mouse, state.camera);
    
    const meshes = [];
    state.scene.traverse((object) => {
        if (object.isMesh && object !== state.dragOverHighlight) {
            meshes.push(object);
        }
    });
    
    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        return {
            object: intersect.object,
            face: intersect.face
        };
    }
    
    return null;
}

// 加载纹理
function loadTexture(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const image = new Image();
            image.onload = () => {
                const texture = new THREE.Texture(image);
                texture.needsUpdate = true;
                
                // 更新预览
                updateTexturePreview(image);
                
                resolve(texture);
            };
            image.onerror = reject;
            image.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 更新纹理预览
function updateTexturePreview(image) {
    const preview = document.getElementById('texturePreview');
    preview.innerHTML = '';
    const previewImage = image.cloneNode();
    preview.appendChild(previewImage);
}

// 添加到撤销栈
function addToUndoStack(action) {
    state.undoStack.push(action);
    state.redoStack = []; // 清空重做栈
    updateUndoRedoButtons();
}

// 更新撤销/重做按钮状态
function updateUndoRedoButtons() {
    document.getElementById('undoButton').disabled = state.undoStack.length === 0;
    document.getElementById('redoButton').disabled = state.redoStack.length === 0;
}

// 执行撤销
function undo() {
    if (state.undoStack.length === 0) return;
    
    const action = state.undoStack.pop();
    state.redoStack.push(action);
    
    // 恢复之前的状态
    restoreTextureState(action.mesh, action.face, action.previousState);
    updateUndoRedoButtons();
    updateTextureHistory();
}

// 执行重做
function redo() {
    if (state.redoStack.length === 0) return;
    
    const action = state.redoStack.pop();
    state.undoStack.push(action);
    
    // 应用贴图
    applyTextureToFace(action.texture, action.mesh, action.face, action.uvSettings);
    updateUndoRedoButtons();
    updateTextureHistory();
}

// 恢复纹理状态
function restoreTextureState(mesh, face, state) {
    if (!state) return;
    
    // 恢复材质
    if (state.material) {
        const materialIndex = mesh.material.indexOf(state.material);
        if (materialIndex !== -1) {
            mesh.material.splice(materialIndex, 1);
        }
    }
    
    // 恢复UV坐标
    if (state.uvs) {
        const geometry = mesh.geometry;
        const uvAttribute = geometry.attributes.uv;
        state.uvs.forEach(({index, u, v}) => {
            uvAttribute.setXY(index, u, v);
        });
        uvAttribute.needsUpdate = true;
    }
}

// 更新贴图历史显示
function updateTextureHistory() {
    const historyList = document.getElementById('textureHistoryList');
    historyList.innerHTML = '';
    
    // 获取当前选中面的历史
    const selectedFace = state.selectedMesh?.userData.selectedFace;
    if (!selectedFace) return;
    
    const faceKey = `${state.selectedMesh.uuid}-${selectedFace.a}-${selectedFace.b}-${selectedFace.c}`;
    const history = state.textureHistory.get(faceKey) || [];
    
    history.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const img = document.createElement('img');
        img.src = entry.texture.image.src;
        
        const info = document.createElement('div');
        info.className = 'history-item-info';
        info.innerHTML = `
            <div>贴图 ${index + 1}</div>
            <div class="timestamp">${entry.timestamp}</div>
        `;
        
        item.appendChild(img);
        item.appendChild(info);
        
        item.addEventListener('click', () => {
            applyHistoryEntry(entry, state.selectedMesh, selectedFace);
        });
        
        historyList.appendChild(item);
    });
}

// 应用历史记录条目
function applyHistoryEntry(entry, mesh, face) {
    applyTextureToFace(entry.texture, mesh, face, entry.uvSettings);
}

// 查找相似面
function findSimilarFaces(mesh, face, threshold) {
    const similarFaces = [];
    const faceNormal = calculateFaceNormal(mesh.geometry, face);
    const faceArea = calculateFaceArea(mesh.geometry, face);
    
    const geometry = mesh.geometry;
    for (let i = 0; i < geometry.attributes.position.count; i += 3) {
        const testFace = {
            a: i,
            b: i + 1,
            c: i + 2
        };
        
        if (testFace.a === face.a && testFace.b === face.b && testFace.c === face.c) continue;
        
        const testNormal = calculateFaceNormal(geometry, testFace);
        const testArea = calculateFaceArea(geometry, testFace);
        
        // 比较法线和面积
        const normalSimilarity = testNormal.dot(faceNormal);
        const areaSimilarity = Math.min(faceArea, testArea) / Math.max(faceArea, testArea);
        
        if (normalSimilarity > threshold && areaSimilarity > threshold) {
            similarFaces.push(testFace);
        }
    }
    
    return similarFaces;
}

// 查找相连面
function findConnectedFaces(mesh, face) {
    const connectedFaces = [];
    const geometry = mesh.geometry;
    const vertices = [face.a, face.b, face.c];
    
    for (let i = 0; i < geometry.attributes.position.count; i += 3) {
        const testFace = {
            a: i,
            b: i + 1,
            c: i + 2
        };
        
        if (testFace.a === face.a && testFace.b === face.b && testFace.c === face.c) continue;
        
        // 检查是否共享边
        const testVertices = [testFace.a, testFace.b, testFace.c];
        let sharedVertices = 0;
        
        for (const v1 of vertices) {
            for (const v2 of testVertices) {
                if (v1 === v2) sharedVertices++;
            }
        }
        
        if (sharedVertices >= 2) { // 共享至少2个顶点（一条边）
            connectedFaces.push(testFace);
        }
    }
    
    return connectedFaces;
}

// 计算面法线
function calculateFaceNormal(geometry, face) {
    const positions = geometry.attributes.position;
    const v1 = new THREE.Vector3(
        positions.getX(face.a),
        positions.getY(face.a),
        positions.getZ(face.a)
    );
    const v2 = new THREE.Vector3(
        positions.getX(face.b),
        positions.getY(face.b),
        positions.getZ(face.b)
    );
    const v3 = new THREE.Vector3(
        positions.getX(face.c),
        positions.getY(face.c),
        positions.getZ(face.c)
    );
    
    const normal = new THREE.Vector3();
    normal.crossVectors(
        v2.clone().sub(v1),
        v3.clone().sub(v1)
    ).normalize();
    
    return normal;
}

// 计算面积
function calculateFaceArea(geometry, face) {
    const positions = geometry.attributes.position;
    const v1 = new THREE.Vector3(
        positions.getX(face.a),
        positions.getY(face.a),
        positions.getZ(face.a)
    );
    const v2 = new THREE.Vector3(
        positions.getX(face.b),
        positions.getY(face.b),
        positions.getZ(face.b)
    );
    const v3 = new THREE.Vector3(
        positions.getX(face.c),
        positions.getY(face.c),
        positions.getZ(face.c)
    );
    
    const triangle = new THREE.Triangle(v1, v2, v3);
    return triangle.getArea();
}

// 修改 applyTextureToFace 函数
function applyTextureToFace(texture, mesh, face, uvSettings = null) {
    if (!mesh || !face || !mesh.geometry || !mesh.geometry.attributes.position) {
        console.warn('Invalid mesh or face data');
        return;
    }

    try {
        // 保存当前状态用于撤销
        const previousState = {
            material: Array.isArray(mesh.material) ? mesh.material[mesh.material.length - 1] : mesh.material,
            uvs: []
        };
        
        // 保存UV坐标
        const geometry = mesh.geometry;
        const uvAttribute = geometry.attributes.uv;
        
        if (!uvAttribute) {
            geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
        }
        
        [face.a, face.b, face.c].forEach(index => {
            if (index >= 0 && index < geometry.attributes.position.count) {
                previousState.uvs.push({
                    index,
                    u: uvAttribute ? uvAttribute.getX(index) : 0,
                    v: uvAttribute ? uvAttribute.getY(index) : 0
                });
            }
        });

        // 添加到撤销栈
        addToUndoStack({
            mesh,
            face,
            texture,
            uvSettings,
            previousState
        });
        
        // 保存贴图历史
        const faceKey = `${mesh.uuid}-${face.a}-${face.b}-${face.c}`;
        if (!state.textureHistory.has(faceKey)) {
            state.textureHistory.set(faceKey, []);
        }
        
        state.textureHistory.get(faceKey).push({
            texture,
            uvSettings: uvSettings || {
                scaleU: parseFloat(document.getElementById('scaleU').value),
                scaleV: parseFloat(document.getElementById('scaleV').value),
                offsetU: parseFloat(document.getElementById('offsetU').value),
                offsetV: parseFloat(document.getElementById('offsetV').value),
                rotation: parseFloat(document.getElementById('rotation').value)
            },
            timestamp: new Date().toLocaleString()
        });
        
        // 应用贴图
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1.0,
            shininess: 30
        });
        
        if (!Array.isArray(mesh.material)) {
            mesh.material = [mesh.material];
        }
        
        const materialIndex = mesh.material.length;
        mesh.material.push(material);
        
        // 更新UV坐标
        if (uvSettings) {
            updateUVCoordinates(mesh, face, uvSettings);
        } else {
            updateUVCoordinates(mesh, face, {
                scaleU: parseFloat(document.getElementById('scaleU').value),
                scaleV: parseFloat(document.getElementById('scaleV').value),
                offsetU: parseFloat(document.getElementById('offsetU').value),
                offsetV: parseFloat(document.getElementById('offsetV').value),
                rotation: parseFloat(document.getElementById('rotation').value) * Math.PI / 180
            });
        }
        
        // 更新面的材质索引
        updateFaceMaterialIndex(mesh, face, materialIndex);
        
        // 如果启用了批量贴图选项，应用到其他面
        if (state.batchOptions.similarFaces || state.batchOptions.connectedFaces) {
            let targetFaces = [];
            
            if (state.batchOptions.similarFaces) {
                targetFaces = targetFaces.concat(
                    findSimilarFaces(mesh, face, state.batchOptions.similarityThreshold)
                );
            }
            
            if (state.batchOptions.connectedFaces) {
                targetFaces = targetFaces.concat(findConnectedFaces(mesh, face));
            }
            
            // 去重
            targetFaces = Array.from(new Set(targetFaces));
            
            // 应用到目标面
            targetFaces.forEach(targetFace => {
                applyTextureToFace(texture, mesh, targetFace, uvSettings);
            });
        }
        
        // 更新UI
        updateTextureHistory();
        clearHighlights(state.scene, state.highlightMeshes);
    } catch (error) {
        console.error('Error applying texture:', error);
        throw error;
    }
}

// 更新UV坐标
function updateUVCoordinates(mesh, face, params) {
    const { scaleU, scaleV, offsetU, offsetV, rotation } = params;
    const geometry = mesh.geometry;

    if (!geometry.attributes.uv) {
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    }

    const uvAttribute = geometry.attributes.uv;
    const vertices = [face.a, face.b, face.c];
    
    vertices.forEach((vertexIndex, i) => {
        let u = i === 0 ? 0 : i === 1 ? 1 : 0.5;
        let v = i === 0 ? 0 : i === 1 ? 0 : 1;

        // 应用缩放
        u *= scaleU;
        v *= scaleV;

        // 应用旋转
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const u2 = u * cos - v * sin;
        const v2 = u * sin + v * cos;

        // 应用偏移
        const finalU = u2 + offsetU;
        const finalV = v2 + offsetV;

        uvAttribute.setXY(vertexIndex, finalU, finalV);
    });

    uvAttribute.needsUpdate = true;
}

// 更新面的材质索引
function updateFaceMaterialIndex(mesh, face, materialIndex) {
    const geometry = mesh.geometry;

    if (!geometry.groups) {
        geometry.groups = [];
    }

    // 添加新的材质组
    geometry.groups.push({
        start: Math.floor(face.a / 3) * 3,
        count: 3,
        materialIndex: materialIndex
    });

    geometry.groupsNeedUpdate = true;
}

// 设置UV控制事件
function setupUVControls() {
    const controls = ['scaleU', 'scaleV', 'offsetU', 'offsetV', 'rotation'];
    
    controls.forEach(controlId => {
        const input = document.getElementById(controlId);
        const display = input.nextElementSibling;
        
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            display.textContent = controlId === 'rotation' ? `${value}°` : value;
            
            if (state.selectedMesh && state.selectedMesh.userData.selectedFace) {
                updateUVMapping();
            }
        });
    });
}

// 更新UV映射
function updateUVMapping() {
    if (!state.selectedMesh || !state.selectedMesh.userData.selectedFace) return;

    const mesh = state.selectedMesh;
    const face = mesh.userData.selectedFace;
    const material = Array.isArray(mesh.material) ? 
        mesh.material[mesh.material.length - 1] : 
        mesh.material;

    if (!material || !material.map) return;

    updateUVCoordinates(mesh, face, {
        scaleU: parseFloat(document.getElementById('scaleU').value),
        scaleV: parseFloat(document.getElementById('scaleV').value),
        offsetU: parseFloat(document.getElementById('offsetU').value),
        offsetV: parseFloat(document.getElementById('offsetV').value),
        rotation: parseFloat(document.getElementById('rotation').value) * Math.PI / 180
    });
}

// 处理加载完成的模型
function handleLoadedModel(object, fileName) {
    try {
        console.log('Processing model:', fileName);

        // 移除默认立方体和当前模型
        if (state.selectedMesh && state.scene.children.includes(state.selectedMesh)) {
            state.scene.remove(state.selectedMesh);
        }

        // 处理加载的模型
        state.selectedMesh = object;
        state.selectedMesh.visible = true;

        // 存储所有需要处理的边线和标记，避免在遍历时修改场景
        const edgesToAdd = [];
        const markersToAdd = [];

        // 遍历模型的所有部分，设置材质
        let hasMeshes = false;
        object.traverse(function(child) {
            if (child.isMesh) {
                hasMeshes = true;
                console.log('Found mesh:', child.name);
                
                // 保存原始材质的属性
                const originalMaterial = child.material;
                
                // 创建新的标准材质
                const newMaterial = new THREE.MeshPhongMaterial({
                    color: originalMaterial.color || 0x808080,
                    map: originalMaterial.map,
                    normalMap: originalMaterial.normalMap,
                    side: THREE.DoubleSide,
                    transparent: originalMaterial.transparent,
                    opacity: originalMaterial.opacity,
                    shininess: 30
                });

                // 应用新材质
                child.material = newMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 确保几何体有法线
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }

                // 创建边线
                const edges = new THREE.EdgesGeometry(child.geometry, 30);
                const edgesMaterial = new THREE.LineBasicMaterial({ 
                    color: 0x000000,
                    linewidth: 1,
                    depthTest: true,
                });
                const edgesMesh = new THREE.LineSegments(edges, edgesMaterial);
                
                // 设置边线位置
                edgesMesh.position.copy(child.position);
                edgesMesh.rotation.copy(child.rotation);
                edgesMesh.scale.copy(child.scale);
                edgesMesh.matrixAutoUpdate = true;
                
                // 将边线添加到待处理列表
                edgesToAdd.push(edgesMesh);

                // 存储顶点位置用于吸附
                const positions = child.geometry.attributes.position;
                const vertices = [];
                for (let i = 0; i < positions.count; i++) {
                    vertices.push(new THREE.Vector3(
                        positions.getX(i),
                        positions.getY(i),
                        positions.getZ(i)
                    ));
                }
                child.userData.vertices = vertices;
                
                // 创建顶点标记组
                const vertexMarkers = new THREE.Group();
                vertices.forEach(vertex => {
                    const markerGeometry = new THREE.SphereGeometry(0.05, 8, 8);
                    const markerMaterial = new THREE.MeshBasicMaterial({
                        color: 0xff0000,
                        visible: false
                    });
                    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                    marker.position.copy(vertex);
                    vertexMarkers.add(marker);
                });
                
                // 将顶点标记添加到待处理列表
                markersToAdd.push({ parent: child, markers: vertexMarkers });
            }
        });

        if (!hasMeshes) {
            console.warn('No meshes found in the model');
            alert('模型中没有找到可显示的网格！');
            return;
        }

        // 计算包围盒
        const box = new THREE.Box3().setFromObject(state.selectedMesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        console.log('Model size:', size);
        console.log('Model center:', center);

        // 计算合适的缩放比例
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 10; // 目标大小为10个网格单位
        const scale = targetSize / maxDim;
        console.log('Applying scale:', scale);
        state.selectedMesh.scale.multiplyScalar(scale);

        // 将模型居中
        state.selectedMesh.position.copy(center).multiplyScalar(-scale);

        // 添加到场景
        state.scene.add(state.selectedMesh);

        // 添加所有边线
        edgesToAdd.forEach(edge => {
            edge.scale.multiplyScalar(scale);
            edge.position.copy(state.selectedMesh.position);
            state.scene.add(edge);
        });

        // 添加所有顶点标记
        markersToAdd.forEach(({ parent, markers }) => {
            markers.scale.multiplyScalar(scale);
            markers.position.copy(parent.position);
            parent.add(markers);
            parent.userData.vertexMarkers = markers;
        });
        
        // 调整相机位置以更好地显示模型
        const distance = targetSize * 1.5;
        state.camera.position.set(distance, distance, distance);
        state.camera.lookAt(0, 0, 0);

        // 更新控制器
        state.controls.target.set(0, 0, 0);
        state.controls.minDistance = targetSize * 0.1;
        state.controls.maxDistance = targetSize * 10;
        state.controls.update();

        // 更新UI
        document.getElementById('modelName').textContent = fileName;
        
        console.log('Model loaded successfully:', fileName);
        
    } catch (error) {
        console.error('模型处理错误:', error);
        alert('模型处理失败: ' + error.message);
        document.getElementById('modelName').textContent = '处理失败';
    }
}

// 添加事件监听
document.getElementById('modelInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        loadModel(file, state.scene, state.camera, state.controls, handleLoadedModel);
    }
});

document.getElementById('resetModel').addEventListener('click', () => {
    const result = resetToDefaultModel(state.scene, state.camera, state.controls, state.selectedMesh);
    state.selectedMesh = result.selectedMesh;
});

document.getElementById('textureInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        try {
            const texture = await loadTexture(file);
            state.currentTexture = texture;
        } catch (error) {
            console.error('贴图加载失败:', error);
            alert('贴图加载失败: ' + error.message);
        }
    }
});

// 处理窗口大小变化
window.addEventListener('resize', () => {
    const container = document.getElementById('modelViewer');
    handleResize(state.camera, state.renderer, container);
});

// 添加事件监听
document.getElementById('undoButton').addEventListener('click', undo);
document.getElementById('redoButton').addEventListener('click', redo);

document.getElementById('batchSimilarFaces').addEventListener('change', (e) => {
    state.batchOptions.similarFaces = e.target.checked;
});

document.getElementById('batchConnectedFaces').addEventListener('change', (e) => {
    state.batchOptions.connectedFaces = e.target.checked;
});

document.getElementById('similarityThreshold').addEventListener('input', (e) => {
    state.batchOptions.similarityThreshold = parseFloat(e.target.value);
    e.target.nextElementSibling.textContent = e.target.value;
});

// 添加高亮开关事件监听
document.getElementById('highlightToggle').addEventListener('change', (e) => {
    state.highlightEnabled = e.target.checked;
    if (!state.highlightEnabled) {
        clearHighlights(state.scene, state.highlightMeshes);
        clearDragOverHighlight();
    }
});

// 初始化场景
init();
