/*
 * analiz.js — Hesaplamalar (net, deneme analizi, hata istatistikleri, tekrar listesi...).
 * Yalnızca okur; veriyi değiştirmez. Ekranla ilgisi yoktur, ayrıca test edilebilir.
 */
(function (kok) {
  'use strict';

  var D = kok.YKSDepo || require('./depo.js');

  function yuvarla2(n) { return Math.round(n * 100) / 100; }

  // YKS neti: doğru sayısı eksi yanlış sayısının dörtte biri.
  function netHesapla(dogru, yanlis) { return yuvarla2(dogru - yanlis / 4); }

  function netMetni(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '-'; }
    return String(yuvarla2(n)).replace('.', ',');
  }

  function sureMetni(dk) {
    if (!dk) { return ''; }
    var s = Math.floor(dk / 60), d = dk % 60;
    if (s === 0) { return d + ' dk'; }
    if (d === 0) { return s + ' sa'; }
    return s + ' sa ' + d + ' dk';
  }

  // ---------- Saat ve çakışma ----------

  function dakikayaCevir(saat) {
    var p = saat.split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function saateCevir(dakika) {
    var d = ((dakika % 1440) + 1440) % 1440;
    var s = Math.floor(d / 60), m = d % 60;
    return (s < 10 ? '0' : '') + s + ':' + (m < 10 ? '0' : '') + m;
  }

  // "14:30", "45 dk" veya "14:30-15:15 (45 dk)" gibi kısa metin
  function zamanMetni(g) {
    if (g.saat && g.sureDk) {
      return g.saat + '-' + saateCevir(dakikayaCevir(g.saat) + g.sureDk) + ' (' + sureMetni(g.sureDk) + ')';
    }
    if (g.saat) { return g.saat; }
    if (g.sureDk) { return sureMetni(g.sureDk); }
    return '';
  }

  // Aynı gün, tamamlanmamış ve saat+süre belirtilmiş başka bir görevle çakışıyor mu?
  function cakisiyorMu(veri, g) {
    if (g.tamamlandi || !g.tarih || !g.saat || !g.sureDk) { return false; }
    var bas = dakikayaCevir(g.saat), bit = bas + g.sureDk;
    return veri.gorevler.some(function (o) {
      if (o.id === g.id || o.tamamlandi || o.tarih !== g.tarih || !o.saat || !o.sureDk) { return false; }
      var b2 = dakikayaCevir(o.saat), e2 = b2 + o.sureDk;
      return bas < e2 && b2 < bit;
    });
  }

  // ---------- Denemeler ----------

  function denemeToplami(deneme) {
    var t = { net: 0, dogru: 0, yanlis: 0, bos: 0, soru: 0 };
    Object.keys(deneme.sonuclar).forEach(function (anahtar) {
      var ders = D.denemeDersiBul(anahtar);
      var s = deneme.sonuclar[anahtar];
      if (!ders) { return; }
      t.net += netHesapla(s.d, s.y);
      t.dogru += s.d;
      t.yanlis += s.y;
      t.bos += ders.soru - s.d - s.y;
      t.soru += ders.soru;
    });
    t.net = yuvarla2(t.net);
    return t;
  }

  function siraliDenemeler(veri, tur) {
    return veri.denemeler.filter(function (d) { return d.tur === tur; }).sort(function (a, b) {
      if (a.tarih !== b.tarih) { return a.tarih < b.tarih ? -1 : 1; }
      return a.olusturma < b.olusturma ? -1 : (a.olusturma > b.olusturma ? 1 : 0);
    });
  }

  function dersSerisi(veri, anahtar) {
    var ders = D.denemeDersiBul(anahtar);
    if (!ders) { return []; }
    var seri = [];
    siraliDenemeler(veri, ders.sinav).forEach(function (d) {
      var s = d.sonuclar[anahtar];
      if (s) { seri.push({ tarih: d.tarih, ad: d.ad, net: netHesapla(s.d, s.y), dogru: s.d, yanlis: s.y }); }
    });
    return seri;
  }

  function topla(sayilar) {
    return sayilar.reduce(function (a, b) { return a + b; }, 0);
  }

  // Her ders için son n denemenin ortalama neti, hedefle farkı ve doğru/yanlış toplamı.
  function dersAnalizi(veri, sinav, n) {
    n = n || 3;
    return D.DENEME_DERSLERI.filter(function (d) { return d.sinav === sinav; }).map(function (d) {
      var seri = dersSerisi(veri, d.anahtar);
      var son = seri.slice(-n);
      var ort = son.length ? yuvarla2(topla(son.map(function (x) { return x.net; })) / son.length) : null;
      var hedef = (d.anahtar in veri.hedefler.hedefNetler) ? veri.hedefler.hedefNetler[d.anahtar] : null;
      return {
        anahtar: d.anahtar,
        ad: d.ad,
        soru: d.soru,
        denemeSayisi: seri.length,
        ortalama: ort,
        hedef: hedef,
        fark: (ort !== null && hedef !== null) ? yuvarla2(ort - hedef) : null,
        dogru: topla(son.map(function (x) { return x.dogru; })),
        yanlis: topla(son.map(function (x) { return x.yanlis; })),
        sonDenemeSayisi: son.length
      };
    });
  }

  // Toplam net serisi (grafik için)
  function toplamNetSerisi(veri, tur) {
    return siraliDenemeler(veri, tur).map(function (d) {
      return { tarih: d.tarih, ad: d.ad, net: denemeToplami(d).net };
    });
  }

  function hedefToplami(veri, sinav, harita) {
    var varMi = false, t = 0;
    D.DENEME_DERSLERI.forEach(function (d) {
      if (d.sinav === sinav && (d.anahtar in harita)) { varMi = true; t += harita[d.anahtar]; }
    });
    return varMi ? yuvarla2(t) : null;
  }

  function toplamHedef(veri, sinav) { return hedefToplami(veri, sinav, veri.hedefler.hedefNetler); }
  function toplamMevcut(veri, sinav) { return hedefToplami(veri, sinav, veri.hedefler.mevcutNetler); }

  // Mevcut seviyeyi son n denemeden hesapla: { anahtar: ortalamaNet } (denemesi olan dersler için)
  function sonDenemelerdenMevcut(veri, n) {
    var cikti = {};
    ['TYT', 'AYT'].forEach(function (sinav) {
      dersAnalizi(veri, sinav, n || 3).forEach(function (r) {
        if (r.ortalama !== null) { cikti[r.anahtar] = Math.max(0, r.ortalama); }
      });
    });
    return cikti;
  }

  // ---------- Yanlış / boş kayıtları ----------

  function hatalariSuz(veri, filtre) {
    filtre = filtre || {};
    return veri.hatalar.filter(function (h) {
      if (filtre.tur && h.tur !== filtre.tur) { return false; }
      if (filtre.dersId && h.dersId !== filtre.dersId) { return false; }
      if (filtre.sebep && h.sebep !== filtre.sebep) { return false; }
      return true;
    }).sort(function (a, b) {
      if (a.tarih !== b.tarih) { return a.tarih < b.tarih ? 1 : -1; }
      return a.olusturma < b.olusturma ? 1 : (a.olusturma > b.olusturma ? -1 : 0);
    });
  }

  function hataIstatistikleri(veri, filtre) {
    var liste = hatalariSuz(veri, filtre);
    var sebepSayi = {}, konuSayi = {}, dersSayi = {}, konusuz = 0;
    liste.forEach(function (h) {
      sebepSayi[h.sebep] = (sebepSayi[h.sebep] || 0) + 1;
      var dersAdi = h.dersAdi || '(ders silinmiş)';
      dersSayi[dersAdi] = (dersSayi[dersAdi] || 0) + 1;
      if (!h.konuAdi) { konusuz++; return; }
      var anahtar = dersAdi + '|' + h.konuAdi;
      if (!konuSayi[anahtar]) { konuSayi[anahtar] = { dersAdi: dersAdi, konuAdi: h.konuAdi, sayi: 0 }; }
      konuSayi[anahtar].sayi++;
    });
    var sebepler = D.SEBEPLER.map(function (s) { return { id: s[0], ad: s[1], sayi: sebepSayi[s[0]] || 0 }; })
      .filter(function (s) { return s.sayi > 0; })
      .sort(function (a, b) { return b.sayi - a.sayi; });
    var konular = Object.keys(konuSayi).map(function (k) { return konuSayi[k]; })
      .sort(function (a, b) { return b.sayi - a.sayi || (a.konuAdi < b.konuAdi ? -1 : 1); });
    var dersler = Object.keys(dersSayi).map(function (k) { return { ad: k, sayi: dersSayi[k] }; })
      .sort(function (a, b) { return b.sayi - a.sayi; });
    return { toplam: liste.length, yanlis: liste.filter(function (h) { return h.tur === 'yanlis'; }).length, bos: liste.filter(function (h) { return h.tur === 'bos'; }).length, sebepler: sebepler, konular: konular, dersler: dersler, konusuz: konusuz };
  }

  function konuHataSayisi(veri, konuId) {
    return veri.hatalar.filter(function (h) { return h.konuId === konuId; }).length;
  }

  function sebepAdi(id) {
    for (var i = 0; i < D.SEBEPLER.length; i++) { if (D.SEBEPLER[i][0] === id) { return D.SEBEPLER[i][1]; } }
    return id;
  }

  // ---------- Tekrar listesi ----------

  function tekrarZamaniGelenler(veri, bugun) {
    var liste = [];
    veri.dersler.forEach(function (d) {
      d.konular.forEach(function (k) {
        if (k.durum === 'bitti' && k.tekrarTarihi && k.tekrarTarihi <= bugun) {
          liste.push({
            dersId: d.id, konuId: k.id, dersAdi: d.grup + ' ' + d.ad, konuAdi: k.ad,
            tekrarTarihi: k.tekrarTarihi, gecikme: D.gunFarki(k.tekrarTarihi, bugun), tekrarSayisi: k.tekrarSayisi
          });
        }
      });
    });
    return liste.sort(function (a, b) { return b.gecikme - a.gecikme || (a.konuAdi < b.konuAdi ? -1 : 1); });
  }

  // ---------- Kaynaklar ----------

  function kaynakOzeti(k, bugun) {
    var kalan = k.toplam - k.yapilan;
    var o = { yuzde: Math.round((k.yapilan / k.toplam) * 100), kalan: kalan, bitti: kalan === 0, gunlukHedef: null, hedefGecti: false, kalanGun: null };
    if (k.bitisTarihi && !o.bitti) {
      var gun = D.gunFarki(bugun, k.bitisTarihi) + 1; // bugün dahil
      if (gun <= 0) { o.hedefGecti = true; }
      else { o.kalanGun = gun; o.gunlukHedef = Math.ceil(kalan / gun); }
    }
    return o;
  }

  function sinavaKalanGun(veri, bugun) {
    if (!veri.hedefler.sinavTarihi) { return null; }
    return D.gunFarki(bugun, veri.hedefler.sinavTarihi);
  }

  // ---------- Kapsamlı Durum Analizi (AI ve Raporlama için) ----------

  function kapsamliDurumOzeti(veri, bugun) {
    var kalan = sinavaKalanGun(veri, bugun);
    var tytSeri = toplamNetSerisi(veri, 'TYT');
    var aytSeri = toplamNetSerisi(veri, 'AYT');
    var sonTYT = tytSeri.length ? tytSeri[tytSeri.length - 1] : null;
    var sonAYT = aytSeri.length ? aytSeri[aytSeri.length - 1] : null;

    var tytAnaliz = dersAnalizi(veri, 'TYT', 5);
    var aytAnaliz = dersAnalizi(veri, 'AYT', 5);

    var mufredat = veri.dersler.map(function (d) {
      var s = D.dersIlerleme(d);
      var zayif = d.konular.filter(function (k) { return k.durum !== 'bitti' || k.seviye <= 2; }).map(function (k) {
        return { id: k.id, ad: k.ad, durum: k.durum, seviye: k.seviye, tekrarSayisi: k.tekrarSayisi };
      });
      return {
        id: d.id,
        grup: d.grup,
        ad: d.ad,
        toplam: s.toplam,
        bitti: s.bitti,
        yuzde: s.yuzde,
        zayifKonular: zayif
      };
    });

    var hStat = hataIstatistikleri(veri);
    var tekrarlar = tekrarZamaniGelenler(veri, bugun);

    var son14 = D.tarihEkle(bugun, -13);
    var tamamlanan14 = veri.gorevler.filter(function (g) {
      return g.tamamlandi && g.tamamlanmaTarihi && g.tamamlanmaTarihi.slice(0, 10) >= son14 && g.tamamlanmaTarihi.slice(0, 10) <= bugun;
    });
    var toplamDk14 = topla(tamamlanan14.map(function (g) { return g.sureDk || 0; }));

    var denemeSayisi = veri.denemeler.length;
    var yeterliMi = denemeSayisi >= 2;

    return {
      kalanGun: kalan,
      hedef: veri.hedefler,
      toplamHedef: { TYT: toplamHedef(veri, 'TYT'), AYT: toplamHedef(veri, 'AYT') },
      sonDenemeler: { TYT: sonTYT, AYT: sonAYT },
      denemeSayisi: denemeSayisi,
      tytSerisi: tytSeri,
      aytSerisi: aytSeri,
      dersAnalizleri: { TYT: tytAnaliz, AYT: aytAnaliz },
      mufredat: mufredat,
      hataIstatistikleri: hStat,
      tekrarGecikenler: tekrarlar,
      performans14Gun: {
        gorevSayisi: tamamlanan14.length,
        toplamDk: toplamDk14,
        gunlukOrtDk: Math.round(toplamDk14 / 14)
      },
      yeterliVeri: yeterliMi,
      veriYetersizNotu: yeterliMi ? '' : 'Henüz en az 2 deneme kaydı girilmediği için genel seviye ve gelişim eğilimi sınırlı verilere dayanmaktadır.'
    };
  }

  // ---------- Yanlış Defterinden Otomatik Tekrar Önerileri ----------

  function yanlisTekrarOnerileri(veri, bugun) {
    if (!Array.isArray(veri.hatalar) || !veri.hatalar.length) {
      return { yeniDenemelerVar: false, oneriler: [] };
    }

    var ayarlar = veri.yanlisPlaniAyarlari || { denemeEsigi: 3, sonDenemeSayisi: 0 };
    var denemeFarki = veri.denemeler.length - (ayarlar.sonDenemeSayisi || 0);
    var tetiklendi = denemeFarki >= (ayarlar.denemeEsigi || 3);

    var konuHarita = {};
    veri.hatalar.forEach(function (h) {
      var kId = h.konuId || (h.dersAdi + ':' + h.konuAdi);
      if (!konuHarita[kId]) {
        konuHarita[kId] = {
          konuId: h.konuId || '',
          dersId: h.dersId || '',
          dersAdi: h.dersAdi || '',
          konuAdi: h.konuAdi || '',
          toplam: 0,
          yanlis: 0,
          bos: 0,
          sebepler: {}
        };
      }
      konuHarita[kId].toplam++;
      if (h.tur === 'bos') { konuHarita[kId].bos++; } else { konuHarita[kId].yanlis++; }
      var sAd = sebepAdi(h.sebep);
      konuHarita[kId].sebepler[sAd] = (konuHarita[kId].sebepler[sAd] || 0) + 1;
    });

    var oneriler = [];
    var mevcutGorevler = Array.isArray(veri.yanlisGorevleri) ? veri.yanlisGorevleri : [];

    Object.keys(konuHarita).forEach(function (kId) {
      var item = konuHarita[kId];
      if (!item.konuAdi) { return; }
      if (item.toplam < 2) { return; }

      var zatenVar = mevcutGorevler.some(function (g) {
        if (item.konuId && g.konuId === item.konuId) {
          if (g.durum === 'onerildi' || g.durum === 'onaylandi') { return true; }
          if (g.durum === 'calisildi' && g.tamamlanmaTarihi && D.gunFarki(g.tamamlanmaTarihi, bugun) < 7) { return true; }
        }
        if (!item.konuId && g.baslik.indexOf(item.konuAdi) >= 0 && g.durum !== 'reddedildi') {
          return true;
        }
        return false;
      });
      if (zatenVar) { return; }

      var enSik = Object.keys(item.sebepler).map(function (s) { return { sebep: s, sayi: item.sebepler[s] }; })
        .sort(function (a, b) { return b.sayi - a.sayi; })[0];
      var sebepMetin = enSik ? enSik.sebep : 'Hata tekrarı';

      oneriler.push({
        konuId: item.konuId,
        dersId: item.dersId,
        dersAdi: item.dersAdi,
        konuAdi: item.konuAdi,
        baslik: 'Yanlış Tekrarı: ' + item.konuAdi + ' (' + item.toplam + ' hata)',
        hataSayisi: item.toplam,
        sebep: sebepMetin,
        soruHedefi: Math.min(40, Math.max(15, item.toplam * 10)),
        sureDk: 40,
        tarih: bugun
      });
    });

    oneriler.sort(function (a, b) { return b.hataSayisi - a.hataSayisi; });

    return {
      yeniDenemelerVar: tetiklendi,
      denemeFarki: denemeFarki,
      denemeEsigi: ayarlar.denemeEsigi || 3,
      oneriler: oneriler
    };
  }

  // ---------- Rutin İstatistikleri ----------

  function rutinIstatistikleri(veri, baslangic, bitis) {
    var harita = {};
    (veri.tekrarlananRutinler || []).forEach(function (r) {
      harita[r.id] = { id: r.id, ad: r.ad, tur: r.tur, hedefTur: r.hedefTur, tamamlananGun: 0, toplamDeger: 0 };
    });
    if (!veri.rutinKayitlari || typeof veri.rutinKayitlari !== 'object') { return harita; }
    Object.keys(veri.rutinKayitlari).forEach(function (t) {
      if (baslangic && t < baslangic) { return; }
      if (bitis && t > bitis) { return; }
      var gun = veri.rutinKayitlari[t];
      if (!gun || typeof gun !== 'object') { return; }
      Object.keys(gun).forEach(function (rId) {
        if (harita[rId]) {
          if (gun[rId].tamamlandi) { harita[rId].tamamlananGun++; }
          harita[rId].toplamDeger += (gun[rId].deger || 0);
        }
      });
    });
    return harita;
  }

  var api = {
    netHesapla: netHesapla,
    netMetni: netMetni,
    sureMetni: sureMetni,
    dakikayaCevir: dakikayaCevir,
    saateCevir: saateCevir,
    zamanMetni: zamanMetni,
    cakisiyorMu: cakisiyorMu,
    denemeToplami: denemeToplami,
    siraliDenemeler: siraliDenemeler,
    dersSerisi: dersSerisi,
    dersAnalizi: dersAnalizi,
    toplamNetSerisi: toplamNetSerisi,
    toplamHedef: toplamHedef,
    toplamMevcut: toplamMevcut,
    sonDenemelerdenMevcut: sonDenemelerdenMevcut,
    hatalariSuz: hatalariSuz,
    hataIstatistikleri: hataIstatistikleri,
    konuHataSayisi: konuHataSayisi,
    sebepAdi: sebepAdi,
    tekrarZamaniGelenler: tekrarZamaniGelenler,
    kaynakOzeti: kaynakOzeti,
    sinavaKalanGun: sinavaKalanGun,
    kapsamliDurumOzeti: kapsamliDurumOzeti,
    yanlisTekrarOnerileri: yanlisTekrarOnerileri,
    rutinIstatistikleri: rutinIstatistikleri
  };

  kok.YKSAnaliz = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
