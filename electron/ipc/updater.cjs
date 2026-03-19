const { checkForUpdates, downloadUpdate, installUpdate, getAppVersion } = require('../updater.cjs')

function registerUpdaterHandlers(ipcMain) {
  ipcMain.handle('updater:check', async () => {
    return await checkForUpdates()
  })

  ipcMain.handle('updater:download', async () => {
    await downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    installUpdate()
  })

  ipcMain.handle('updater:version', () => {
    return getAppVersion()
  })
}

module.exports = { registerUpdaterHandlers }