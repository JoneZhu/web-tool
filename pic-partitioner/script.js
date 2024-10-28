// 显示提示信息
function displayMessage(message) {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message';
    messageContainer.textContent = message;
    messageContainer.style.cssText = `
        position: fixed;
        top: 15%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(255, 0, 0, 0.2);
        color: red;
        padding: 20px;
        border-radius: 5px;
        text-align: center;
        z-index: 1000;
        max-width: 80%;
    `;
    document.body.appendChild(messageContainer);

    // 禁用按钮
    const buttons = ['selectSourceBtn', 'selectTargetBtn', 'startCopyBtn'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = true;
        }
    });
}

// 检查浏览器是否支持 Native File System API
if ('showDirectoryPicker' in window) {
    const selectSourceBtn = document.getElementById('selectSourceBtn');
    const selectTargetBtn = document.getElementById('selectTargetBtn');
    const startCopyBtn = document.getElementById('startCopyBtn');
    const sourcePathInput = document.getElementById('sourcePath');
    const targetPathInput = document.getElementById('targetPath');
    const fileListContainer = document.getElementById('fileListContainer');

    let source_folder = null;
    let target_folder = null;

    // 从localStorage加载上次选择的目录
    const lastSourceDir = localStorage.getItem('lastSourceDir');
    const lastTargetDir = localStorage.getItem('lastTargetDir');

    // 选择源文件夹
    selectSourceBtn.addEventListener('click', async () => {
        try {
            const startIn = lastSourceDir ? { startIn: lastSourceDir } : undefined;
            source_folder = await window.showDirectoryPicker();
            sourcePathInput.value = source_folder.name;
            localStorage.setItem('lastSourceDir', source_folder.name);
        } catch (err) {
            console.error('选择源文件夹时出错:', err);
        }
    });

    // 选择目标文件夹
    selectTargetBtn.addEventListener('click', async () => {
        try {
            const startIn = lastTargetDir ? { startIn: lastTargetDir } : undefined;
            target_folder = await window.showDirectoryPicker();
            targetPathInput.value = target_folder.name;
            localStorage.setItem('lastTargetDir', target_folder.name);
        } catch (err) {
            console.error('选择目标文件夹时出错:', err);
        }
    });

    // 开始复制
    startCopyBtn.addEventListener('click', async () => {
        if (!source_folder || !target_folder) {
            displayMessage('请先选择源文件夹和目标文件夹');
            return;
        }

        try {
            // 创建进度条和蒙层
            const overlay = createProgressBar();
            document.body.appendChild(overlay);

            await processFiles(overlay.querySelector('#progressBar'));
        } catch (err) {
            console.error('处理文件时出错:', err);
        } finally {
            // 移除蒙层和进度条
            const overlay = document.getElementById('overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    });

    // 显示文件列表
    async function displayFileList(folder) {
        const fileList = document.createElement('ul');
        fileList.id = 'sourceFileList';
        
        for await (const entry of folder.values()) {
            const listItem = document.createElement('li');
            listItem.textContent = `${entry.kind}: ${entry.name}`;
            fileList.appendChild(listItem);
        }
        
        fileListContainer.innerHTML = '';
        fileListContainer.appendChild(fileList);
    }

    // 处理文件
    async function processFiles(progressBar) {
        // 在 source_folder 中创建一个名字是 target_folder 名字的文件夹
        let folderInSource;
        try { 
            folderInSource = await target_folder.getDirectoryHandle(source_folder.name, { create: true });
        } catch (err) {
            console.error(`创建文件夹 ${target_folder.name} 时出错:`, err);
            return;
        }

        let totalFiles = 0;
        let processedFiles = 0;

        // 计算总文件数
        for await (const entry of target_folder.values()) {
            if (entry.kind === 'file') {
                totalFiles++;
            }
        }

        for await (const entry of target_folder.values()) {
            if (entry.kind === 'file') {
                const fileName = entry.name.split('.')[0]; // 提取文件名（不包含扩展名）
                const fileExtension = entry.name.split('.').pop(); // 提取文件扩展名
                const matchingFile = await findMatchingFolder(source_folder, fileName, fileExtension);
                
                if (matchingFile) {
                    try {
                        // 更新进度条和当前处理的文件名
                        updateProgressBar(progressBar, ++processedFiles, totalFiles, entry.name);

                        const fileHandle = await source_folder.getFileHandle(matchingFile.name);
                        await copyFile(fileHandle, folderInSource, matchingFile.name);
                        console.log(`文件 ${entry.name} 已移动到 ${target_folder.name}`);
                    } catch (err) {
                        console.error(`移动文件 ${matchingFile.name} 时出错:`, err);
                    }
                } else {
                    console.log(`未找到匹配的文件: ${fileName}`);
                }
            }
        }
        alert('文件处理完成');
    }
    // 查找匹配的文件夹
    async function findMatchingFolder(folder, fileName, fileExtension) {
        for await (const entry of folder.values()) {
            if (entry.kind === 'file' && entry.name.split('.')[0] === fileName ) {
                return entry;
            }
        }
        return null;
    }

    // 移动文件
    async function copyFile(fileHandle, targetFolder, fileName) {
        const overallStartTime = performance.now();
        let stageStartTime, stageEndTime;

        try {
            // 获取文件
            stageStartTime = performance.now();
            const file = await fileHandle.getFile();
            stageEndTime = performance.now();
            console.log(`获取文件耗时: ${(stageEndTime - stageStartTime).toFixed(2)} 毫秒`);

            // 创建新文件句柄
            stageStartTime = performance.now();
            const newFileHandle = await targetFolder.getFileHandle(fileName, { create: true });
            stageEndTime = performance.now();
            console.log(`创建新文件句柄耗时: ${(stageEndTime - stageStartTime).toFixed(2)} 毫秒`);

            // 创建可写流
            stageStartTime = performance.now();
            const writable = await newFileHandle.createWritable();
            stageEndTime = performance.now();
            console.log(`创建可写流耗时: ${(stageEndTime - stageStartTime).toFixed(2)} 毫秒`);

            // 写入文件
            stageStartTime = performance.now();
            await writable.write(file);
            stageEndTime = performance.now();
            console.log(`写入文件耗时: ${(stageEndTime - stageStartTime).toFixed(2)} 毫秒`);

            // 关闭可写流
            stageStartTime = performance.now();
            await writable.close();
            stageEndTime = performance.now();
            console.log(`关闭可写流耗时: ${(stageEndTime - stageStartTime).toFixed(2)} 毫秒`);

            const overallEndTime = performance.now();
            console.log(`文件 ${fileName} 复制完成，总耗时 ${(overallEndTime - overallStartTime).toFixed(2)} 毫秒`);
        } catch (error) {
            console.error(`复制文件 ${fileName} 时出错:`, error);
            throw error;
        }
    }

    // 创建进度条和蒙层
    function createProgressBar() {
        // 创建蒙层
        const overlay = document.createElement('div');
        overlay.id = 'overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 999;
        `;

        // 创建进度条容器
        const progressBarContainer = document.createElement('div');
        progressBarContainer.id = 'progressBar';
        progressBarContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            height: 50px;
            background-color: #f0f0f0;
            border-radius: 5px;
            overflow: hidden;
            z-index: 1000;
        `;

        // ... 其余进度条代码保持不变 ...
        const progressBarFill = document.createElement('div');
        progressBarFill.style.cssText = `
            width: 0%;
            height: 100%;
            background-color: #4CAF50;
            transition: width 0.3s ease-in-out;
        `;

        const progressText = document.createElement('div');
        progressText.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #000;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 90%;
            text-align: center;
        `;

        progressBarContainer.appendChild(progressBarFill);
        progressBarContainer.appendChild(progressText);

        // 将进度条添加到蒙层中
        overlay.appendChild(progressBarContainer);

        return overlay;
    }

    // 更新进度条
    function updateProgressBar(progressBar, current, total, fileName) {
        const percentage = (current / total) * 100;
        const progressBarFill = progressBar.firstChild;
        const progressText = progressBar.lastChild;

        progressBarFill.style.width = `${percentage}%`;
        
        // 限制文件名长度，超过部分用省略号替代
        const maxLength = 20; // 你可以根据需要调整这个值
        let displayFileName = fileName;
        if (fileName.length > maxLength) {
            displayFileName = fileName.substring(0, maxLength - 3) + '...';
        }
        
        progressText.textContent = `${displayFileName} (${current}/${total})`;
        progressText.title = fileName; // 添加完整文件名作为提示
    }

} else {
    displayMessage('您的浏览器不支持 Native File System API，无法使用此功能。请在Mac或Win上使用chrome浏览器中打开');
}