import { NextResponse } from "next/server";

export async function GET() {
  const jsContent = `
(function() {
  // Prevent multiple injections
  if (window.__nauticsecureChatWidgetLoaded) return;
  window.__nauticsecureChatWidgetLoaded = true;

  const script = document.currentScript;
  const harborId = script.getAttribute('data-harbor-id') || '';
  const harborName = script.getAttribute('data-harbor-name') || '';
  const boatId = script.getAttribute('data-boat-id') || '';
  const locationId = script.getAttribute('data-location-id') || '';
  const widgetMode = script.getAttribute('data-widget-mode') || (boatId ? 'smart' : 'chat');
  const tenant = script.getAttribute('data-tenant') || 'schepenkring';
  const locale = script.getAttribute('data-locale') || document.documentElement.lang?.split('-')[0] || 'en';
  const accentColor = script.getAttribute('data-accent-color') || '';
  const themePreset = script.getAttribute('data-theme') || 'ocean';
  
  // Create container
  const container = document.createElement('div');
  container.id = 'nauticsecure-chat-container';
  container.style.position = 'fixed';
  container.style.bottom = '0px';
  container.style.right = '0px';
  container.style.zIndex = '2147483647';
  
  // initial size (just the launcher button area)
  container.style.width = '100px';
  container.style.height = '100px';
  container.style.transition = 'all 0.3s ease';
  container.style.pointerEvents = 'none'; // so we don't block clicks around the button

  const host = new URL(script.src).origin;
  const params = new URLSearchParams();
  if (harborId) params.append('harborId', harborId);
  if (harborName) params.append('harborName', harborName);
  if (boatId) params.append('boatId', boatId);
  if (locationId) params.append('locationId', locationId);
  if (widgetMode) params.append('widgetMode', widgetMode);
  if (tenant) params.append('tenant', tenant);
  if (locale) params.append('locale', locale);
  if (accentColor) params.append('accentColor', accentColor);
  if (themePreset) params.append('themePreset', themePreset);
  params.append('sourceUrl', window.location.href);
  
  const iframeSrc = \`\${host}/\${locale}/widget?\${params.toString()}\`;

  const iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.backgroundColor = 'transparent';
  iframe.style.colorScheme = 'normal';
  iframe.style.pointerEvents = 'auto'; // Re-enable pointer events for the iframe itself
  
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Listen for messages to resize the container
  window.addEventListener('message', (event) => {
    if (event.origin !== host) return;
    
    if (event.data && event.data.type === 'CHAT_WIDGET_STATE') {
      const { isOpen, isMobile } = event.data;
      if (isOpen) {
        if (isMobile) {
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.bottom = '0';
            container.style.right = '0';
        } else {
            container.style.width = '460px';
            container.style.height = '850px';
            container.style.bottom = '0';
            container.style.right = '0';
        }
      } else {
        container.style.width = '100px';
        container.style.height = '100px';
        container.style.bottom = '0';
        container.style.right = '0';
      }
    }
  });

  // Handle responsive resize checks
  window.addEventListener('resize', () => {
     iframe.contentWindow.postMessage({ type: 'HOST_WINDOW_RESIZE', width: window.innerWidth }, host);
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
