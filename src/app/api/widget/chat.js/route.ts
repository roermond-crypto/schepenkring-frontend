import { NextResponse } from "next/server";

export async function GET() {
  const jsContent = `
(function() {
  // Prevent multiple injections
  if (window.__nauticsecureChatWidgetLoaded) return;
  window.__nauticsecureChatWidgetLoaded = true;

  var script = document.currentScript;
  var host        = new URL(script.src).origin;
  var harborId    = script.getAttribute('data-harbor-id') || '';
  var harborName  = script.getAttribute('data-harbor-name') || '';
  var boatId      = script.getAttribute('data-boat-id') || '';
  var locationId  = script.getAttribute('data-location-id') || '';
  var widgetType  = script.getAttribute('data-widget-type') || 'lead';
  var widgetMode  = script.getAttribute('data-widget-mode') || '';
  var tenant      = script.getAttribute('data-tenant') || 'schepenkring';
  var locale      = script.getAttribute('data-locale') || (document.documentElement.lang || 'nl').split('-')[0];
  var accentColor = script.getAttribute('data-accent-color') || '';
  var themePreset = script.getAttribute('data-theme') || 'ocean';
  var welcomeText = script.getAttribute('data-welcome-text') || '';

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

  // ── Build and inject the widget iframe ─────────────────────
  function injectWidget() {
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

    var params = new URLSearchParams();
    if (harborId)    params.append('harborId',    harborId);
    if (harborName)  params.append('harborName',  harborName);
    if (boatId)      params.append('boatId',      boatId);
    if (locationId)  params.append('locationId',  locationId);
    params.append('widgetMode', effectiveMode);
    if (tenant)      params.append('tenant',      tenant);
    if (locale)      params.append('locale',      locale);
    if (accentColor) params.append('accentColor', accentColor);
    if (themePreset) params.append('themePreset', themePreset);
    if (welcomeText) params.append('welcomeText', welcomeText);
    params.append('sourceUrl', window.location.href);

    var iframeSrc = host + '/' + locale + '/widget?' + params.toString();

    var container = document.createElement('div');
    container.id = 'nauticsecure-chat-container';
    container.style.cssText = 'position:fixed;z-index:2147483647;transition:all 0.3s ease;pointer-events:none;';

    var iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;color-scheme:normal;pointer-events:auto;';
    iframe.setAttribute('title', 'Schepenkring contact');
    iframe.setAttribute('loading', 'lazy');

    container.appendChild(iframe);
    document.body.appendChild(container);

    function setCollapsed() {
      container.style.width  = '200px';
      container.style.height = '56px';
      container.style.bottom = '24px';
      container.style.right  = '24px';
    }

    function setExpanded(isMobile) {
      if (isMobile) {
        container.style.width  = '100vw';
        container.style.height = '100vh';
        container.style.bottom = '0';
        container.style.right  = '0';
      } else {
        container.style.width  = '400px';
        container.style.height = '640px';
        container.style.bottom = '0';
        container.style.right  = '24px';
      }
    }

    setCollapsed();

    window.addEventListener('message', function(event) {
      if (event.origin !== host) return;
      var d = event.data;
      if (!d || !d.type) return;
      if (d.type === 'LEAD_WIDGET_STATE' || d.type === 'CHAT_WIDGET_STATE') {
        if (d.isOpen) { setExpanded(!!d.isMobile); } else { setCollapsed(); }
      }
    });

    window.addEventListener('resize', function() {
      try { iframe.contentWindow.postMessage({ type: 'HOST_WINDOW_RESIZE', width: window.innerWidth }, host); } catch(e) {}
    });
  }

  // ── Resolve location from boat ID if not explicitly set ─────
  // Called from external site (e.g. schepenkring.nl/aanbod-boten/2006423/).
  // When the script has no data-location-id but detects a boatId from the URL,
  // it asks the backend which location owns that boat and loads that location's
  // widget settings (accent colour, theme, welcome text) before rendering.
  if (boatId && !locationId) {
    fetch(host + '/api/widget/boat-context?boat_id=' + encodeURIComponent(boatId), { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(ctx) {
        if (ctx) {
          if (ctx.location_id) locationId  = String(ctx.location_id);
          if (ctx.harbor_id)   harborId    = String(ctx.harbor_id);
          if (ctx.harbor_name) harborName  = ctx.harbor_name;
          if (ctx.accent_color && !accentColor) accentColor = ctx.accent_color;
          if (ctx.theme && themePreset === 'ocean') themePreset = ctx.theme;
          if (ctx.welcome_text && !welcomeText)   welcomeText  = ctx.welcome_text;
        }
        injectWidget();
      })
      .catch(function() { injectWidget(); }); // fall back to generic widget on error
  } else {
    injectWidget();
  }
})();
`;

  return new NextResponse(jsContent, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      // Widget script is loaded cross-origin from schepenkring.nl
      "Access-Control-Allow-Origin": "*",
    },
  });
}
