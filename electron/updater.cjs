const { autoUpdater } = require('electron-updater')
const fs = require('fs')
const path = require('path')

let mainWindow = null

function setMainWindow(win) {
  mainWindow = win
}

function cleanupUpdaterFolders() {
  try {
    const { app } = require('electron')
    const localAppData = process.env.LOCALAPPDATA || app.getPath('userData')
    
    const oldUpdaterDir = path.join(localAppData, 'chatanyllm-updater')
    const newUpdaterDir = path.join(localAppData, 'chatanyllm')
    
    console.log('Checking for old updater folder:', oldUpdaterDir)
    
    if (fs.existsSync(oldUpdaterDir)) {
      console.log('Removing old updater folder:', oldUpdaterDir)
      fs.rmSync(oldUpdaterDir, { recursive: true, force: true })
    }
    
    const pendingDir = path.join(newUpdaterDir, 'pending')
    if (fs.existsSync(pendingDir)) {
      const files = fs.readdirSync(pendingDir)
      console.log('Files in pending:', files)
      for (const file of files) {
        const filePath = path.join(pendingDir, file)
        try {
          fs.unlinkSync(filePath)
          console.log('Deleted:', filePath)
        } catch (err) {
          console.error('Failed to delete file:', filePath, err.message)
        }
      }
      try {
        const remaining = fs.readdirSync(pendingDir)
        if (remaining.length === 0) {
          fs.rmdirSync(pendingDir)
        }
      } catch (err) { }
    }
  } catch (error) {
    console.error('Failed to cleanup updater folders:', error)
  }
}

function initAutoUpdater() {
  cleanupUpdaterFolders()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoUpdate = false
  autoUpdater.disableDifferentialDownload = true
  autoUpdater.forceDevUpdateConfig = true
  autoUpdater.devUpdateConfig = {
    provider: 'github',
    owner: 'jinyang6',
    repo: 'chatanyllm'
  }

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('updater:checking')
  })

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('updater:available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    sendToRenderer('updater:not-available', info)
  })

  autoUpdater.on('error', (err) => {
    sendToRenderer('updater:error', { message: err.message })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    sendToRenderer('updater:progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:downloaded', info)
  })
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

async function checkForUpdates() {
  try {
    const result = await autoUpdater.checkForUpdates()
    return result
  } catch (error) {
    return null
  }
}

async function downloadUpdate() {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    console.error('Download update error:', error)
  }
}

function installUpdate() {
  autoUpdater.quitAndInstall(false, true)
}

function getAppVersion() {
  const { app } = require('electron')
  return app.getVersion()
}

module.exports = {
  initAutoUpdater,
  setMainWindow,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getAppVersion
}