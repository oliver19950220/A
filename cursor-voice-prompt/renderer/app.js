/**
 * Web Speech API：中文识别 + 每句 final 通过主进程注入剪贴板并模拟 Ctrl+V
 */

const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;

/** @type {SpeechRecognition | null} */
let recognition = null;
let isListening = false;
/** 本会话是否已成功注入过至少一句（用于句首是否加换行） */
let hasInjectedInSession = false;
let fullBuffer = '';

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  $('status').textContent = msg;
}

function renderPreview() {
  $('preview').textContent = fullBuffer;
}

/**
 * 将 SpeechRecognition 错误码转为用户可读说明（含 H1：网络/VPN/代理）
 * @param {SpeechRecognitionErrorEvent} e
 * @returns {{ message: string, shouldStop: boolean }}
 */
function describeSpeechError(e) {
  const code = e.error;
  /** 应停止聆听、避免 onend 自动重启刷错 */
  const fatalNetwork = code === 'network' || code === 'aborted' || code === 'service-not-allowed';

  const table = {
    network:
      '网络异常：Web Speech 需要向云端上传音频。请尝试关闭或调整 VPN/代理、换网络，或让 Electron 走可访问识别服务的线路。终端里 chunked_data_pipe…Error:-2 多与上传被中断有关。',
    aborted:
      '识别会话被中断。若频繁出现，多为网络或代理不稳定，可按「网络异常」同样排查。',
    'service-not-allowed': '当前环境不允许使用语音识别服务（策略或网络限制）。',
    'not-allowed': '麦克风权限被拒绝。请在系统设置中允许本应用使用麦克风。',
    'audio-capture': '无法访问麦克风。请检查设备连接与其它应用是否占用麦克风。',
    'no-speech': '未检测到语音（可忽略，继续说话即可）。',
    'language-not-supported': '不支持当前语言，请检查 zh-CN 或系统语言设置。',
  };

  if (code === 'no-speech') {
    return { message: table['no-speech'], shouldStop: false };
  }

  if (table[code]) {
    return { message: table[code], shouldStop: fatalNetwork || code === 'not-allowed' || code === 'audio-capture' };
  }

  return {
    message: `识别错误：${code}`,
    shouldStop: fatalNetwork,
  };
}

/**
 * @param {string} transcript
 */
async function onFinalSegment(transcript) {
  const t = (transcript || '').trim();
  if (!t) return;

  const leadingNewline = hasInjectedInSession;
  if (!hasInjectedInSession) {
    hasInjectedInSession = true;
  }
  fullBuffer += (leadingNewline ? '\n' : '') + t;
  renderPreview();

  try {
    setStatus('正在注入到前台焦点…');
    await window.voiceApp.injectSnippet(t, leadingNewline);
    setStatus('已粘贴本句。请保持 Cursor 输入框焦点。');
  } catch (e) {
    setStatus(`注入失败：${e && e.message ? e.message : String(e)}`);
  }
}

function startListening() {
  if (!Recog) {
    setStatus('当前环境不支持 Web Speech API（需 Chromium / WebView2）');
    return;
  }
  if (isListening) return;

  recognition = new Recog();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    setStatus('正在聆听…（请先确保 Cursor 输入框已聚焦）');
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) {
        onFinalSegment(transcript);
      } else {
        $('interim').textContent = transcript;
      }
    }
  };

  recognition.onerror = (e) => {
    const { message, shouldStop } = describeSpeechError(e);
    setStatus(message);
    if (shouldStop) {
      stopListening();
    }
  };

  recognition.onend = () => {
    if (isListening && recognition) {
      try {
        recognition.start();
      } catch (_) {
        /* 连续 start 抛错时忽略 */
      }
    }
  };

  try {
    recognition.start();
  } catch (e) {
    setStatus(`无法启动识别：${e.message || e}`);
    recognition = null;
    return;
  }

  isListening = true;
  $('btnStart').disabled = true;
  $('btnStop').disabled = false;
  setStatus('正在启动麦克风与识别…');
}

function stopListening() {
  isListening = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {
      /* noop */
    }
    recognition = null;
  }
  $('interim').textContent = '';
  $('btnStart').disabled = false;
  $('btnStop').disabled = true;
  setStatus('已停止');
}

function clearBuffer() {
  fullBuffer = '';
  hasInjectedInSession = false;
  $('preview').textContent = '';
  $('interim').textContent = '';
  setStatus('已清空会话缓冲区（下一句不再自动加前置换行）');
}

/**
 * 将手动输入的整段文字注入前台焦点（不依赖 Web Speech）
 */
async function injectManualText() {
  const raw = $('manualText').value || '';
  const text = raw.replace(/\r\n/g, '\n').trimEnd();
  if (!text.trim()) {
    setStatus('请先在下框中输入或粘贴要注入的文字。');
    return;
  }

  const leadingNewline = hasInjectedInSession;
  try {
    setStatus('正在注入手动内容到前台焦点…');
    await window.voiceApp.injectSnippet(text, leadingNewline);
    if (!hasInjectedInSession) {
      hasInjectedInSession = true;
    }
    fullBuffer += (leadingNewline ? '\n' : '') + text;
    renderPreview();
    setStatus('已粘贴手动内容。若 Cursor 里没有出现，请确认输入框仍为前台焦点。');
  } catch (e) {
    setStatus(`手动注入失败：${e && e.message ? e.message : String(e)}`);
  }
}

/**
 * 验证剪贴板 + 模拟 Ctrl+V 是否正常（与语音识别无关）
 */
async function testPasteToFocus() {
  try {
    setStatus('正在发送测试片段到前台焦点…');
    await window.voiceApp.injectSnippet('【粘贴测试】', false);
    setStatus('若 Cursor 输入框出现「【粘贴测试】」，说明注入链路正常，问题在语音识别网络。');
  } catch (e) {
    setStatus(`测试失败：${e && e.message ? e.message : String(e)}`);
  }
}

function wireUi() {
  $('btnStart').addEventListener('click', () => startListening());
  $('btnStop').addEventListener('click', () => stopListening());
  $('btnClear').addEventListener('click', () => clearBuffer());
  $('btnInjectManual').addEventListener('click', () => injectManualText());
  $('btnTestPaste').addEventListener('click', () => testPasteToFocus());

  window.voiceApp.onToggleListening(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
}

wireUi();
