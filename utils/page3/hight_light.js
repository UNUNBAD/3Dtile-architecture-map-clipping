// 高亮材质
const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
});

// 检查两个三角形是否共面且共享边
function checkAdjacentTriangles(geometry, face1, face2) {
    // 首先检查是否共享边
    const vertices1 = [face1.a, face1.b, face1.c];
    const vertices2 = [face2.a, face2.b, face2.c];
    let sharedVertices = [];
    
    for (let v1 of vertices1) {
        if (vertices2.includes(v1)) {
            sharedVertices.push(v1);
        }
    }
    
    // 必须恰好共享两个顶点（一条边）
    if (sharedVertices.length !== 2) return false;

    // 计算两个三角形的法向量
    const positions = geometry.attributes.position;
    
    // 计算第一个三角形的法向量
    const v1_1 = new THREE.Vector3(
        positions.getX(face1.a),
        positions.getY(face1.a),
        positions.getZ(face1.a)
    );
    const v1_2 = new THREE.Vector3(
        positions.getX(face1.b),
        positions.getY(face1.b),
        positions.getZ(face1.b)
    );
    const v1_3 = new THREE.Vector3(
        positions.getX(face1.c),
        positions.getY(face1.c),
        positions.getZ(face1.c)
    );
    
    const normal1 = new THREE.Vector3()
        .crossVectors(
            new THREE.Vector3().subVectors(v1_2, v1_1),
            new THREE.Vector3().subVectors(v1_3, v1_1)
        )
        .normalize();

    // 计算第二个三角形的法向量
    const v2_1 = new THREE.Vector3(
        positions.getX(face2.a),
        positions.getY(face2.a),
        positions.getZ(face2.a)
    );
    const v2_2 = new THREE.Vector3(
        positions.getX(face2.b),
        positions.getY(face2.b),
        positions.getZ(face2.b)
    );
    const v2_3 = new THREE.Vector3(
        positions.getX(face2.c),
        positions.getY(face2.c),
        positions.getZ(face2.c)
    );
    
    const normal2 = new THREE.Vector3()
        .crossVectors(
            new THREE.Vector3().subVectors(v2_2, v2_1),
            new THREE.Vector3().subVectors(v2_3, v2_1)
        )
        .normalize();

    // 检查法向量是否平行（点积接近1或-1）
    const dotProduct = normal1.dot(normal2);
    const isParallel = Math.abs(Math.abs(dotProduct) - 1) < 0.01;

    if (!isParallel) return false;

    // 计算共享边的方向向量
    const sharedEdge = new THREE.Vector3().subVectors(
        new THREE.Vector3(
            positions.getX(sharedVertices[1]),
            positions.getY(sharedVertices[1]),
            positions.getZ(sharedVertices[1])
        ),
        new THREE.Vector3(
            positions.getX(sharedVertices[0]),
            positions.getY(sharedVertices[0]),
            positions.getZ(sharedVertices[0])
        )
    ).normalize();

    // 计算两个非共享顶点到共享边的垂直向量
    const nonSharedVertex1 = vertices1.find(v => !sharedVertices.includes(v));
    const nonSharedVertex2 = vertices2.find(v => !sharedVertices.includes(v));

    const toVertex1 = new THREE.Vector3(
        positions.getX(nonSharedVertex1),
        positions.getY(nonSharedVertex1),
        positions.getZ(nonSharedVertex1)
    ).sub(new THREE.Vector3(
        positions.getX(sharedVertices[0]),
        positions.getY(sharedVertices[0]),
        positions.getZ(sharedVertices[0])
    ));

    const toVertex2 = new THREE.Vector3(
        positions.getX(nonSharedVertex2),
        positions.getY(nonSharedVertex2),
        positions.getZ(nonSharedVertex2)
    ).sub(new THREE.Vector3(
        positions.getX(sharedVertices[0]),
        positions.getY(sharedVertices[0]),
        positions.getZ(sharedVertices[0])
    ));

    // 计算垂直向量（从共享边到非共享顶点的投影）
    const proj1 = toVertex1.sub(sharedEdge.clone().multiplyScalar(toVertex1.dot(sharedEdge)));
    const proj2 = toVertex2.sub(sharedEdge.clone().multiplyScalar(toVertex2.dot(sharedEdge)));

    // 检查两个垂直向量是否平行且方向相反
    const projDot = proj1.normalize().dot(proj2.normalize());
    const areOpposite = Math.abs(projDot + 1) < 0.01;

    return areOpposite;
}

