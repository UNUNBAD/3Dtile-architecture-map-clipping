const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 确保输出目录存在
const distDir = path.join(__dirname, 'dist', 'python');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

try {
    // 安装 PyInstaller（如果尚未安装）
    console.log('Installing PyInstaller...');
    execSync('pip install pyinstaller', { stdio: 'inherit' });

    // 使用 PyInstaller 打包 Python 脚本
    console.log('Building Python script...');
    execSync('pyinstaller --onefile --distpath ./dist/python --workpath ./build --clean --noconfirm script/001.py', { 
        stdio: 'inherit',
        env: {
            ...process.env,
            PYTHONOPTIMIZE: "1"  // 优化字节码
        }
    });

    console.log('Python script built successfully!');
} catch (error) {
    console.error('Error building Python script:', error);
    process.exit(1);
} 