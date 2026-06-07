(function () {
  var script = document.currentScript;
  if (!script) return;

  var botId = script.getAttribute('data-bot-id');
  if (!botId) {
    console.error('[botio-widget] missing data-bot-id');
    return;
  }

  var baseUrl = script.src.replace(/\/widget-loader\.js.*$/, '');
  var widgetUrl = baseUrl + '/widget/' + botId;
  var unread = 0;
  var open = false;

  var launcher = document.createElement('button');
  launcher.setAttribute('aria-label', 'Abrir chat');
  launcher.innerHTML =
    '<span style="font-size:20px;line-height:1">💬</span><span style="margin-left:6px;font-weight:600">Chat</span>';
  launcher.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;align-items:center;gap:4px;' +
    'padding:12px 18px;border:none;border-radius:999px;background:#6B4EFF;color:#fff;' +
    'font-family:system-ui,sans-serif;font-size:14px;cursor:pointer;box-shadow:0 4px 20px rgba(107,78,255,0.45);';

  var badge = document.createElement('span');
  badge.style.cssText =
    'display:none;position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;' +
    'border-radius:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;' +
    'line-height:20px;text-align:center;padding:0 5px;';
  launcher.style.position = 'fixed';
  launcher.appendChild(badge);

  var panel = document.createElement('div');
  panel.style.cssText =
    'display:none;position:fixed;bottom:90px;right:24px;z-index:99998;width:380px;max-width:calc(100vw - 32px);' +
    'height:520px;max-height:calc(100vh - 120px);border-radius:16px;overflow:hidden;' +
    'box-shadow:0 8px 40px rgba(0,0,0,0.18);background:#fff;';

  var iframe = document.createElement('iframe');
  iframe.src = widgetUrl;
  iframe.title = 'Kalyo Chat';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  panel.appendChild(iframe);

  function setUnread(n) {
    unread = n;
    if (n > 0 && !open) {
      badge.textContent = '+' + n;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  launcher.addEventListener('click', function () {
    open = !open;
    panel.style.display = open ? 'block' : 'none';
    if (open) setUnread(0);
  });

  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'botio-widget-new-message' && !open) {
      setUnread(unread + 1);
    }
  });

  document.body.appendChild(panel);
  document.body.appendChild(launcher);
})();
