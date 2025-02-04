const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 确保输出目录存在
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

try {
    // 1. 打包 Python 脚本
    console.log('Building Python script...');
    execSync('node build-python.js', { stdio: 'inherit' });

    // 2. 打包 Electron 应用
    console.log('Building Electron app...');
    execSync('npx electron-packager . 3DTILE_IMG_CUT --platform=win32 --arch=x64 --out=dist --overwrite', { stdio: 'inherit' });

    // 3. 创建 python 目录并复制 Python 程序
    const pythonDir = path.join(distDir, '3DTILE_IMG_CUT-win32-x64', 'resources', 'python');
    if (!fs.existsSync(pythonDir)) {
        fs.mkdirSync(pythonDir, { recursive: true });
    }

    // 复制 Python 程序
    fs.copyFileSync(
        path.join(distDir, 'python', '001.exe'),
        path.join(pythonDir, '001.exe')
    );

    console.log('Build completed successfully!');
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}
