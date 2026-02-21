const path = require('path')
const fs = require('fs/promises')

function registerFsHandlers(ipcMain) {
  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    try {
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`
      await fs.writeFile(tempPath, content, 'utf-8')
      await fs.rename(tempPath, filePath)

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:deleteFile', async (event, filePath) => {
    try {
      await fs.unlink(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:readDir', async (event, dirPath) => {
    try {
      const files = await fs.readdir(dirPath)
      return { success: true, files }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:exists', async (event, filePath) => {
    try {
      await fs.access(filePath)
      return { success: true, exists: true }
    } catch {
      return { success: true, exists: false }
    }
  })

  ipcMain.handle('fs:mkdir', async (event, dirPath) => {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:writeBinaryFile', async (event, filePath, base64Data) => {
    try {
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(cleanBase64, 'base64')

      const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`
      await fs.writeFile(tempPath, buffer)
      await fs.rename(tempPath, filePath)

      return { success: true, path: filePath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

module.exports = { registerFsHandlers }
