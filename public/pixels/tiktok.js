/* Codul de bază TikTok Pixel, extern din același motiv ca meta.js: inline,
   `ttq.load` apărea de două ori în sursa paginii. Aceeași poartă de
   consimțământ ca în meta.js: fără „marketing: da" în `meridian_consent`,
   nu pornește nimic; după accept, pixelul îl pune <TikTokPixel />. */
(function () {
  var granted = false;
  try {
    var m = document.cookie.match(/(?:^|; )meridian_consent=([^;]*)/);
    var c = m ? JSON.parse(decodeURIComponent(m[1])) : null;
    granted = !!(c && c.v === 1 && c.marketing === true);
  } catch {
    granted = false;
  }
  if (!granted) return;

  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
    var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
    ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

    ttq.load('DAN9FTJC77U07P78RH10');
    ttq.page();
  }(window, document, 'ttq');
})();
