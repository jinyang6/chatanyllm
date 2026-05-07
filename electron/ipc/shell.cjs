function registerShellHandlers(ipcMain, getMainWindow, shell, dialog) {
  ipcMain.handle('shell:openExternal', async (event, url) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
    try {
      await shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dialog:openFile', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), options)
      return { success: true, ...result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(getMainWindow(), options)
      return { success: true, ...result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    const win = getMainWindow()
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  ipcMain.handle('window:close', () => {
    getMainWindow()?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return getMainWindow()?.isMaximized() ?? false
  })
}

module.exports = { registerShellHandlers }
