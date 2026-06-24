import { NextResponse } from "next/server";

export async function GET() {
  const jsContent = `
(function() {
  // Prevent multiple injections
  if (window.__nauticsecureChatWidgetLoaded) return;
  window.__nauticsecureChatWidgetLoaded = true;

  var script = document.currentScript;
  var harborId      = script.getAttribute('data-harbor-id') || '';
  var harborName    = script.getAttribute('data-harbor-name') || '';
  var boatId        = script.getAttribute('data-boat-id') || '';
  var locationId    = script.getAttribute('data-location-id') || '';
  var widgetType    = script.getAttribute('data-widget-type') || 'lead';
  var widgetMode    = script.getAttribute('data-widget-mode') || '';
  var tenant        = script.getAttribute('data-tenant') || 'schepenkring';
  var locale        = script.getAttribute('data-locale') || (document.documentElement.lang || 'nl').split('-')[0];
  var accentColor   = script.getAttribute('data-accent-color') || '';
  var themePreset   = script.getAttribute('data-theme') || 'ocean';
  var welcomeText   = script.getAttribute('data-welcome-text') || '';

  // ── Auto-detect boat from page ──────────────────────────────
  if (!boatId) {
    var metaBoat = document.querySelector('meta[name="boat-id"], meta[property="boat:id"]');
    if (metaBoat) boatId = metaBoat.getAttribute('content') || '';

    if (!boatId) {
      var urlMatch = window.location.pathname.match(/\\/(?:aanbod-boten|aanbod|boten)\\/([0-9]+)/);
      if (urlMatch) boatId = urlMatch[1];
    }

    if (!boatId) {
      try {
        var jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          var ld = JSON.parse(jsonLd.textContent);
          if (ld && ld.productID) boatId = String(ld.productID);
        }
      } catch(e) {}
    }

    if (!boatId) {
      var boatEl = document.querySelector('[data-boat-id]');
      if (boatEl) boatId = boatEl.getAttribute('data-boat-id') || '';
    }
  }

  // ── Auto-detect harbor name from page text ─────────────────
  if (!harborName && !locationId && !harborId) {
    try {
      var pageText = document.body ? document.body.innerText : '';
      var harborMatch = pageText.match(/verkoophaven Schepenkring ([A-Za-z\\u00C0-\\u017E\\- ]+)/i);
      if (harborMatch) harborName = harborMatch[1].trim().split('\\n')[0].trim();
    } catch(e) {}
  }

  // ── Determine effective widget mode ────────────────────────
  var effectiveMode;
  if (widgetType === 'lead') {
    effectiveMode = 'lead';
  } else if (widgetMode) {
    effectiveMode = widgetMode;
  } else if (boatId) {
    effectiveMode = 'lead';
  } else {
    effectiveMode = 'chat';
  }

  // ── Build iframe src ────────────────────────────────────────
  var host = new URL(script.src).origin;
  var params = new URLSearchParams();
  if (harborId)     params.append('harborId', harborId);
  if (harborName)   params.append('harborName', harborName);
  if (boatId)       params.append('boatId', boatId);
  if (locationId)   params.append('locationId', locationId);
  params.append('widgetMode', effectiveMode);
  if (tenant)       params.append('tenant', tenant);
  if (locale)       params.append('locale', locale);
  if (accentColor)  params.append('accentColor', accentColor);
  if (themePreset)  params.append('themePreset', themePreset);
  if (welcomeText)  params.append('welcomeText', welcomeText);
  params.append('sourceUrl', window.location.href);

  var iframeSrc = host + '/' + locale + '/widget?' + params.toString();

  // ── Container ───────────────────────────────────────────────
  var container = document.createElement('div');
  container.id = 'nauticsecure-chat-container';
  container.style.position = 'fixed';
  container.style.zIndex = '2147483647';
  container.style.transition = 'all 0.3s ease';
  container.style.pointerEvents = 'none';

  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';
  iframe.style.colorScheme = 'normal';
  iframe.style.pointerEvents = 'auto';
  iframe.setAttribute('title', 'Schepenkring contact');

  container.appendChild(iframe);
  document.body.appendChild(container);

  function setCollapsed() {
    container.style.width = '200px';
    container.style.height = '56px';
    container.style.bottom = '24px';
    container.style.right = '24px';
  }

  function setExpanded(isMobile) {
    if (isMobile) {
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.bottom = '0';
      container.style.right = '0';
    } else {
      container.style.width = '400px';
      container.style.height = '640px';
      container.style.bottom = '0';
      container.style.right = '24px';
    }
  }

  setCollapsed();

  window.addEventListener('message', function(event) {
    if (event.origin !== host) return;
    var d = event.data;
    if (!d || !d.type) return;

    if (d.type === 'LEAD_WIDGET_STATE' || d.type === 'CHAT_WIDGET_STATE') {
      if (d.isOpen) {
        setExpanded(!!d.isMobile);
      } else {
        setCollapsed();
      }
    }
  });

  window.addEventListener('resize', function() {
    try {
      iframe.contentWindow.postMessage({ type: 'HOST_WINDOW_RESIZE', width: window.innerWidth }, host);
    } catch(e) {}
  });
})();
`;

  return new NextResponse(jsContent, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
