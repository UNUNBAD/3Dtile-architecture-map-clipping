# 3DTILE_IMG_CUT
一个基于Electron的专业3D瓦片图像处理工具，提供图像编辑功能。

## 技术栈
- **Electron**: v34.0.2 - 跨平台桌面应用框架
- **Node.js** - 后端运行环境
- **Babylon.js**: v7.47.2 - 3D渲染引擎
- **Cesium**: v1.125.0 - 地理信息系统功能
- **Webpack** - 资源打包工具

## 主要功能
### 3D可视化
- 3Dtile模型加载

### 图像处理
- 智能截图功能
  - 自定义区域截取

## 系统要求
- 操作系统：Windows 10/11, macOS, Linux
- 内存：最低4GB，推荐8GB以上
- 显卡：支持WebGL 2.0的显卡
- 存储空间：至少500MB可用空间

## 安装步骤
确保您的系统已安装以下软件：
- [Git](https://git-scm.com)
- [Node.js](https://nodejs.org/en/download/) (推荐v16.0.0以上版本)

然后执行以下命令：

```bash
# 克隆仓库
git clone git@github.com:UNUNBAD/3Dtile-architecture-map-clipping.git

# 进入项目目录
cd 3DTILE_IMG_CUT

# 安装依赖
npm install

# 运行应用
npm start
```

## 开发指南

### 项目结构
```
3DTILE_IMG_CUT/
├── app/                # 应用程序主要页面
│   ├── home.html      # 主页
│   ├── index.html     # 入口页面
│   └── page3_UV.html  # UV映射页面
├── utils/             # 工具类模块
│   ├── img_cut.js     # 图像处理核心
│   ├── view_sync.js   # 视图同步
│   └── page3/         # 页面特定功能
├── assets/            # 静态资源
├── main.js           # 主进程文件
└── package.json      # 项目配置
```

### 构建命令
```bash
# 开发模式
npm start

# 清理构建并打包应用（Windows PowerShell）
# 1. 清理dist目录
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue

# 2. 构建Python组件
node build-python.js

# 3. 打包Electron应用
npx electron-packager . 图像处理工具 --platform=win32 --arch=x64 --out=dist --overwrite

# 4. 配置Python资源
mkdir -Force "dist/图像处理工具-win32-x64/resources/python"
Copy-Item "dist/python/001.exe" -Destination "dist/图像处理工具-win32-x64/resources/python/001.exe"
```

### 打包说明
1. 确保系统已安装PowerShell
2. 打包过程会自动处理以下内容：
   - 清理旧的构建文件
   - 构建必要的Python组件
   - 打包Electron应用
   - 配置Python资源文件
3. 打包完成后，可在`dist/图像处理工具-win32-x64`目录找到可执行文件

## 使用指南

### 基本操作
1. 启动应用后，选择需要处理的3D模型或图像文件
2. 使用左右视图进行对比和编辑
3. 利用工具栏进行图像处理操作
4. 保存处理结果

### 快捷键
- `Ctrl + O`: 打开文件
- `Ctrl + S`: 保存当前工作
- `Ctrl + Z`: 撤销操作
- `Space`: 重置视图

## 联系方式
- 项目维护者：[李佳祥]
- 邮箱：[1756366867@qq.com]
- 项目主页：[https://github.com/UNUNBAD/3Dtile-architecture-map-clipping]
