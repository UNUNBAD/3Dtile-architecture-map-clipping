// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron')
const path = require('node:path')
const fs = require('fs')

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    // 添加图标配置
    icon: path.join(__dirname, 'assets', '/app-icon.ico')
  })

  // 隐藏菜单栏
  Menu.setApplicationMenu(null)

  // 启用remote模块
  require('@electron/remote/main').initialize()
  require('@electron/remote/main').enable(mainWindow.webContents)

  // 设置Content-Security-Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:"]
      }
    })
  });

  // 加载应用的 index.html
  mainWindow.loadFile('app/home.html')
  
  // 打开开发者工具
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// 添加路径格式化函数
function formatWindowsPath(inputPath) {
  if (!inputPath) return '';
  
  let path = inputPath.trim();
  
  // 确保驱动器字母后有反斜杠
  if (path.match(/^[A-Za-z]:/)) {
    path = path.replace(/^([A-Za-z]:)(?!\\)/, '$1\\');
  }
  
  // 替换所有正斜杠为反斜杠
  path = path.replace(/\//g, '\\');
  
  // 移除多余的反斜杠
  path = path.replace(/\\+/g, '\\');
  
  return path;
}

// 处理保存图片的IPC请求
ipcMain.handle('save-image', async (event, { imageData, defaultPath, filename }) => {
  try {
    // 确保路径格式正确
    let normalizedPath = formatWindowsPath(defaultPath);
    
    // 确保目录存在
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true });
    }

    // 从Base64数据中提取实际的图片数据
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 构建完整的文件路径（不要在文件路径末尾添加额外的反斜杠）
    const filePath = path.join(normalizedPath, filename);
    
    // 写入文件
    fs.writeFileSync(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    console.error('保存图片失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理保存JSON的IPC请求
ipcMain.handle('save-json', async (event, { jsonData, defaultPath, filename }) => {
  try {
    // 确保路径格式正确
    let normalizedPath = formatWindowsPath(defaultPath);
    
    // 确保目录存在
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true });
    }

    // 构建完整的文件路径（不要在文件路径末尾添加额外的反斜杠）
    const filePath = path.join(normalizedPath, filename);
    
    // 写入文件
    fs.writeFileSync(filePath, jsonData);
    return { success: true, filePath };
  } catch (error) {
    console.error('保存JSON失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取设置文件路径
const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.json');

// 处理保存设置的IPC请求
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('保存设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理加载设置的IPC请求
ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return { success: true, settings };
    }
    return { success: true, settings: {} };
  } catch (error) {
    console.error('加载设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理开始监控的IPC请求
ipcMain.handle('start-monitor', async (event, { outputPath, monitorPath }) => {
  try {
    // TODO: 实现监控逻辑
    console.log('开始监控:', { outputPath, monitorPath });
    return { success: true };
  } catch (error) {
    console.error('开始监控失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理停止监控的IPC请求
ipcMain.handle('stop-monitor', async () => {
  try {
    // TODO: 实现停止监控逻辑
    console.log('停止监控');
    return { success: true };
  } catch (error) {
    console.error('停止监控失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理获取文件列表的IPC请求
ipcMain.handle('get-file-list', async (event, dirPath) => {
  try {
    // 确保路径格式正确
    let normalizedPath = formatWindowsPath(dirPath);

    if (!fs.existsSync(normalizedPath)) {
      return { success: false, error: '目录不存在' };
    }

    const files = fs.readdirSync(normalizedPath);
    const fileList = files
      .filter(file => file.endsWith('.png') || file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(normalizedPath, file),
        type: path.extname(file).substring(1),
        timestamp: fs.statSync(path.join(normalizedPath, file)).mtime.getTime()
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return { success: true, files: fileList };
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理打开文件的IPC请求
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('打开文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理在文件夹中显示的IPC请求
ipcMain.handle('show-in-folder', async (event, filePath) => {
  try {
    await shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('在文件夹中显示失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理选择文件夹的IPC请求
ipcMain.handle('select-folder', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (!result.canceled) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: '用户取消选择' };
  } catch (error) {
    console.error('选择文件夹失败:', error);
    return { success: false, error: error.message };
  }
});

// 处理获取保存路径的请求
ipcMain.handle('get-save-path', async () => {
    // 返回配置的保存路径
    return app.getPath('pictures');  // 默认使用图片文件夹，您可以修改为其他路径
});

// 处理保存截图的请求
ipcMain.handle('save-screenshot', async (event, { imageData, savePath, filename }) => {
    try {
        // 确保目录存在
        if (!fs.existsSync(savePath)) {
            fs.mkdirSync(savePath, { recursive: true });
        }

        // 从base64数据中提取实际的图片数据
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // 保存文件
        const filePath = path.join(savePath, filename);
        fs.writeFileSync(filePath, buffer);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 处理保存元数据的请求
ipcMain.handle('save-metadata', async (event, { jsonData, savePath, filename }) => {
    try {
        // 确保目录存在
        if (!fs.existsSync(savePath)) {
            fs.mkdirSync(savePath, { recursive: true });
        }

        // 保存JSON文件
        const filePath = path.join(savePath, filename);
        fs.writeFileSync(filePath, jsonData);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
