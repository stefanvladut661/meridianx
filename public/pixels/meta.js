/* Codul de bază Meta Pixel, într-un fișier separat și nu inline în layout:
   un <Script> inline din App Router apare de două ori în sursa paginii (tag-ul
   care rulează + payload-ul RSC), iar Meta Pixel Helper raportează asta ca
   „pixel inițializat de mai multe ori". Aici există o singură dată.

   Poarta de consimțământ vine ÎNAINTEA codului Meta: dacă cookie-ul
   `meridian_consent` (lib/consent.ts) nu spune „marketing: da", fișierul
   nu face nimic — nici fbevents.js, nici `fbq`. Așa scrie în politica de
   cookie-uri: scripturile nu se încarcă deloc până nu accepți. Cine
   acceptă abia din banner primește pixelul de la <MetaPixel />, fără
   reîncărcare; cine a acceptat la o vizită anterioară îl are de aici,
   din prima milisecundă. */
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

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('set', 'autoConfig', false, '3075133136161307');
  fbq('init', '3075133136161307');
  fbq('track', 'PageView');
})();