// 找到相邻的三角形
function findAdjacentTriangle(geometry, face) {
    const faces = [];
    const vertexCount = geometry.attributes.position.count;
    
    // 为每个三角形创建面
    for (let i = 0; i < vertexCount; i += 3) {
        faces.push({
            a: i,
            b: i + 1,
            c: i + 2
        });
    }
    
    // 查找与当前面共面且共享边的面
    for (let otherFace of faces) {
        if (otherFace === face) continue;
        if (checkAdjacentTriangles(geometry, face, otherFace)) {
            return otherFace;
        }
    }
    
    return null;
}

// 设置射线检测器
function setupRaycaster(scene, camera, renderer, initialMesh, highlightMeshes) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredVertex = null;
    let hoveredMarker = null;
    let selectedMesh = initialMesh;

    // 添加清除高亮的按钮
    const clearButton = document.createElement('button');
    clearButton.textContent = '清除高亮';
    clearButton.style.position = 'absolute';
    clearButton.style.top = '10px';
    clearButton.style.right = '10px';
    clearButton.style.zIndex = '1000';
    document.getElementById('modelViewer').appendChild(clearButton);

    clearButton.addEventListener('click', () => {
        clearHighlights(scene, highlightMeshes);
    });

    // 鼠标移动事件
    renderer.domElement.addEventListener('mousemove', (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        
        if (selectedMesh) {
            let closestVertex = null;
            let closestDistance = Infinity;
            let closestMarker = null;

            selectedMesh.traverse((child) => {
                if (child.isMesh && child.userData.vertices) {
                    const vertices = child.userData.vertices;
                    const vertexMarkers = child.userData.vertexMarkers;

                    const rayPoint = new THREE.Vector3();
                    rayPoint.copy(raycaster.ray.origin);
                    child.worldToLocal(rayPoint);

                    vertices.forEach((vertex, index) => {
                        const distance = rayPoint.distanceTo(vertex);
                        if (distance < closestDistance && distance < 0.5) {
                            closestDistance = distance;
                            closestVertex = vertex;
                            closestMarker = vertexMarkers.children[index];
                        }
                    });
                }
            });

            if (hoveredMarker) {
                hoveredMarker.material.visible = false;
            }
            if (closestMarker) {
                closestMarker.material.visible = true;
                hoveredMarker = closestMarker;
                hoveredVertex = closestVertex;
            } else {
                hoveredVertex = null;
                hoveredMarker = null;
            }
        }
    });

    // 点击事件
    renderer.domElement.addEventListener('click', (event) => {
        if (hoveredVertex) {
            console.log('Clicked vertex:', hoveredVertex);
            return;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        
        const meshes = [];
        scene.traverse((object) => {
            if (object.isMesh) {
                meshes.push(object);
            }
        });

        const intersects = raycaster.intersectObjects(meshes, true);
        console.log('Intersects:', intersects);

        if (intersects.length > 0) {
            const intersect = intersects[0];
            if (intersect.face) {
                console.log('Hit object:', intersect.object);
                
                // 检查高亮是否启用
                if (window.state && window.state.highlightEnabled) {
                    // 创建高亮效果
                    createHighlight(intersect, scene, highlightMeshes);
                }
                
                // 存储选中的面（无论高亮是否启用）
                const hitMesh = intersect.object;
                if (hitMesh.isMesh) {
                    hitMesh.userData.selectedFace = intersect.face;
                    selectedMesh = hitMesh;
                    if (window.updateSelectedMesh) {
                        window.updateSelectedMesh(hitMesh);
                    }
                }
            }
        }
    });

    // 添加拖拽事件监听
    renderer.domElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    renderer.domElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        // 检查是否有选中的面
        if (!selectedMesh || !selectedMesh.userData.selectedFace) {
            console.warn('No face selected for texture mapping');
            return;
        }

        const file = e.dataTransfer.files[0];
        if (!file || !file.type.match('image.*')) {
            console.warn('Invalid file type. Please drop an image file.');
            return;
        }

        try {
            // 创建一个Promise来处理图片加载
            const loadTexture = () => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const image = new Image();
                        image.onload = () => {
                            const texture = new THREE.Texture(image);
                            texture.needsUpdate = true;
                            resolve(texture);
                        };
                        image.onerror = reject;
                        image.src = event.target.result;
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            const texture = await loadTexture();

            // 获取选中的面
            const face = selectedMesh.userData.selectedFace;
            
            // 创建新的材质
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide
            });

            // 克隆几何体以便修改
            const geometry = selectedMesh.geometry.clone();
            
            // 确保几何体有UV属性
            if (!geometry.attributes.uv) {
                const positions = geometry.attributes.position;
                const uvs = new Float32Array(positions.count * 2);
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            }
            
            // 创建新的UV坐标
            const uvs = geometry.attributes.uv.array;
            const faceVertices = [face.a, face.b, face.c];
            
            // 为选中的面设置UV坐标
            faceVertices.forEach((vertexIndex, i) => {
                const uvIndex = vertexIndex * 2;
                switch(i) {
                    case 0:
                        uvs[uvIndex] = 0;
                        uvs[uvIndex + 1] = 0;
                        break;
                    case 1:
                        uvs[uvIndex] = 1;
                        uvs[uvIndex + 1] = 0;
                        break;
                    case 2:
                        uvs[uvIndex] = 0.5;
                        uvs[uvIndex + 1] = 1;
                        break;
                }
            });

            geometry.attributes.uv.needsUpdate = true;

            // 创建新的网格
            const newMesh = new THREE.Mesh(geometry, [selectedMesh.material, material]);
            newMesh.position.copy(selectedMesh.position);
            newMesh.rotation.copy(selectedMesh.rotation);
            newMesh.scale.copy(selectedMesh.scale);

            // 替换场景中的网格
            scene.remove(selectedMesh);
            scene.add(newMesh);
            selectedMesh = newMesh;

            // 清除高亮
            clearHighlights(scene, highlightMeshes);

        } catch (error) {
            console.error('Error loading texture:', error);
        }
    });

    return function updateSelectedMesh(mesh) {
        selectedMesh = mesh;
    };
}

