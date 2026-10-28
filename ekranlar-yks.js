/*
 * ekranlar-yks.js — Aşama 2 ekranları: Kaynaklar, Denemeler, Yanlış defteri, Hedefler.
 * Ortak yardımcılar uygulama.js içindeki window.YKSArayuz üzerinden gelir.
 */
(function () {
  'use strict';

  var U = window.YKSArayuz;
  var D = window.YKSDepo;
  var A = window.YKSAnaliz;
  var G = window.YKSGrafik;
  var el = U.el, alan = U.alan, islem = U.islem, durum = U.durum;

  var TUR_ETIKETLERI = { yanlis: 'Yanlış', bos: 'Boş' };

  function giris(ozellikler, deger) {
    var e = el('input', ozellikler);
    if (deger !== undefined && deger !== null) { e.value = deger; }
    return e;
  }

  function secimKutusu(secenekler, secili, ozellikler) {
    var s = el('select', ozellikler || {}, secenekler.map(function (o) { return el('option', { value: o[0], metin: o[1] }); }));
    s.value = secili;
    return s;
  }

  function farkMetni(fark) {
    if (fark === null) { return '-'; }
    return (fark > 0 ? '+' : '') + A.netMetni(fark);
  }

  // ======================= KAYNAKLAR =======================

  function kaynakFormu(k) {
    var duzenleme = !!k;
    var v = k || { ad: '', dersId: '', yayin: '', tur: 'Soru Bankası', birim: 'sayfa', toplam: '', yapilan: '', bitisTarihi: '', notlar: '' };
    var ad = giris({ type: 'text', maxlength: '120', placeholder: 'Kaynak adı (örn. 3D TYT Matematik soru bankası)', 'aria-label': 'Kaynak adı', 'data-odak': 'kaynak-ad' }, v.ad);
    var yayin = giris({ type: 'text', maxlength: '60', placeholder: 'Yayınevi (örn. 3D, Bilgi Sarmal, Apotemi)', 'aria-label': 'Yayınevi' }, v.yayin || '');
    var turSecim = secimKutusu(D.KAYNAK_TURLERI.map(function (t) { return [t, t]; }), v.tur || 'Soru Bankası', { 'aria-label': 'Kaynak türü' });
    var ders = U.dersSecenekleri(v.dersId);
    var birim = secimKutusu(D.BIRIMLER.map(function (b) { return [b, b]; }), v.birim, { 'aria-label': 'Birim' });
    var toplam = giris({ type: 'number', min: '1', step: '1', inputmode: 'numeric', 'aria-label': 'Toplam sayı' }, v.toplam);
    var yapilan = giris({ type: 'number', min: '0', step: '1', inputmode: 'numeric', 'aria-label': 'Şimdiye kadar yapılan' }, v.yapilan === 0 ? '0' : v.yapilan);
    var bitis = giris({ type: 'date', 'aria-label': 'Bitirmek istediğin tarih' }, v.bitisTarihi);

    // Katalog hızlı seçim kutusu (Sadece yeni eklerken gösterilir)
    var katalogSecimi = null;
    var katalogUyari = el('span', { sinif: 'form-uyari-metin' });
    if (!duzenleme) {
      katalogSecimi = el('select', { 'aria-label': 'Önerilen kaynak kataloğundan seç' }, [
        el('option', { value: '', metin: '— Önerilen popüler kaynak kataloğundan hızlıca seçin (isteğe bağlı) —' })
      ]);
      (D.KAYNAK_KATALOGU || []).forEach(function (kat, idx) {
        katalogSecimi.appendChild(el('option', { value: String(idx), metin: kat.ad + ' (' + kat.yayin + ' • ' + kat.tur + ' • ' + kat.toplam + ' ' + kat.birim + ')' }));
      });
      katalogSecimi.addEventListener('change', function () {
        if (katalogSecimi.value !== '') {
          var secilenKat = D.KAYNAK_KATALOGU[Number(katalogSecimi.value)];
          if (secilenKat) {
            ad.value = secilenKat.ad;
            yayin.value = secilenKat.yayin || '';
            turSecim.value = secilenKat.tur || 'Soru Bankası';
            ders.value = secilenKat.dersId || '';
            birim.value = secilenKat.birim || 'sayfa';
            toplam.value = String(secilenKat.toplam || 300);
            var varMi = durum.veri.kaynaklar.some(function (kay) { return kay.ad.trim().toLowerCase() === secilenKat.ad.trim().toLowerCase(); });
            katalogUyari.textContent = varMi ? 'Uyarı: Bu kaynak listenizde zaten kayıtlı.' : '';
          }
        }
      });
    }

    var dugmeler = [el('button', { type: 'submit', sinif: 'birincil', metin: duzenleme ? 'Değişiklikleri kaydet' : 'Kaynak ekle' })];
    if (duzenleme) {
      dugmeler.push(el('button', { type: 'button', sinif: 'ikincil', metin: 'Vazgeç', onclick: function () { durum.kaynakDuzenle = null; U.ciz(); } }));
    }

    var formIcerik = [
      el('h2', { sinif: 'form-baslik-h', metin: duzenleme ? 'Kaynağı düzenle' : 'Yeni kaynak ekle' })
    ];
    if (!duzenleme && katalogSecimi) {
      formIcerik.push(el('div', { sinif: 'form-satir katalog-secim-satir' }, [
        alan('Katalogdan Hızlı Ekle', katalogSecimi, 'genis'),
        katalogUyari
      ]));
    }
    formIcerik.push(
      el('div', { sinif: 'form-satir' }, [alan('Kaynak adı', ad, 'genis'), alan('Yayınevi', yayin), alan('Tür', turSecim), alan('Ders', ders)]),
      el('div', { sinif: 'form-satir' }, [alan('Birim', birim, 'dar'), alan('Toplam', toplam, 'dar'), alan('Yapılan', yapilan, 'dar'), alan('Bitirmek istediğin tarih', bitis)]),
      el('div', { sinif: 'form-satir' }, dugmeler)
    );

    return el('form', {
      sinif: 'kayit-formu', 'data-form': 'kaynak',
      onsubmit: function (olay) {
        olay.preventDefault();
        var secenek = { ad: ad.value, dersId: ders.value, yayin: yayin.value, tur: turSecim.value, birim: birim.value, toplam: toplam.value, yapilan: yapilan.value, bitisTarihi: bitis.value, notlar: v.notlar };
        islem(function () {
          if (duzenleme) { D.kaynakGuncelle(durum.veri, k.id, secenek); } else { D.kaynakEkle(durum.veri, secenek); }
          durum.kaynakDuzenle = null;
        }, 'kaynak-ad');
      }
    }, formIcerik);
  }

  function kaynakSatiri(k) {
    var o = A.kaynakOzeti(k, durum.bugun);
    var ders = D.dersBul(durum.veri, k.dersId);

    var bilgi = k.yapilan + ' / ' + k.toplam + ' ' + k.birim + ' (%' + o.yuzde + ')';
    var ek = '';
    if (o.bitti) { ek = 'Tamamlandı.'; }
    else if (o.hedefGecti) { ek = 'Bitiş tarihi (' + D.kisaTarih(k.bitisTarihi, durum.bugun) + ') geçti, ' + o.kalan + ' ' + k.birim + ' kaldı.'; }
    else if (o.gunlukHedef !== null) { ek = 'Bitiş ' + D.kisaTarih(k.bitisTarihi, durum.bugun) + ': günde ' + o.gunlukHedef + ' ' + k.birim + ' yapmalısın (' + o.kalanGun + ' gün kaldı).'; }

    var sayi = giris({
      type: 'number', min: '0', max: String(k.toplam), step: '1', inputmode: 'numeric', 'aria-label': 'Yapılan sayı: ' + k.ad, sinif: 'yapilan-girdi',
      onchange: function () {
        if (!islem(function () { D.kaynakIlerlemeAyarla(durum.veri, k.id, sayi.value); })) { U.ciz(); }
      }
    }, String(k.yapilan));

    var islemler = [
      el('label', { sinif: 'yapilan-etiket' }, [el('span', { sinif: 'alan-baslik', metin: 'Yapılan' }), sayi])
    ];
    if (!o.bitti) {
      islemler.push(el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Bitti', 'aria-label': 'Kaynağı bitti olarak işaretle: ' + k.ad, onclick: function () { islem(function () { D.kaynakIlerlemeAyarla(durum.veri, k.id, k.toplam); }); } }));
    }
    islemler.push(el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Düzenle', 'aria-label': 'Kaynağı düzenle: ' + k.ad, onclick: function () { durum.kaynakDuzenle = k.id; U.ciz(); window.scrollTo(0, 0); } }));
    islemler.push(el('button', {
      type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Kaynağı sil: ' + k.ad,
      onclick: function () { if (window.confirm('"' + k.ad + '" kaynağı silinsin mi?')) { islem(function () { D.kaynakSil(durum.veri, k.id); }); } }
    }));

    var etiketler = [];
    if (k.yayin) { etiketler.push(el('span', { sinif: 'etiket yayin-etiket', metin: k.yayin })); }
    if (k.tur) { etiketler.push(el('span', { sinif: 'etiket', metin: k.tur })); }
    if (ders) { etiketler.push(el('span', { sinif: 'etiket', metin: ders.grup + ' ' + ders.ad })); }

    return el('li', { sinif: 'kaynak' + (o.bitti ? ' tamam' : ''), 'data-kaynak-id': k.id }, [
      el('div', { sinif: 'kaynak-ust' }, [
        el('div', { sinif: 'kaynak-ad-blogu' }, [
          el('span', { sinif: 'kaynak-ad', metin: k.ad })
        ].concat(etiketler)),
        el('div', { sinif: 'kaynak-islemler' }, islemler)
      ]),
      U.ilerlemeCubugu(o.yuzde, o.bitti),
      el('div', { sinif: 'kaynak-bilgi' }, [el('span', { metin: bilgi }), ek ? el('span', { sinif: 'alt-yazi', metin: ek }) : null])
    ]);
  }

  function kaynaklarGorunumu() {
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Kaynaklar', 'Kaynak eklemek tamamen isteğe bağlıdır; kaynak girmeden de tüm çalışma, konu ve planlama özelliklerini eksiksiz kullanabilirsin. İlerlemek istediğin kitap veya soru bankalarını takip etmek istersen aşağıdan ekleyebilir veya popüler katalogdan hızlıca seçebilirsin.'));

    var duzenlenen = null;
    if (durum.kaynakDuzenle) {
      durum.veri.kaynaklar.forEach(function (k) { if (k.id === durum.kaynakDuzenle) { duzenlenen = k; } });
      if (!duzenlenen) { durum.kaynakDuzenle = null; }
    }
    kok.appendChild(kaynakFormu(duzenlenen));

    var sirali = durum.veri.kaynaklar.slice().sort(function (a, b) {
      var ba = a.yapilan === a.toplam, bb = b.yapilan === b.toplam;
      if (ba !== bb) { return ba ? 1 : -1; }
      return a.olusturma < b.olusturma ? -1 : (a.olusturma > b.olusturma ? 1 : 0);
    });
    if (!sirali.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz kaynak eklemedin.' }));
    } else {
      kok.appendChild(el('ul', { sinif: 'kaynak-listesi' }, sirali.map(kaynakSatiri)));
    }
    return kok;
  }

  // ======================= DENEMELER =======================

  function denemeFormu(d) {
    var duzenleme = !!d;
    var tur = duzenleme ? d.tur : durum.denemeTuru;
    var tarih = giris({ type: 'date', 'aria-label': 'Deneme tarihi' }, duzenleme ? d.tarih : durum.bugun);
    var ad = giris({ type: 'text', maxlength: '120', placeholder: 'Deneme adı (örn. Bilgi Sarmal 3)', 'aria-label': 'Deneme adı', 'data-odak': 'deneme-ad' }, duzenleme ? d.ad : '');
    var turSecimi = secimKutusu([['TYT', 'TYT'], ['AYT', 'AYT']], tur, { 'aria-label': 'Sınav türü' });
    if (duzenleme) { turSecimi.setAttribute('disabled', ''); }
    var toplamYazisi = el('p', { sinif: 'deneme-toplam', 'aria-live': 'polite' });
    var gridKap = el('div', { sinif: 'deneme-grid-kap' });
    var girdiler = {};

    function toplamiGuncelle() {
      var net = 0, say = 0;
      Object.keys(girdiler).forEach(function (anahtar) {
        var g = girdiler[anahtar];
        var dgr = g.d.value === '' ? null : Number(g.d.value);
        var ynl = g.y.value === '' ? null : Number(g.y.value);
        if (dgr === null && ynl === null) { g.sonuc.textContent = ''; return; }
        var dd = dgr === null ? 0 : dgr, yy = ynl === null ? 0 : ynl;
        if (!isFinite(dd) || !isFinite(yy) || dd < 0 || yy < 0 || dd + yy > g.ders.soru || Math.round(dd) !== dd || Math.round(yy) !== yy) {
          g.sonuc.textContent = 'Hatalı sayı';
          g.sonuc.className = 'deneme-sonuc hatali';
          return;
        }
        var n = A.netHesapla(dd, yy);
        net += n; say++;
        g.sonuc.className = 'deneme-sonuc';
        g.sonuc.textContent = 'Boş ' + (g.ders.soru - dd - yy) + ', net ' + A.netMetni(n);
      });
      toplamYazisi.textContent = say ? 'Toplam net: ' + A.netMetni(net) + ' (' + say + ' ders girildi)' : 'Doğru ve yanlış sayılarını gir; boş ve net otomatik hesaplanır.';
    }

    function gridYap(sinav, sonuclar) {
      girdiler = {};
      var grid = el('div', { sinif: 'deneme-grid', role: 'group', 'aria-label': sinav + ' ders sonuçları' }, [
        el('span', { sinif: 'grid-baslik', metin: 'Ders' }), el('span', { sinif: 'grid-baslik', metin: 'Doğru' }),
        el('span', { sinif: 'grid-baslik', metin: 'Yanlış' }), el('span', { sinif: 'grid-baslik', metin: 'Sonuç' })
      ]);
      D.DENEME_DERSLERI.filter(function (x) { return x.sinav === sinav; }).forEach(function (ders) {
        var s = sonuclar && sonuclar[ders.anahtar];
        var dg = giris({ type: 'number', min: '0', max: String(ders.soru), step: '1', inputmode: 'numeric', 'aria-label': sinav + ' ' + ders.ad + ' doğru', 'data-anahtar': ders.anahtar, 'data-alan': 'd', oninput: toplamiGuncelle }, s ? String(s.d) : '');
        var yn = giris({ type: 'number', min: '0', max: String(ders.soru), step: '1', inputmode: 'numeric', 'aria-label': sinav + ' ' + ders.ad + ' yanlış', 'data-anahtar': ders.anahtar, 'data-alan': 'y', oninput: toplamiGuncelle }, s ? String(s.y) : '');
        var sonuc = el('span', { sinif: 'deneme-sonuc' });
        girdiler[ders.anahtar] = { ders: ders, d: dg, y: yn, sonuc: sonuc };
        grid.appendChild(el('span', { sinif: 'grid-ders' }, [ders.ad, el('span', { sinif: 'alt-yazi', metin: ' (' + ders.soru + ' soru)' })]));
        grid.appendChild(dg); grid.appendChild(yn); grid.appendChild(sonuc);
      });
      gridKap.textContent = '';
      gridKap.appendChild(grid);
      toplamiGuncelle();
    }

    turSecimi.addEventListener('change', function () {
      durum.denemeTuru = turSecimi.value;
      gridYap(turSecimi.value, null);
    });
    gridYap(tur, d ? d.sonuclar : null);

    var dugmeler = [el('button', { type: 'submit', sinif: 'birincil', metin: duzenleme ? 'Değişiklikleri kaydet' : 'Denemeyi kaydet' })];
    if (duzenleme) {
      dugmeler.push(el('button', { type: 'button', sinif: 'ikincil', metin: 'Vazgeç', onclick: function () { durum.denemeDuzenle = null; U.ciz(); } }));
    }

    return el('form', {
      sinif: 'kayit-formu', 'data-form': 'deneme',
      onsubmit: function (olay) {
        olay.preventDefault();
        var sonuclar = {};
        Object.keys(girdiler).forEach(function (anahtar) { sonuclar[anahtar] = { d: girdiler[anahtar].d.value, y: girdiler[anahtar].y.value }; });
        var secenek = { tur: turSecimi.value, tarih: tarih.value, ad: ad.value, notlar: duzenleme ? d.notlar : '', sonuclar: sonuclar };
        islem(function () {
          if (duzenleme) { D.denemeGuncelle(durum.veri, d.id, secenek); } else { D.denemeEkle(durum.veri, secenek); }
          durum.denemeDuzenle = null;
          durum.denemeTuru = secenek.tur;
        }, 'deneme-ad');
      }
    }, [
      el('h2', { sinif: 'form-baslik-h', metin: duzenleme ? 'Denemeyi düzenle' : 'Yeni deneme sonucu' }),
      el('div', { sinif: 'form-satir' }, [alan('Sınav', turSecimi, 'dar'), alan('Tarih', tarih), alan('Deneme adı', ad, 'genis')]),
      gridKap,
      toplamYazisi,
      el('div', { sinif: 'form-satir' }, dugmeler)
    ]);
  }

  function netGrafigiBolumu(tur) {
    var seri = A.toplamNetSerisi(durum.veri, tur);
    if (!seri.length) { return null; }
    var hedef = A.toplamHedef(durum.veri, tur);
    var maks = tur === 'TYT' ? 120 : 80;
    var noktalar = seri.map(function (s) {
      return { tarih: s.tarih, deger: s.net, ipucu: (s.ad || 'Deneme') + ' (' + D.kisaTarih(s.tarih, durum.bugun) + '): ' + A.netMetni(s.net) + ' net' };
    });
    var son = seri[seri.length - 1];
    var enYuksek = seri.reduce(function (max, cur) { return cur.net > max ? cur.net : max; }, seri[0].net);
    var toplamNet = seri.reduce(function (sum, cur) { return sum + cur.net; }, 0);
    var ortalama = Math.round((toplamNet / seri.length) * 100) / 100;

    var ozetKutulari = el('div', { sinif: 'istatistik-grid' }, [
      el('div', { sinif: 'istatistik-kutu' }, [el('div', { sinif: 'istatistik-sayi', metin: A.netMetni(son.net) }), el('div', { sinif: 'istatistik-etiket', metin: 'Son Net' })]),
      el('div', { sinif: 'istatistik-kutu' }, [el('div', { sinif: 'istatistik-sayi', metin: A.netMetni(ortalama) }), el('div', { sinif: 'istatistik-etiket', metin: 'Ortalama' })]),
      el('div', { sinif: 'istatistik-kutu' }, [el('div', { sinif: 'istatistik-sayi', metin: A.netMetni(enYuksek) }), el('div', { sinif: 'istatistik-etiket', metin: 'Zirve Net' })]),
      hedef !== null ? el('div', { sinif: 'istatistik-kutu' }, [el('div', { sinif: 'istatistik-sayi', metin: A.netMetni(hedef) }), el('div', { sinif: 'istatistik-etiket', metin: 'Hedef' })]) : null
    ]);

    var yazi = 'Toplam ' + seri.length + ' deneme kaydedildi.';
    if (seri.length > 1) { yazi += ' Son denemede netin ' + farkMetni(Math.round((son.net - seri[seri.length - 2].net) * 100) / 100) + ' değişti.'; }

    return el('div', { sinif: 'grafik-bolumu', 'data-grafik': tur }, [
      el('h3', { metin: '📈 ' + tur + ' Net Gelişim Grafiği' }),
      ozetKutulari,
      G.cizgiGrafigi(noktalar, { maks: maks, hedef: hedef, aciklama: tur + ' denemelerinin toplam net grafiği' }),
      el('p', { sinif: 'alt-yazi', metin: yazi })
    ]);
  }

  function dersAnaliziBolumu(tur) {
    var satirlar = A.dersAnalizi(durum.veri, tur, 3).filter(function (r) { return r.denemeSayisi > 0; });
    if (!satirlar.length) { return null; }
    var tablo = el('table', { sinif: 'tablo', 'data-analiz': tur }, [
      el('thead', null, [el('tr', null, ['Ders', 'Son 3 deneme ort. net', 'Hedef', 'Fark', 'Doğru / yanlış (son 3)'].map(function (b) { return el('th', { scope: 'col', metin: b }); }))]),
      el('tbody', null, satirlar.map(function (r) {
        return el('tr', { 'data-ders': r.anahtar }, [
          el('th', { scope: 'row', metin: r.ad }),
          el('td', { metin: A.netMetni(r.ortalama) + ' / ' + r.soru }),
          el('td', { metin: r.hedef === null ? '-' : A.netMetni(r.hedef) }),
          el('td', { sinif: r.fark === null ? '' : (r.fark >= 0 ? 'fark-iyi' : 'fark-kotu'), metin: farkMetni(r.fark) }),
          el('td', { metin: r.dogru + ' / ' + r.yanlis })
        ]);
      }))
    ]);
    var kap = el('div', { sinif: 'analiz-bolumu' }, [el('h3', { metin: tur + ' ders bazında analiz' }), el('div', { sinif: 'tablo-kap' }, [tablo])]);

    var farkli = satirlar.filter(function (r) { return r.fark !== null; });
    if (farkli.length) {
      var enUzak = farkli.slice().sort(function (a, b) { return a.fark - b.fark; })[0];
      kap.appendChild(el('p', { sinif: 'alt-yazi', metin: enUzak.fark < 0 ? 'Hedefe en uzak ders: ' + enUzak.ad + ' (' + farkMetni(enUzak.fark) + ' net).' : 'Denemesi girilen tüm derslerde hedefin üstündesin.' }));
    } else {
      kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Hedef netlerini Hedefler sayfasından girersen hedefle fark da görünür.' }));
    }
    return kap;
  }

  function denemeSatiri(d) {
    var t = A.denemeToplami(d);
    var detay = el('details', { sinif: 'deneme-detay' }, [
      el('summary', { metin: 'Ders ders sonuçlar' }),
      el('ul', { sinif: 'deneme-ders-listesi' }, Object.keys(d.sonuclar).map(function (anahtar) {
        var ders = D.denemeDersiBul(anahtar), s = d.sonuclar[anahtar];
        return el('li', { metin: ders.ad + ': ' + s.d + ' doğru, ' + s.y + ' yanlış, ' + (ders.soru - s.d - s.y) + ' boş, net ' + A.netMetni(A.netHesapla(s.d, s.y)) });
      }))
    ]);
    return el('li', { sinif: 'deneme', 'data-deneme-id': d.id }, [
      el('div', { sinif: 'deneme-ust' }, [
        el('div', { sinif: 'deneme-baslik-blogu' }, [
          el('span', { sinif: 'kaynak-ad', metin: d.ad || 'Deneme' }),
          el('span', { sinif: 'etiket', metin: d.tur }),
          el('span', { sinif: 'etiket', metin: D.kisaTarih(d.tarih, durum.bugun) })
        ]),
        el('div', { sinif: 'kaynak-islemler' }, [
          el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Düzenle', 'aria-label': 'Denemeyi düzenle: ' + (d.ad || d.tarih), onclick: function () { durum.denemeDuzenle = d.id; U.ciz(); window.scrollTo(0, 0); } }),
          el('button', {
            type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Denemeyi sil: ' + (d.ad || d.tarih),
            onclick: function () { if (window.confirm('"' + (d.ad || 'Deneme') + '" (' + d.tarih + ') silinsin mi? Bağlı yanlış/boş kayıtları silinmez.')) { islem(function () { D.denemeSil(durum.veri, d.id); }); } }
          })
        ])
      ]),
      el('p', { sinif: 'deneme-ozet', metin: 'Net ' + A.netMetni(t.net) + ', doğru ' + t.dogru + ', yanlış ' + t.yanlis + ', boş ' + t.bos }),
      detay
    ]);
  }

  function denemelerGorunumu() {
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Denemeler', 'Deneme sonuçlarını ders ders gir. Net = doğru sayısı eksi yanlış sayısının dörtte biri. Deneme girdikçe net grafiği ve ders bazlı analiz oluşur.'));

    var duzenlenen = null;
    if (durum.denemeDuzenle) {
      durum.veri.denemeler.forEach(function (d) { if (d.id === durum.denemeDuzenle) { duzenlenen = d; } });
      if (!duzenlenen) { durum.denemeDuzenle = null; }
    }
    kok.appendChild(denemeFormu(duzenlenen));

    if (!durum.veri.denemeler.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz deneme eklemedin.' }));
      return kok;
    }

    ['TYT', 'AYT'].forEach(function (tur) {
      var grafik = netGrafigiBolumu(tur);
      if (grafik) { kok.appendChild(grafik); }
      var analiz = dersAnaliziBolumu(tur);
      if (analiz) { kok.appendChild(analiz); }
    });

    kok.appendChild(el('h2', { metin: 'Kayıtlı denemeler' }));
    var liste = durum.veri.denemeler.slice().sort(function (a, b) {
      if (a.tarih !== b.tarih) { return a.tarih < b.tarih ? 1 : -1; }
      return a.olusturma < b.olusturma ? 1 : (a.olusturma > b.olusturma ? -1 : 0);
    });
    kok.appendChild(el('ul', { sinif: 'deneme-listesi' }, liste.map(denemeSatiri)));
    return kok;
  }

  // ======================= YANLIŞ DEFTERİ =======================

  function denemeSecenekleri() {
    var liste = durum.veri.denemeler.slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : (a.tarih > b.tarih ? -1 : 0); });
    return [['', 'Deneme seçilmedi']].concat(liste.map(function (d) {
      return [d.id, d.tur + ' ' + (d.ad || 'Deneme') + ' (' + D.kisaTarih(d.tarih, durum.bugun) + ')'];
    }));
  }

  function hataFormu(h) {
    var duzenleme = !!h;
    var ilk = duzenleme ? h : { tarih: durum.sonHata.tarih || durum.bugun, tur: durum.sonHata.tur, dersId: durum.sonHata.dersId, konuId: '', sebep: '', notlar: '', denemeId: durum.sonHata.denemeId };
    if (!D.dersBul(durum.veri, ilk.dersId)) { ilk.dersId = ''; }

    var tarih = giris({ type: 'date', 'aria-label': 'Tarih' }, ilk.tarih);
    var tur = secimKutusu([['yanlis', 'Yanlış'], ['bos', 'Boş']], ilk.tur, { 'aria-label': 'Yanlış mı, boş mu' });
    var ders = U.dersSecenekleri(ilk.dersId, 'Ders seç');
    ders.setAttribute('aria-label', 'Ders');
    ders.setAttribute('data-alan', 'ders');
    var konu = el('select', { 'aria-label': 'Konu', 'data-alan': 'konu', 'data-odak': 'hata-konu' });
    var sebep = secimKutusu([['', 'Sebep seç']].concat(D.SEBEPLER), ilk.sebep, { 'aria-label': 'Yanlış sebebi', 'data-alan': 'sebep' });
    var deneme = secimKutusu(denemeSecenekleri(), ilk.denemeId, { 'aria-label': 'Hangi denemeden', 'data-alan': 'deneme' });
    var not = giris({ type: 'text', maxlength: '500', placeholder: 'Kısa not (isteğe bağlı)', 'aria-label': 'Not' }, ilk.notlar);

    function konulariDoldur(secili) {
      konu.textContent = '';
      konu.appendChild(el('option', { value: '', metin: 'Konu belirtilmedi' }));
      var d = D.dersBul(durum.veri, ders.value);
      if (d) { d.konular.forEach(function (k) { konu.appendChild(el('option', { value: k.id, metin: k.ad })); }); }
      konu.value = secili || '';
      if (konu.value !== (secili || '')) { konu.value = ''; }
    }
    konulariDoldur(ilk.konuId);
    ders.addEventListener('change', function () { konulariDoldur(''); });

    var dugmeler = [el('button', { type: 'submit', sinif: 'birincil', metin: duzenleme ? 'Değişiklikleri kaydet' : 'Kaydı ekle' })];
    if (duzenleme) {
      dugmeler.push(el('button', { type: 'button', sinif: 'ikincil', metin: 'Vazgeç', onclick: function () { durum.hataDuzenle = null; U.ciz(); } }));
    }

    return el('form', {
      sinif: 'kayit-formu', 'data-form': 'hata',
      onsubmit: function (olay) {
        olay.preventDefault();
        var secenek = { tarih: tarih.value, tur: tur.value, dersId: ders.value, konuId: konu.value, sebep: sebep.value, notlar: not.value, denemeId: deneme.value };
        islem(function () {
          if (duzenleme) { D.hataGuncelle(durum.veri, h.id, secenek); } else { D.hataEkle(durum.veri, secenek); }
          durum.hataDuzenle = null;
          // Art arda kayıt girmek kolay olsun diye tarih, tür, ders ve deneme hatırlanır.
          durum.sonHata = { tarih: secenek.tarih, tur: secenek.tur, dersId: secenek.dersId, denemeId: secenek.denemeId };
        }, 'hata-konu');
      }
    }, [
      el('h2', { sinif: 'form-baslik-h', metin: duzenleme ? 'Kaydı düzenle' : 'Yanlış veya boş bıraktığın soru' }),
      el('div', { sinif: 'form-satir' }, [alan('Tarih', tarih), alan('Tür', tur, 'dar'), alan('Ders', ders), alan('Konu', konu, 'genis')]),
      el('div', { sinif: 'form-satir' }, [alan('Sebep', sebep), alan('Hangi denemeden', deneme), alan('Not', not, 'genis')]),
      el('div', { sinif: 'form-satir' }, dugmeler)
    ]);
  }

  function hataSatiri(h) {
    var deneme = null;
    durum.veri.denemeler.forEach(function (d) { if (d.id === h.denemeId) { deneme = d; } });
    var yer = (h.dersAdi || 'Ders silinmiş') + (h.konuAdi ? ', ' + h.konuAdi : ', konu belirtilmedi');
    return el('li', { sinif: 'hata-kaydi', 'data-hata-id': h.id }, [
      el('div', { sinif: 'deneme-ust' }, [
        el('div', { sinif: 'deneme-baslik-blogu' }, [
          el('span', { sinif: 'etiket ' + (h.tur === 'bos' ? '' : 'gecikti'), metin: TUR_ETIKETLERI[h.tur] }),
          el('span', { sinif: 'kaynak-ad', metin: yer }),
          el('span', { sinif: 'etiket', metin: A.sebepAdi(h.sebep) })
        ]),
        el('div', { sinif: 'kaynak-islemler' }, [
          el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Düzenle', 'aria-label': 'Kaydı düzenle: ' + yer, onclick: function () { durum.hataDuzenle = h.id; U.ciz(); window.scrollTo(0, 0); } }),
          el('button', {
            type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Kaydı sil: ' + yer,
            onclick: function () { if (window.confirm('Bu kayıt silinsin mi?\n' + yer + ' (' + TUR_ETIKETLERI[h.tur] + ')')) { islem(function () { D.hataSil(durum.veri, h.id); }); } }
          })
        ])
      ]),
      el('p', { sinif: 'alt-yazi hata-detay', metin: D.kisaTarih(h.tarih, durum.bugun) + (deneme ? ', ' + deneme.tur + ' ' + (deneme.ad || 'Deneme') : '') + (h.notlar ? '. ' + h.notlar : '') })
    ]);
  }

  function cubukSatiri(ad, sayi, enCok) {
    return el('li', { sinif: 'cubuk-satir' }, [
      el('span', { sinif: 'cubuk-ad', metin: ad }),
      el('span', { sinif: 'cubuk-iz' }, [el('span', { sinif: 'cubuk-dolgu', style: 'width:' + Math.round((sayi / enCok) * 100) + '%' })]),
      el('span', { sinif: 'cubuk-sayi', metin: String(sayi) })
    ]);
  }

  function hataIstatistikBolumu(ist) {
    var kap = el('div', { sinif: 'istatistik-bolumu' });
    kap.appendChild(el('p', { sinif: 'hata-ozet', metin: ist.toplam + ' kayıt (' + ist.yanlis + ' yanlış, ' + ist.bos + ' boş)' }));
    if (!ist.toplam) { return kap; }
    var ikili = el('div', { sinif: 'ikili-bolum' });
    var enCokSebep = ist.sebepler[0].sayi;
    ikili.appendChild(el('div', { 'data-istatistik': 'sebep' }, [
      el('h3', { metin: 'Sebeplere göre' }),
      el('ul', { sinif: 'cubuk-listesi' }, ist.sebepler.map(function (s) { return cubukSatiri(s.ad, s.sayi, enCokSebep); }))
    ]));
    if (ist.konular.length) {
      var enCokKonu = ist.konular[0].sayi;
      ikili.appendChild(el('div', { 'data-istatistik': 'konu' }, [
        el('h3', { metin: 'En çok hata yapılan konular' }),
        el('ul', { sinif: 'cubuk-listesi' }, ist.konular.slice(0, 8).map(function (k) { return cubukSatiri(k.konuAdi + ' (' + k.dersAdi + ')', k.sayi, enCokKonu); }))
      ]));
    }
    kap.appendChild(ikili);
    if (ist.konusuz) { kap.appendChild(el('p', { sinif: 'alt-yazi', metin: ist.konusuz + ' kayıtta konu belirtilmemiş; konu seçersen konu analizi daha doğru olur.' })); }
    return kap;
  }

  function yanlisPlaniBolumu() {
    var kap = el('div', { sinif: 'yanlis-plani-bolumu' });
    var ayarlar = durum.veri.yanlisPlaniAyarlari || { denemeEsigi: 3, otomatikOner: true };
    var denemeSayisi = (durum.veri.denemeler || []).length;

    var esikGirdi = giris({
      type: 'number', min: '1', max: '20', step: '1', inputmode: 'numeric',
      'aria-label': 'Deneme eşiği', sinif: 'esik-girdi'
    }, String(ayarlar.denemeEsigi || 3));

    var ayarFormu = el('form', {
      sinif: 'yanlis-ayar-satiri',
      onsubmit: function (e) {
        e.preventDefault();
        islem(function () {
          D.yanlisPlaniAyarlariKaydet(durum.veri, { denemeEsigi: esikGirdi.value });
        });
        U.uyariGoster('Yanlış defteri tekrar eşiği kaydedildi: Her ' + esikGirdi.value + ' denemede bir analiz tetiklenecek.', 'bilgi', 'hatalar');
      }
    }, [
      el('span', { metin: 'Tekrar tetikleme eşiği:' }),
      alan('Her kaç denemede bir', esikGirdi, 'dar'),
      el('button', { type: 'submit', sinif: 'ikincil', metin: 'Eşiği kaydet' }),
      el('span', { sinif: 'alt-yazi', metin: '(Şu anki deneme sayısı: ' + denemeSayisi + ')' })
    ]);

    var taraDugme = el('button', {
      type: 'button', sinif: 'birincil', metin: 'Yanlış Defterini Tara ve Tekrar Planı Öner',
      onclick: function () {
        var sonuc = A.yanlisTekrarOnerileri(durum.veri, durum.bugun);
        if (sonuc.uyarilar && sonuc.uyarilar.length) {
          U.uyariGoster(sonuc.uyarilar.join(' '), 'uyari', 'hatalar');
        }
        if (!sonuc.oneriler.length) {
          U.uyariGoster('Şu an için tekrar gerektiren kronik bir konu veya yeni öneri bulunamadı. (Deneme sayısı: ' + sonuc.denemeSayisi + ', eşik: ' + sonuc.denemeEsigi + ')', 'bilgi', 'hatalar');
          return;
        }
        var yeniEklenen = 0;
        islem(function () {
          sonuc.oneriler.forEach(function (oneri) {
            D.yanlisGorevEkle(durum.veri, oneri);
            yeniEklenen++;
          });
        });
        U.uyariGoster(yeniEklenen + ' yeni tekrar görevi önerildi! Aşağıdan inceleyip onaylayabilir veya reddedebilirsiniz.', 'bilgi', 'hatalar');
      }
    });

    kap.appendChild(el('div', { sinif: 'yanlis-plani-ust' }, [
      el('h2', { metin: 'Otomatik Tekrar ve Çalışma Planı' }),
      el('p', { sinif: 'alt-yazi', metin: 'Tekrarlanan yanlışlar ve boş sorular deneme eşiğine göre taranır; gereksiz yinelenen görevler oluşturulmadan onayına sunulur. Onaylanan görevler günlük ve haftalık programına dahil edilir.' }),
      ayarFormu,
      el('div', { sinif: 'form-satir' }, [taraDugme])
    ]));

    // Mevcut Görevler
    var gorevler = durum.veri.yanlisGorevleri || [];
    if (gorevler.length) {
      kap.appendChild(el('h3', { metin: 'Önerilen ve Onaylanan Tekrar Görevleri (' + gorevler.length + ')' }));
      var gorevListesi = el('ul', { sinif: 'yanlis-gorev-listesi' });
      gorevler.forEach(function (g) {
        var durumMetin = D.YANLIS_GOREV_DURUMLARI[g.durum] || g.durum;
        var durumSinif = 'durum-' + g.durum;

        var islemler = [];
        if (g.durum === 'onerildi') {
          islemler.push(el('button', {
            type: 'button', sinif: 'birincil', metin: 'Onayla ve Göreve Ekle',
            onclick: function () {
              islem(function () {
                D.yanlisGorevDurumGuncelle(durum.veri, g.id, 'onaylandi');
                D.gorevEkle(durum.veri, {
                  baslik: 'Yanlış Tekrarı: ' + g.konuAdi + ' (' + g.soruHedefi + ' soru / ' + g.sureDk + ' dk)',
                  tarih: durum.bugun,
                  sureDk: g.sureDk,
                  dersId: g.dersId,
                  notlar: g.sebepOzeti + ' — Yanlış defteri otomatik tekrarı'
                });
              });
              U.uyariGoster('Görev onaylandı ve bugünkü görevlerine eklendi!', 'bilgi', 'hatalar');
            }
          }));
          islemler.push(el('button', {
            type: 'button', sinif: 'ikincil', metin: 'Reddet',
            onclick: function () {
              islem(function () { D.yanlisGorevDurumGuncelle(durum.veri, g.id, 'reddedildi'); });
            }
          }));
        } else if (g.durum === 'onaylandi') {
          islemler.push(el('button', {
            type: 'button', sinif: 'ikincil yesil-dugme', metin: 'Çalışıldı',
            onclick: function () {
              islem(function () { D.yanlisGorevDurumGuncelle(durum.veri, g.id, 'calisildi'); });
              U.uyariGoster('Görev "Çalışıldı" olarak işaretlendi. Gelecekteki tekrar analizlerinde dikkate alınacak.', 'bilgi', 'hatalar');
            }
          }));
        }

        islemler.push(el('button', {
          type: 'button', sinif: 'metin-dugme sil', metin: 'Sil',
          onclick: function () {
            if (window.confirm('Bu tekrar görevi silinsin mi?')) {
              islem(function () { D.yanlisGorevSil(durum.veri, g.id); });
            }
          }
        }));

        gorevListesi.appendChild(el('li', { sinif: 'blok yanlis-gorev-oge ' + durumSinif }, [
          el('div', { sinif: 'blok-bilgi' }, [
            el('div', { sinif: 'yanlis-gorev-baslik-satir' }, [
              el('span', { sinif: 'kaynak-ad', metin: g.konuAdi + ' (' + g.dersAdi + ')' }),
              el('span', { sinif: 'etiket yanlis-durum-etiket ' + durumSinif, metin: durumMetin }),
              el('span', { sinif: 'etiket bugun', metin: g.soruHedefi + ' soru / ' + g.sureDk + ' dk' })
            ]),
            el('span', { sinif: 'alt-yazi', metin: g.sebepOzeti + (g.tarih ? ' • ' + D.kisaTarih(g.tarih, durum.bugun) : '') })
          ]),
          el('div', { sinif: 'kaynak-islemler' }, islemler)
        ]));
      });
      kap.appendChild(gorevListesi);
    }
    return kap;
  }

  function hatalarGorunumu() {
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Yanlış defteri', 'Yanlış yaptığın veya boş bıraktığın soruların konusunu ve sebebini kaydet. Hangi konularda ve hangi sebeplerle hata yaptığını burada görürsün; konu başına hata sayısı Dersler ve konular sayfasında da görünür.'));

    kok.appendChild(yanlisPlaniBolumu());

    var duzenlenen = null;
    if (durum.hataDuzenle) {
      durum.veri.hatalar.forEach(function (h) { if (h.id === durum.hataDuzenle) { duzenlenen = h; } });
      if (!duzenlenen) { durum.hataDuzenle = null; }
    }
    kok.appendChild(hataFormu(duzenlenen));

    if (!durum.veri.hatalar.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz kayıt eklemedin.' }));
      return kok;
    }

    var f = durum.hataFiltre;
    var turSuzgec = secimKutusu([['', 'Yanlış ve boş'], ['yanlis', 'Yalnızca yanlış'], ['bos', 'Yalnızca boş']], f.tur, {
      'aria-label': 'Türe göre süz', onchange: function () { f.tur = turSuzgec.value; U.ciz(); }
    });
    var dersSuzgec = U.dersSecenekleri(f.dersId, 'Tüm dersler');
    dersSuzgec.setAttribute('aria-label', 'Derse göre süz');
    dersSuzgec.addEventListener('change', function () { f.dersId = dersSuzgec.value; U.ciz(); });
    var sebepSuzgec = secimKutusu([['', 'Tüm sebepler']].concat(D.SEBEPLER), f.sebep, {
      'aria-label': 'Sebebe göre süz', onchange: function () { f.sebep = sebepSuzgec.value; U.ciz(); }
    });
    kok.appendChild(el('h2', { metin: 'Analiz ve kayıtlar' }));
    kok.appendChild(el('div', { sinif: 'suzgec-satiri' }, [turSuzgec, dersSuzgec, sebepSuzgec]));

    kok.appendChild(hataIstatistikBolumu(A.hataIstatistikleri(durum.veri, f)));

    var liste = A.hatalariSuz(durum.veri, f);
    if (!liste.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Bu süzgece uyan kayıt yok.' }));
    } else {
      kok.appendChild(el('ul', { sinif: 'hata-listesi' }, liste.slice(0, 100).map(hataSatiri)));
      if (liste.length > 100) { kok.appendChild(el('p', { sinif: 'alt-yazi', metin: 'En yeni 100 kayıt gösteriliyor. Süzgeçleri kullanarak daralt.' })); }
    }
    return kok;
  }

  // ======================= HEDEFLER =======================

  function hedeflerGorunumu() {
    var h = durum.veri.hedefler;
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Hedefler', 'Hedef bölümünü, üniversiteni ve ders ders hedef netlerini yaz. Mevcut seviyeni de gir; "son denemelerden doldur" düğmesi bunu denemelerinden hesaplar. YKS tarihini girersen Bugün ekranında kalan gün görünür.'));

    var bolum = giris({ type: 'text', maxlength: '120', placeholder: 'örn. Bilgisayar Mühendisliği', 'aria-label': 'Hedef bölüm' }, h.bolum);
    var uni = giris({ type: 'text', maxlength: '120', placeholder: 'örn. ODTÜ', 'aria-label': 'Hedef üniversite' }, h.universite);
    var sira = giris({ type: 'text', maxlength: '20', inputmode: 'numeric', placeholder: 'örn. 5000', 'aria-label': 'Hedef sıralama' }, h.hedefSiralama);
    var tarih = giris({ type: 'date', 'aria-label': 'YKS tarihi' }, h.sinavTarihi);
    var seviyeNotu = el('textarea', { rows: '3', maxlength: '1000', 'aria-label': 'Mevcut seviye notu', placeholder: 'Mevcut seviyen hakkında kısa not (güçlü ve zayıf yönlerin...)' });
    seviyeNotu.value = h.seviyeNotu;

    var hedefGirdileri = {}, mevcutGirdileri = {}, toplamHucreleri = {};

    function toplamlariGuncelle() {
      ['TYT', 'AYT'].forEach(function (sinav) {
        var ht = 0, mt = 0, hVar = false, mVar = false;
        D.DENEME_DERSLERI.forEach(function (d) {
          if (d.sinav !== sinav) { return; }
          var hv = hedefGirdileri[d.anahtar].value, mv = mevcutGirdileri[d.anahtar].value;
          if (hv !== '' && isFinite(Number(hv))) { ht += Number(hv); hVar = true; }
          if (mv !== '' && isFinite(Number(mv))) { mt += Number(mv); mVar = true; }
        });
        toplamHucreleri[sinav].hedef.textContent = hVar ? A.netMetni(ht) : '-';
        toplamHucreleri[sinav].mevcut.textContent = mVar ? A.netMetni(mt) : '-';
        toplamHucreleri[sinav].fark.textContent = (hVar && mVar) ? farkMetni(Math.round((mt - ht) * 100) / 100) : '-';
      });
    }

    function netTablosu(sinav) {
      var analiz = {};
      A.dersAnalizi(durum.veri, sinav, 3).forEach(function (r) { analiz[r.anahtar] = r; });
      var govde = el('tbody');
      D.DENEME_DERSLERI.filter(function (d) { return d.sinav === sinav; }).forEach(function (d) {
        var hg = giris({ type: 'number', min: '0', max: String(d.soru), step: 'any', inputmode: 'decimal', 'aria-label': sinav + ' ' + d.ad + ' hedef net', 'data-anahtar': d.anahtar, 'data-alan': 'hedef', oninput: toplamlariGuncelle }, (d.anahtar in h.hedefNetler) ? String(h.hedefNetler[d.anahtar]) : '');
        var mg = giris({ type: 'number', min: '0', max: String(d.soru), step: 'any', inputmode: 'decimal', 'aria-label': sinav + ' ' + d.ad + ' mevcut net', 'data-anahtar': d.anahtar, 'data-alan': 'mevcut', oninput: toplamlariGuncelle }, (d.anahtar in h.mevcutNetler) ? String(h.mevcutNetler[d.anahtar]) : '');
        hedefGirdileri[d.anahtar] = hg; mevcutGirdileri[d.anahtar] = mg;
        var son = analiz[d.anahtar];
        govde.appendChild(el('tr', null, [
          el('th', { scope: 'row' }, [d.ad, el('span', { sinif: 'alt-yazi', metin: ' (' + d.soru + ')' })]),
          el('td', null, [hg]), el('td', null, [mg]),
          el('td', { metin: son && son.ortalama !== null ? A.netMetni(son.ortalama) : '-' })
        ]));
      });
      var hHucre = el('td', { sinif: 'toplam-hucre' }), mHucre = el('td', { sinif: 'toplam-hucre' }), fHucre = el('span', { sinif: 'toplam-hucre', 'data-toplam-fark': sinav });
      hHucre.setAttribute('data-toplam-hedef', sinav); mHucre.setAttribute('data-toplam-mevcut', sinav);
      toplamHucreleri[sinav] = { hedef: hHucre, mevcut: mHucre, fark: fHucre };
      govde.appendChild(el('tr', { sinif: 'toplam-satir' }, [el('th', { scope: 'row', metin: 'Toplam' }), hHucre, mHucre, el('td', null, [el('span', { sinif: 'alt-yazi', metin: 'Fark: ' }), fHucre])]));
      return el('div', { sinif: 'tablo-kap' }, [el('table', { sinif: 'tablo net-tablosu', 'data-tablo': sinav }, [
        el('thead', null, [el('tr', null, ['Ders (soru)', 'Hedef net', 'Mevcut net', 'Son 3 deneme ort.'].map(function (b) { return el('th', { scope: 'col', metin: b }); }))]),
        govde
      ])]);
    }

    var tytTablo = netTablosu('TYT');
    var aytTablo = netTablosu('AYT');
    toplamlariGuncelle();

    var doldur = el('button', {
      type: 'button', sinif: 'ikincil', id: 'denemelerden-doldur', metin: 'Mevcut seviyeyi son denemelerden doldur',
      onclick: function () {
        var m = A.sonDenemelerdenMevcut(durum.veri, 3);
        var anahtarlar = Object.keys(m);
        if (!anahtarlar.length) { U.uyariGoster('Henüz deneme girmediğin için doldurulacak bir şey yok.', 'uyari', 'hedef'); return; }
        anahtarlar.forEach(function (a) { mevcutGirdileri[a].value = String(m[a]); });
        toplamlariGuncelle();
        U.uyariGoster('Mevcut net alanları son 3 denemenin ortalamasıyla dolduruldu. Kalıcı olması için "Hedefleri kaydet" düğmesine bas.', 'bilgi', 'hedef');
      }
    });

    kok.appendChild(el('form', {
      sinif: 'kayit-formu hedef-formu', 'data-form': 'hedef',
      onsubmit: function (olay) {
        olay.preventDefault();
        var hedefNetler = {}, mevcutNetler = {};
        Object.keys(hedefGirdileri).forEach(function (a) { hedefNetler[a] = hedefGirdileri[a].value; mevcutNetler[a] = mevcutGirdileri[a].value; });
        var tamam = islem(function () {
          D.hedefleriKaydet(durum.veri, { bolum: bolum.value, universite: uni.value, hedefSiralama: sira.value, sinavTarihi: tarih.value, hedefNetler: hedefNetler, mevcutNetler: mevcutNetler, seviyeNotu: seviyeNotu.value });
        });
        if (tamam) { U.uyariGoster('Hedefler kaydedildi.', 'bilgi', 'hedef'); }
      }
    }, [
      el('h2', { sinif: 'form-baslik-h', metin: 'Genel hedef' }),
      el('div', { sinif: 'form-satir' }, [alan('Hedef bölüm', bolum, 'genis'), alan('Hedef üniversite', uni, 'genis')]),
      el('div', { sinif: 'form-satir' }, [alan('Hedef sıralama', sira), alan('YKS tarihi', tarih)]),
      el('h2', { metin: 'Hedef ve mevcut netler' }),
      el('div', { sinif: 'form-satir' }, [doldur]),
      el('h3', { metin: 'TYT (120 soru)' }), tytTablo,
      el('h3', { metin: 'AYT sayısal (80 soru)' }), aytTablo,
      alan('Mevcut seviye notu', seviyeNotu, 'genis'),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: 'Hedefleri kaydet' })])
    ]));

    return kok;
  }

  U.gorunumler.kaynaklar = kaynaklarGorunumu;
  U.gorunumler.denemeler = denemelerGorunumu;
  U.gorunumler.hatalar = hatalarGorunumu;
  U.gorunumler.hedefler = hedeflerGorunumu;
})();
