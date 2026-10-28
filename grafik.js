/*
 * grafik.js — Dışarıdan kütüphane kullanmadan çizilen basit SVG grafikleri.
 */
(function (kok) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function s(ad, ozellikler, cocuklar) {
    var e = document.createElementNS(NS, ad);
    Object.keys(ozellikler || {}).forEach(function (k) { e.setAttribute(k, ozellikler[k]); });
    (cocuklar || []).forEach(function (c) {
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function netMetni(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

  function kisaEtiket(tarih) {
    var p = tarih.split('-');
    return p[2] + '.' + p[1];
  }

  /*
   * noktalar: [{ tarih: 'YYYY-AA-GG', deger: sayı, ipucu: 'metin' }, ...] (eskiden yeniye)
   * secenek:  { maks: sayı (ör. 120), hedef: sayı|null, aciklama: 'ekran okuyucu metni' }
   */
  function cizgiGrafigi(noktalar, secenek) {
    var W = 640, H = 240, solBosluk = 42, sagBosluk = 18, ustBosluk = 16, altBosluk = 34;
    var maks = secenek.maks;
    var enKucuk = 0;
    noktalar.forEach(function (n) { if (n.deger < enKucuk) { enKucuk = Math.floor(n.deger / 5) * 5; } });
    var aralik = maks - enKucuk;
    var cizimW = W - solBosluk - sagBosluk, cizimH = H - ustBosluk - altBosluk;

    function yPos(d) { return ustBosluk + cizimH - ((d - enKucuk) / aralik) * cizimH; }
    function xPos(i) {
      if (noktalar.length === 1) { return solBosluk + cizimW / 2; }
      return solBosluk + (i / (noktalar.length - 1)) * cizimW;
    }

    var svg = s('svg', {
      viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': secenek.aciklama || 'Çizgi grafiği', class: 'grafik'
    });

    // Yatay çizgiler ve değer etiketleri
    for (var i = 0; i <= 4; i++) {
      var deger = enKucuk + (aralik * i) / 4;
      var y = yPos(deger);
      svg.appendChild(s('line', { x1: solBosluk, x2: W - sagBosluk, y1: y, y2: y, class: 'grafik-izgara' }));
      svg.appendChild(s('text', { x: solBosluk - 6, y: y + 4, 'text-anchor': 'end', class: 'grafik-yazi' }, [netMetni(deger)]));
    }

    // Hedef çizgisi
    if (secenek.hedef !== null && secenek.hedef !== undefined && secenek.hedef <= maks && secenek.hedef >= enKucuk) {
      var hy = yPos(secenek.hedef);
      svg.appendChild(s('line', { x1: solBosluk, x2: W - sagBosluk, y1: hy, y2: hy, class: 'grafik-hedef' }));
      svg.appendChild(s('text', { x: W - sagBosluk, y: hy - 5, 'text-anchor': 'end', class: 'grafik-hedef-yazi' }, ['Hedef ' + netMetni(secenek.hedef)]));
    }

    // Çizgi
    if (noktalar.length > 1) {
      var yol = noktalar.map(function (n, k) { return (k === 0 ? 'M' : 'L') + xPos(k).toFixed(1) + ' ' + yPos(n.deger).toFixed(1); }).join(' ');
      svg.appendChild(s('path', { d: yol, class: 'grafik-cizgi' }));
    }

    // Noktalar ve x etiketleri
    var etiketAdimi = Math.max(1, Math.ceil(noktalar.length / 7));
    noktalar.forEach(function (n, k) {
      var x = xPos(k), yy = yPos(n.deger);
      svg.appendChild(s('circle', { cx: x, cy: yy, r: 4, class: 'grafik-nokta' }, [s('title', {}, [n.ipucu || (kisaEtiket(n.tarih) + ': ' + netMetni(n.deger))])]));
      if (k % etiketAdimi === 0 || k === noktalar.length - 1) {
        svg.appendChild(s('text', { x: x, y: H - altBosluk + 18, 'text-anchor': 'middle', class: 'grafik-yazi' }, [kisaEtiket(n.tarih)]));
      }
    });

    return svg;
  }

  /*
   * noktalar: [{ etiket: 'Pzt', deger: sayı, ipucu: 'metin' }, ...]
   * secenek:  { maks: sayı|null (otomatik), hedef: sayı|null, birim: 'dk', aciklama: '...' }
   */
  function cubukGrafigi(noktalar, secenek) {
    var W = 640, H = 220, sol = 42, sag = 18, ust = 16, alt = 30;
    var enBuyuk = Math.max.apply(null, noktalar.map(function (n) { return n.deger; }).concat([secenek.hedef || 0, 1]));
    var maks = secenek.maks || Math.ceil(enBuyuk / 30) * 30;
    var cizimW = W - sol - sag, cizimH = H - ust - alt;
    function y(d) { return ust + cizimH - (d / maks) * cizimH; }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': secenek.aciklama || 'Çubuk grafiği', class: 'grafik' });
    for (var i = 0; i <= 4; i++) {
      var d = (maks * i) / 4;
      svg.appendChild(s('line', { x1: sol, x2: W - sag, y1: y(d), y2: y(d), class: 'grafik-izgara' }));
      svg.appendChild(s('text', { x: sol - 6, y: y(d) + 4, 'text-anchor': 'end', class: 'grafik-yazi' }, [String(Math.round(d))]));
    }
    var adim = cizimW / noktalar.length, genislik = Math.min(46, adim * 0.62);
    noktalar.forEach(function (n, k) {
      var x = sol + adim * k + (adim - genislik) / 2;
      var yy = y(n.deger);
      svg.appendChild(s('rect', { x: x, y: yy, width: genislik, height: Math.max(0, ust + cizimH - yy), rx: 3, class: 'grafik-cubuk' }, [s('title', {}, [n.ipucu || (n.etiket + ': ' + n.deger)])]));
      svg.appendChild(s('text', { x: x + genislik / 2, y: H - alt + 18, 'text-anchor': 'middle', class: 'grafik-yazi' }, [n.etiket]));
    });
    if (secenek.hedef) {
      var hy = y(secenek.hedef);
      svg.appendChild(s('line', { x1: sol, x2: W - sag, y1: hy, y2: hy, class: 'grafik-hedef' }));
      svg.appendChild(s('text', { x: W - sag, y: hy - 5, 'text-anchor': 'end', class: 'grafik-hedef-yazi' }, ['Hedef ' + secenek.hedef + ' ' + (secenek.birim || '')]));
    }
    return svg;
  }

  kok.YKSGrafik = { cizgiGrafigi: cizgiGrafigi, cubukGrafigi: cubukGrafigi };
})(window);
