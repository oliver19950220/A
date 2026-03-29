const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voiceApp', {
  /**
   * @param {string} text 本句 final 文本
   * @param {boolean} leadingNewline 是否在剪贴板内容前加换行（首句为 false）
   */
  injectSnippet: (text, leadingNewline) =>
    ipcRenderer.invoke('inject-snippet', { text, leadingNewline }),

  /** @param {() => void} callback */
  onToggleListening: (callback) => {
    const channel = 'toggle-listening';
    ipcRenderer.on(channel, () => callback());
  },
});
