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
    setStatus(`识别错误：${e.error}`);
  };

  recognition.onend = () => {
    if (isListening && recognition) {
      try {
        recognition.start();
      } catch (_) {
        /* 忽略连续 start 抛错 */
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
  setStatus('正在聆听…（请先确保 Cursor 输入框已聚焦）');
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

function wireUi() {
  $('btnStart').addEventListener('click', () => startListening());
  $('btnStop').addEventListener('click', () => stopListening());
  $('btnClear').addEventListener('click', () => clearBuffer());

  window.voiceApp.onToggleListening(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
}

wireUi();