// 清除所有高亮
function clearHighlights(scene, highlightMeshes) {
    highlightMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    highlightMeshes.length = 0;
}

// 创建高亮效果
function createHighlight(intersect, scene, highlightMeshes) {
    // 检查高亮是否启用
    if (window.state && !window.state.highlightEnabled) {
        return;
    }

    clearHighlights(scene, highlightMeshes);
    
    const face = intersect.face;
    const geometry = new THREE.BufferGeometry();
    const mesh = intersect.object;
    const positions = mesh.geometry.attributes.position;
    
    const worldVert1 = new THREE.Vector3(
        positions.getX(face.a),
        positions.getY(face.a),
        positions.getZ(face.a)
    ).applyMatrix4(mesh.matrixWorld);

    const worldVert2 = new THREE.Vector3(
        positions.getX(face.b),
        positions.getY(face.b),
        positions.getZ(face.b)
    ).applyMatrix4(mesh.matrixWorld);

    const worldVert3 = new THREE.Vector3(
        positions.getX(face.c),
        positions.getY(face.c),
        positions.getZ(face.c)
    ).applyMatrix4(mesh.matrixWorld);

    const vertices = new Float32Array([
        worldVert1.x, worldVert1.y, worldVert1.z,
        worldVert2.x, worldVert2.y, worldVert2.z,
        worldVert3.x, worldVert3.y, worldVert3.z
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const highlightMesh = new THREE.Mesh(geometry, highlightMaterial.clone());
    scene.add(highlightMesh);
    highlightMeshes.push(highlightMesh);
}

// 导出模块
export {
    setupRaycaster,
    clearHighlights,
    createHighlight
};
