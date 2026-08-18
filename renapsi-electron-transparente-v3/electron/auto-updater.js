const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

function setupAutoUpdater(app, getMainWindow) {
  if (!app.isPackaged) {
    log.info('Modo dev: auto-update desativado.');
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => log.info('Verificando atualização...'));
  autoUpdater.on('update-available', (info) => log.info('Atualização disponível:', info?.version || ''));
  autoUpdater.on('update-not-available', (info) => log.info('Nenhuma atualização disponível.', info?.version || ''));
  autoUpdater.on('download-progress', (progress) => log.info(`Baixando atualização: ${progress.percent.toFixed(1)}%`));
  autoUpdater.on('error', (error) => log.error('Erro no auto-update:', error));
  autoUpdater.on('update-downloaded', async (info) => {
    const mainWindow = getMainWindow();
    log.info('Atualização baixada:', info?.version || '');
    if (!mainWindow || mainWindow.isDestroyed()) {
      autoUpdater.quitAndInstall(true, true);
      return;
    }
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `A versão ${info?.version || 'nova'} foi baixada com sucesso.`,
      detail: 'Deseja reiniciar o app agora para concluir a atualização?'
    });
    if (result.response === 0) autoUpdater.quitAndInstall(true, true);
  });
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
}

module.exports = { setupAutoUpdater };
