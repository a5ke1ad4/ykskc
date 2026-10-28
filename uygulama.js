/*
 * uygulama.js — Ortak ekran yardımcıları ve ana ekranlar (Bugün, Görevler, Dersler, Yedek).
 * Diğer ekranlar ekranlar-yks.js içindedir. Veri işlemleri depo.js, hesaplamalar analiz.js içindedir.
 * Kullanıcının yazdığı metinler her zaman textContent ile eklenir (HTML olarak yorumlanmaz).
 */
(function () {
  'use strict';

  var D = window.YKSDepo;
  var A = window.YKSAnaliz;
  var R = window.YKSRapor;

  var DURUM_ETIKETLERI = { baslanmadi: 'Başlanmadı', calisiyor: 'Çalışıyorum', bitti: 'Bitti' };
  var SEVIYE_ETIKETLERI = ['Seviye seçilmedi', '1 - Çok zayıf', '2 - Zayıf', '3 - Orta', '4 - İyi', '5 - Çok iyi'];
  var FILTRELER = [
    ['bugun', 'Bugün'],
    ['geciken', 'Geciken'],
    ['yaklasan', 'Yaklaşan'],
    ['tarihsiz', 'Tarihsiz'],
    ['tamamlanan', 'Tamamlanan'],
    ['tumu', 'Tümü']
  ];

  var durum = {
    veri: null,
    gorunum: 'bugun',
    filtre: 'bugun',
    acikGorevler: {},
    acikDersler: {},
    bugun: D.bugunStr(),
    odak: null,
    duzenleId: null,
    kalici: null,
    // Aşama 2 ekranlarının durumu (ekranlar-yks.js kullanır)
    kaynakDuzenle: null,
    denemeDuzenle: null,
    hataDuzenle: null,
    hataFiltre: { tur: '', dersId: '', sebep: '' },
    sonHata: { tarih: '', tur: 'yanlis', dersId: '', denemeId: '' },
    denemeTuru: 'TYT',
    // Aşama 3 ekranlarının durumu (ekranlar-plan.js kullanır)
    planTarihi: '',
    raporTarihi: '',
    rutinDuzenle: null,
    haftaBasi: '',
    tekrarlananRutinDuzenle: null
  };

  // ---------- Küçük yardımcılar ----------

  function el(etiket, ozellikler, cocuklar) {
    var e = document.createElement(etiket);
    Object.keys(ozellikler || {}).forEach(function (k) {
      var v = ozellikler[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'sinif') { e.className = v; }
      else if (k === 'metin') { e.textContent = v; }
      else if (k === 'isaretli') { e.checked = true; }
      else if (k.slice(0, 2) === 'on') { e.addEventListener(k.slice(2), v); }
      else { e.setAttribute(k, v === true ? '' : v); }
    });
    (cocuklar || []).forEach(function (c) {
      if (c === null || c === undefined) { return; }
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  // Üstünde küçük başlığı olan form alanı
  function alan(baslik, girdi, sinif) {
    return el('label', { sinif: 'alan' + (sinif ? ' ' + sinif : '') }, [el('span', { sinif: 'alan-baslik', metin: baslik }), girdi]);
  }

  function saatMetni() {
    var s = new Date();
    return (s.getHours() < 10 ? '0' : '') + s.getHours() + ':' + (s.getMinutes() < 10 ? '0' : '') + s.getMinutes();
  }

  // ---------- Uyarılar ve kayıt durumu ----------

  function uyariGoster(mesaj, tur, anahtar) {
    anahtar = anahtar || 'genel';
    uyariSil(anahtar);
    var kutu = el('div', {
      sinif: 'uyari uyari-' + tur,
      role: tur === 'hata' ? 'alert' : 'status',
      'data-anahtar': anahtar
    }, [
      el('span', { metin: mesaj }),
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Kapat', onclick: function () { kutu.remove(); } })
    ]);
    document.getElementById('uyari-alani').appendChild(kutu);
  }

  function uyariSil(anahtar) {
    var eski = document.querySelector('#uyari-alani [data-anahtar="' + anahtar + '"]');
    if (eski) { eski.remove(); }
  }

  function hataGoster(mesaj) { uyariGoster(mesaj, 'hata', 'genel'); }

  function kayitDurumuYaz(basarili, mesaj) {
    var k = document.getElementById('kayit-durumu');
    k.textContent = basarili ? 'Otomatik kayıt: ' + saatMetni() + '\'de kaydedildi' : (mesaj || 'Kaydedilemedi');
    k.className = 'kayit-durumu' + (basarili ? '' : ' hata');
  }

  // Bir değişikliği uygular, kaydeder ve ekranı yeniler. Hata olursa görünür şekilde bildirir.
  // Başarılıysa true, hata olduysa false döner.
  function islem(degistir, odak) {
    uyariSil('genel');
    try {
      degistir();
    } catch (hata) {
      hataGoster(hata.message);
      return false;
    }
    kaydetVeCiz(odak);
    return true;
  }

  function kaydetVeCiz(odak) {
    try {
      var sonuc = D.kaydet(durum.veri);
      kayitDurumuYaz(true);
      uyariSil('kayit');
      if (sonuc.uyari) { uyariGoster(sonuc.uyari, 'uyari', 'oto-kopya'); } else { uyariSil('oto-kopya'); }
    } catch (hata) {
      kayitDurumuYaz(false, 'Kaydedilemedi!');
      uyariGoster('Veriler kaydedilemedi: ' + hata.message + ' Yedek sayfasından yedek alarak verilerini koru.', 'hata', 'kayit');
    }
    durum.odak = odak || null;
    ciz();
  }

  // ---------- Çizim ----------

  var gorunumler = {};

  function ciz() {
    durum.bugun = D.bugunStr();
    var anaGorunum = durum.gorunum;
    if (anaGorunum === 'plan' || anaGorunum === 'haftalik' || anaGorunum === 'rutin') { anaGorunum = 'planlama'; }
    if (anaGorunum === 'hedefler' || anaGorunum === 'rapor') { anaGorunum = 'gelisim'; }

    document.querySelectorAll('.menu-dugme, .mobil-nav-dugme').forEach(function (d) {
      var g = d.getAttribute('data-gorunum');
      var aktif = (g === durum.gorunum) || (g === anaGorunum);
      d.classList.toggle('aktif', aktif);
      if (aktif) { d.setAttribute('aria-current', 'page'); } else { d.removeAttribute('aria-current'); }
    });

    var kaydirma = window.scrollY;
    var kap = document.getElementById('icerik');
    kap.textContent = '';
    kap.appendChild(gorunumler[durum.gorunum]());
    window.scrollTo(0, kaydirma);

    if (durum.odak) {
      var hedef = kap.querySelector('[data-odak="' + durum.odak + '"]');
      if (hedef) { hedef.focus(); }
      durum.odak = null;
    }
  }

  function gorunumeGit(ad) {
    durum.gorunum = ad;
    ciz();
    window.scrollTo(0, 0);
  }

  function ilerlemeCubugu(yuzde, yesil) {
    return el('div', { sinif: 'ilerleme', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(yuzde) }, [
      el('div', { sinif: 'ilerleme-dolgu' + (yesil ? ' yesil' : ''), style: 'width:' + yuzde + '%' })
    ]);
  }

  function dersSecenekleri(secili, bosMetin) {
    var s = el('select', { 'aria-label': 'Ders' }, [el('option', { value: '', metin: bosMetin || 'Ders seçilmedi' })]);
    durum.veri.dersler.forEach(function (d) {
      s.appendChild(el('option', { value: d.id, metin: d.grup + ' ' + d.ad }));
    });
    s.value = secili || '';
    return s;
  }

  function oncelikSecimi(secili) {
    var s = el('select', { 'aria-label': 'Öncelik' }, [
      el('option', { value: '3', metin: 'Yüksek' }), el('option', { value: '2', metin: 'Normal' }), el('option', { value: '1', metin: 'Düşük' })
    ]);
    s.value = String(secili);
    return s;
  }

  function sayfaBasligi(metin, aciklama) {
    var kok = el('div', { sinif: 'baslik-blogu' }, [el('h1', { sinif: 'sayfa-baslik', metin: metin })]);
    if (aciklama) { kok.appendChild(el('p', { sinif: 'alt-yazi', metin: aciklama })); }
    return kok;
  }

  // ---------- Görev satırı ----------

  function gorevSatiri(g) {
    var acik = !!durum.acikGorevler[g.id];
    var gecikti = D.gorevGecikmisMi(g, durum.bugun);
    var alt = D.altGorevOzeti(g);
    var ders = D.dersBul(durum.veri, g.dersId);
    var zaman = A.zamanMetni(g);

    var onay = el('input', {
      type: 'checkbox',
      isaretli: g.tamamlandi,
      'aria-label': 'Görevi tamamlandı olarak işaretle: ' + g.baslik,
      onchange: function () {
        islem(function () { D.gorevTamamlaDegistir(durum.veri, g.id, onay.checked); });
      }
    });

    var tarihSinifi = 'etiket' + (gecikti ? ' gecikti' : (g.tarih === durum.bugun && !g.tamamlandi ? ' bugun' : ''));
    var bilgi = el('div', { sinif: 'gorev-bilgi' }, [
      el('span', { sinif: tarihSinifi, metin: D.tarihEtiketi(g.tarih, durum.bugun, g.tamamlandi) }),
      zaman ? el('span', { sinif: 'etiket zaman', metin: zaman }) : null,
      A.cakisiyorMu(durum.veri, g) ? el('span', { sinif: 'etiket gecikti cakisma', metin: 'Saati çakışıyor' }) : null,
      g.oncelik !== 2 ? el('span', { sinif: 'etiket' + (g.oncelik === 3 ? ' yuksek' : ''), metin: g.oncelik === 3 ? 'Yüksek öncelik' : 'Düşük öncelik' }) : null,
      ders ? el('span', { sinif: 'etiket', metin: ders.grup + ' ' + ders.ad }) : null,
      alt.toplam ? el('span', { sinif: 'etiket', metin: alt.tamam + '/' + alt.toplam + ' alt görev' }) : null
    ]);

    var metin = el('div', { sinif: 'gorev-metin' }, [
      el('div', { sinif: 'gorev-baslik', metin: g.baslik }),
      g.notlar ? el('div', { sinif: 'gorev-not', metin: g.notlar }) : null,
      bilgi
    ]);

    var islemler = el('div', { sinif: 'gorev-islemler' }, [
      el('button', {
        type: 'button', sinif: 'metin-dugme', metin: 'Alt görevler', 'aria-expanded': acik ? 'true' : 'false',
        onclick: function () { durum.acikGorevler[g.id] = !acik; ciz(); }
      }),
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Düzenle', onclick: function () { duzenlePenceresiniAc(g); } }),
      el('button', {
        type: 'button', sinif: 'metin-dugme sil', metin: 'Sil',
        onclick: function () {
          var uyariMetni = '"' + g.baslik + '" görevi silinsin mi?' + (alt.toplam ? ' Alt görevleri de silinir.' : '');
          if (window.confirm(uyariMetni)) { islem(function () { D.gorevSil(durum.veri, g.id); }); }
        }
      })
    ]);

    var satir = el('li', { sinif: 'gorev' + (g.tamamlandi ? ' tamam' : ''), 'data-gorev-id': g.id }, [
      el('div', { sinif: 'gorev-ust' }, [onay, metin, islemler])
    ]);

    if (acik) { satir.appendChild(altPaneli(g)); }
    return satir;
  }

  function altPaneli(g) {
    var panel = el('div', { sinif: 'alt-panel' });
    g.altGorevler.forEach(function (a) {
      var kutu = el('input', {
        type: 'checkbox', isaretli: a.tamamlandi, 'aria-label': 'Alt görevi tamamlandı olarak işaretle: ' + a.baslik,
        onchange: function () { islem(function () { D.altGorevTamamlaDegistir(durum.veri, g.id, a.id, kutu.checked); }); }
      });
      panel.appendChild(el('div', { sinif: 'alt-gorev' + (a.tamamlandi ? ' tamam' : '') }, [
        kutu,
        el('span', { sinif: 'alt-baslik', metin: a.baslik }),
        el('button', {
          type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Alt görevi sil: ' + a.baslik,
          onclick: function () { islem(function () { D.altGorevSil(durum.veri, g.id, a.id); }); }
        })
      ]));
    });

    var girdi = el('input', { type: 'text', placeholder: 'Alt görev ekle…', 'aria-label': 'Yeni alt görev', maxlength: '200', 'data-odak': 'alt-' + g.id });
    panel.appendChild(el('form', {
      sinif: 'alt-ekle',
      onsubmit: function (olay) {
        olay.preventDefault();
        if (!girdi.value.trim()) { girdi.focus(); return; }
        islem(function () { D.altGorevEkle(durum.veri, g.id, girdi.value); }, 'alt-' + g.id);
      }
    }, [girdi, el('button', { type: 'submit', sinif: 'ikincil', metin: 'Ekle' })]));
    return panel;
  }

  function gorevListesi(liste, bosMesaj) {
    if (!liste.length) { return el('p', { sinif: 'bos', metin: bosMesaj }); }
    return el('ul', { sinif: 'gorev-listesi' }, liste.map(gorevSatiri));
  }

  // ---------- Düzenleme penceresi ----------

  function duzenlePenceresiniAc(g) {
    durum.duzenleId = g.id;
    document.getElementById('duzenle-baslik').value = g.baslik;
    document.getElementById('duzenle-tarih').value = g.tarih;
    document.getElementById('duzenle-saat').value = g.saat;
    document.getElementById('duzenle-sure').value = g.sureDk ? String(g.sureDk) : '';
    document.getElementById('duzenle-notlar').value = g.notlar;
    document.getElementById('duzenle-oncelik').value = String(g.oncelik);
    document.getElementById('duzenle-hata').textContent = '';
    var secim = document.getElementById('duzenle-ders');
    secim.textContent = '';
    secim.appendChild(el('option', { value: '', metin: 'Ders seçilmedi' }));
    durum.veri.dersler.forEach(function (d) {
      secim.appendChild(el('option', { value: d.id, metin: d.grup + ' ' + d.ad }));
    });
    secim.value = g.dersId;
    document.getElementById('duzenle-penceresi').showModal();
    document.getElementById('duzenle-baslik').focus();
  }

  function duzenlePenceresiniHazirla() {
    var pencere = document.getElementById('duzenle-penceresi');
    document.getElementById('duzenle-iptal').addEventListener('click', function () { pencere.close(); });
    document.getElementById('duzenle-formu').addEventListener('submit', function (olay) {
      olay.preventDefault();
      var baslik = document.getElementById('duzenle-baslik').value;
      if (!baslik.trim()) {
        document.getElementById('duzenle-hata').textContent = 'Görev başlığı boş olamaz.';
        return;
      }
      var degisiklik = {
        baslik: baslik,
        tarih: document.getElementById('duzenle-tarih').value,
        saat: document.getElementById('duzenle-saat').value,
        sureDk: document.getElementById('duzenle-sure').value,
        dersId: document.getElementById('duzenle-ders').value,
        oncelik: document.getElementById('duzenle-oncelik').value,
        notlar: document.getElementById('duzenle-notlar').value
      };
      var id = durum.duzenleId;
      // Hatalı saat/süre girilirse pencere açık kalır ve hata pencerenin içinde gösterilir.
      try {
        D.gorevGuncelle(durum.veri, id, degisiklik);
      } catch (hata) {
        document.getElementById('duzenle-hata').textContent = hata.message;
        return;
      }
      pencere.close();
      kaydetVeCiz();
    });
  }

  // ---------- Bugün ----------

  function bugunGorunumu() {
    var o = D.ozet(durum.veri, durum.bugun);
    var t = D.uzunTarih(durum.bugun);
    var kok = el('div');

    kok.appendChild(el('h1', { sinif: 'hero-tarih', metin: t.gunAy }));
    kok.appendChild(el('p', { sinif: 'hero-gun', metin: t.gunYil }));

    var kalanGun = A.sinavaKalanGun(durum.veri, durum.bugun);
    if (kalanGun !== null && kalanGun >= 0) {
      kok.appendChild(el('p', { sinif: 'sinav-sayaci', metin: kalanGun === 0 ? 'YKS bugün. Başarılar!' : 'YKS\'ye ' + kalanGun + ' gün kaldı.' }));
    }

    var dunku = durum.veri.gunluk[D.tarihEkle(durum.bugun, -1)];
    if (dunku && dunku.odak) {
      kok.appendChild(el('p', { sinif: 'bugun-odagi', metin: 'Bugünün odağı: ' + dunku.odak }));
    }

    if (o.bugunToplam === 0) {
      kok.appendChild(el('p', { sinif: 'ilerleme-yazi', metin: 'Bugün için henüz görev yok.' }));
      kok.appendChild(ilerlemeCubugu(0, false));
    } else {
      var yuzde = Math.round((o.bugunTamam / o.bugunToplam) * 100);
      kok.appendChild(el('p', { sinif: 'ilerleme-yazi', metin: o.bugunTamam + ' / ' + o.bugunToplam + ' görev tamamlandı' }));
      kok.appendChild(ilerlemeCubugu(yuzde, o.bugunTamam === o.bugunToplam));
      if (o.bugunPlanDk > 0) {
        kok.appendChild(el('p', { sinif: 'alt-yazi sure-ozeti', metin: 'Bugün planlanan süre: ' + A.sureMetni(o.bugunPlanDk) + (o.bugunTamamDk ? ' (tamamlanan: ' + A.sureMetni(o.bugunTamamDk) + ')' : '') }));
      }
    }

    var rapor = R.gunlukRapor(durum.veri, durum.bugun);
    if (rapor.hedefDk > 0) {
      var hedefYuzde = Math.min(100, rapor.hedefOrani);
      kok.appendChild(el('div', { sinif: 'gunluk-hedef' }, [
        el('p', { sinif: 'ilerleme-yazi', metin: 'Günlük çalışma hedefi: ' + A.sureMetni(rapor.tamamlananDk || 0) + (rapor.tamamlananDk ? '' : '0 dk') + ' / ' + A.sureMetni(rapor.hedefDk) + ' (%' + rapor.hedefOrani + ')' }),
        ilerlemeCubugu(hedefYuzde, rapor.hedefOrani >= 100)
      ]));
    }
    kok.appendChild(el('p', { sinif: 'plan-baglantisi' }, [
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Bugünün programını gör ve oluştur', onclick: function () { durum.planTarihi = ''; gorunumeGit('plan'); } })
    ]));

    if (D.yedekHatirlatmaGerekli(durum.veri, durum.bugun)) {
      var gun = D.yedekGunu(durum.veri, durum.bugun);
      var metin = gun === null ? 'Henüz hiç yedek almadın.' : 'Son yedeğin ' + gun + ' gün önce alındı.';
      kok.appendChild(el('div', { sinif: 'hatirlatma' }, [
        el('span', { metin: metin + ' ' }),
        el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Yedek sayfasına git', onclick: function () { gorunumeGit('yedek'); } })
      ]));
    }

    var girdi = el('input', { type: 'text', placeholder: 'Bugün için yeni görev…', 'aria-label': 'Bugün için yeni görev', maxlength: '200', 'data-odak': 'hizli-ekle' });
    kok.appendChild(el('form', {
      sinif: 'hizli-ekle',
      onsubmit: function (olay) {
        olay.preventDefault();
        if (!girdi.value.trim()) { girdi.focus(); return; }
        islem(function () { D.gorevEkle(durum.veri, { baslik: girdi.value, tarih: durum.bugun }); }, 'hizli-ekle');
      }
    }, [girdi, el('button', { type: 'submit', sinif: 'birincil', metin: 'Ekle' })]));


    // Günlük Tekrarlanan Rutinler (Paragraf, Problem, Geometri, Özel)
    var gunlukRutinler = D.gununRutinleri(durum.veri, durum.bugun);
    if (gunlukRutinler.length) {
      var tamamlananRutin = gunlukRutinler.filter(function (r) { return r.tamamlandi; }).length;
      kok.appendChild(el('div', { sinif: 'rutin-kart-bolumu' }, [
        el('div', { sinif: 'rutin-kart-baslik-satir' }, [
          el('h2', { sinif: 'rutin-bolum-baslik', metin: 'Günün Rutinleri (' + tamamlananRutin + ' / ' + gunlukRutinler.length + ')' }),
          el('button', {
            type: 'button', sinif: 'metin-dugme', metin: 'Rutinleri yönet',
            onclick: function () { gorunumeGit('rutin'); }
          })
        ]),
        el('ul', { sinif: 'rutin-gunluk-liste' }, gunlukRutinler.map(function (r) {
          var kutu = el('input', {
            type: 'checkbox', isaretli: r.tamamlandi, 'aria-label': r.ad + ' tamamlandı',
            onchange: function () {
              islem(function () {
                D.gunlukRutinKaydet(durum.veri, durum.bugun, r.id, {
                  tamamlandi: kutu.checked,
                  gerceklesen: r.gerceklesen !== null ? r.gerceklesen : (kutu.checked ? r.hedefDeger : 0)
                });
              });
            }
          });

          var birim = r.hedefTuru === 'soru' ? 'soru' : 'dk';
          var hedefYazi = r.hedefDeger ? 'Hedef: ' + r.hedefDeger + ' ' + birim : '';

          var yapilanGirdi = el('input', {
            type: 'number', min: '0', max: '9999', step: '1', inputmode: 'numeric',
            placeholder: birim, 'aria-label': r.ad + ' gerçekleşen ' + birim, sinif: 'rutin-sayi-girdi',
            onchange: function () {
              var val = yapilanGirdi.value === '' ? null : Number(yapilanGirdi.value);
              islem(function () {
                D.gunlukRutinKaydet(durum.veri, durum.bugun, r.id, {
                  tamamlandi: val !== null && r.hedefDeger ? (val >= r.hedefDeger) : r.tamamlandi,
                  gerceklesen: val
                });
              });
            }
          });
          if (r.gerceklesen !== null && r.gerceklesen !== undefined) {
            yapilanGirdi.value = String(r.gerceklesen);
          }

          var turEtiket = D.RUTIN_TURLERI[r.tur] || r.tur;

          return el('li', { sinif: 'rutin-gunluk-oge' + (r.tamamlandi ? ' tamam' : '') }, [
            kutu,
            el('div', { sinif: 'rutin-oge-bilgi' }, [
              el('span', { sinif: 'rutin-oge-ad', metin: r.ad }),
              el('span', { sinif: 'etiket rutin-tur-' + r.tur, metin: turEtiket }),
              hedefYazi ? el('span', { sinif: 'alt-yazi', metin: hedefYazi }) : null
            ]),
            el('div', { sinif: 'rutin-oge-aksiyon' }, [
              el('span', { sinif: 'alt-yazi', metin: 'Yapılan:' }),
              yapilanGirdi,
              el('span', { sinif: 'alt-yazi', metin: birim })
            ])
          ]);
        }))
      ]));
    }

    if (o.geciken > 0) {
      kok.appendChild(el('h2', { metin: 'Geciken görevler (' + o.geciken + ')' }));
      kok.appendChild(gorevListesi(D.filtrele(durum.veri, 'geciken', durum.bugun), ''));
    }

    kok.appendChild(el('h2', { metin: 'Bugünkü görevler' }));
    kok.appendChild(gorevListesi(D.filtrele(durum.veri, 'bugun', durum.bugun), 'Bugün için görev yok. Yukarıdan ekleyebilirsin.'));

    var haftaBasi = D.haftaBasiTarihi(durum.bugun);
    var plan = D.haftalikPlanAl(durum.veri, haftaBasi);
    var secilenTekrarlar = (plan && plan.tekrarKonulari) || [];
    if (secilenTekrarlar.length) {
      kok.appendChild(el('h2', { metin: 'Bu Hafta Seçtiğin Tekrarlar (' + secilenTekrarlar.filter(function (t) { return !t.tamamlandi; }).length + '/' + secilenTekrarlar.length + ')' }));
      kok.appendChild(el('ul', { sinif: 'tekrar-listesi' }, secilenTekrarlar.map(function (r) {
        return el('li', { sinif: 'tekrar-satir' + (r.tamamlandi ? ' tamamlandi' : ''), 'data-tekrar-id': r.id }, [
          el('label', { sinif: 'gorev-sol' }, [
            el('input', {
              type: 'checkbox',
              checked: r.tamamlandi,
              onchange: function (e) {
                islem(function () { D.haftalikTekrarDurum(durum.veri, haftaBasi, r.id, e.target.checked); });
              }
            }),
            el('span', { sinif: 'tekrar-ad' }, [
              el('strong', { metin: r.konuAdi }),
              ' ',
              el('span', { sinif: 'alt-yazi', metin: (r.dersAdi ? r.dersAdi + ' — ' : '') + (r.hedefSoru ? r.hedefSoru + ' soru hedefi' : r.sureDk + ' dk') })
            ])
          ])
        ]);
      })));
    }

    kok.appendChild(el('h2', { metin: 'Konu ilerlemesi' }));
    D.GRUPLAR.forEach(function (grup) {
      var s = D.grupIlerleme(durum.veri, grup);
      kok.appendChild(el('div', { sinif: 'ders-ozet-satir' }, [
        el('div', { sinif: 'ders-ozet-ust' }, [
          el('span', { metin: grup }),
          el('span', { sinif: 'alt-yazi', metin: s.bitti + ' / ' + s.toplam + ' konu bitti (%' + s.yuzde + ')' })
        ]),
        ilerlemeCubugu(s.yuzde, false)
      ]));
    });

    return kok;
  }

  // ---------- Görevler ----------

  function filtreSec(tarih) {
    if (!tarih) { return 'tarihsiz'; }
    if (tarih === durum.bugun) { return 'bugun'; }
    return tarih > durum.bugun ? 'yaklasan' : 'geciken';
  }

  function gorevlerGorunumu() {
    var o = D.ozet(durum.veri, durum.bugun);
    var sayilar = { bugun: o.bugunToplam, geciken: o.geciken, yaklasan: o.yaklasan, tarihsiz: o.tarihsiz, tamamlanan: o.tamamlanan, tumu: o.toplam };
    var kok = el('div');
    kok.appendChild(sayfaBasligi('Görevler'));

    var baslik = el('input', { type: 'text', placeholder: 'Yeni görev…', 'aria-label': 'Yeni görev başlığı', maxlength: '200', 'data-odak': 'gorev-baslik', sinif: 'form-baslik' });
    var tarih = el('input', { type: 'date', 'aria-label': 'Görev tarihi' });
    tarih.value = durum.bugun;
    var saat = el('input', { type: 'time', 'aria-label': 'Başlangıç saati' });
    var sure = el('input', { type: 'number', min: '0', max: '1440', step: '1', inputmode: 'numeric', placeholder: 'dk', 'aria-label': 'Planlanan süre (dakika)' });
    var ders = dersSecenekleri('');
    var oncelik = oncelikSecimi(2);
    kok.appendChild(el('form', {
      sinif: 'gorev-formu',
      onsubmit: function (olay) {
        olay.preventDefault();
        if (!baslik.value.trim()) { baslik.focus(); return; }
        islem(function () {
          var yeni = D.gorevEkle(durum.veri, { baslik: baslik.value, tarih: tarih.value, saat: saat.value, sureDk: sure.value, dersId: ders.value, oncelik: oncelik.value });
          durum.filtre = filtreSec(yeni.tarih);
        }, 'gorev-baslik');
      }
    }, [
      baslik,
      alan('Tarih', tarih),
      alan('Saat', saat),
      alan('Süre (dk)', sure, 'dar'),
      alan('Ders', ders),
      alan('Öncelik', oncelik, 'dar'),
      el('button', { type: 'submit', sinif: 'birincil', metin: 'Görev ekle' })
    ]));

    kok.appendChild(el('div', { sinif: 'filtreler', role: 'group', 'aria-label': 'Görev süzgeci' }, FILTRELER.map(function (f) {
      return el('button', {
        type: 'button',
        sinif: 'filtre' + (durum.filtre === f[0] ? ' aktif' : ''),
        'aria-pressed': durum.filtre === f[0] ? 'true' : 'false',
        'data-filtre': f[0],
        onclick: function () { durum.filtre = f[0]; ciz(); }
      }, [f[1], el('span', { sinif: 'sayi', metin: String(sayilar[f[0]]) })]);
    })));

    var bosMesajlari = {
      bugun: 'Bugün için görev yok.',
      geciken: 'Geciken görevin yok.',
      yaklasan: 'Yaklaşan görev yok.',
      tarihsiz: 'Tarihsiz görev yok.',
      tamamlanan: 'Henüz tamamlanan görev yok.',
      tumu: 'Henüz görev eklemedin. Yukarıdan ilk görevini ekleyebilirsin.'
    };
    kok.appendChild(gorevListesi(D.filtrele(durum.veri, durum.filtre, durum.bugun), bosMesajlari[durum.filtre]));
    return kok;
  }

  // ---------- Dersler ve konular ----------

  function konuSatiri(d, k) {
    var hataSayisi = A.konuHataSayisi(durum.veri, k.id);

    var seviye = el('select', {
      'aria-label': k.ad + ' için öğrenme seviyesi',
      onchange: function () { islem(function () { D.konuSeviyeAyarla(durum.veri, d.id, k.id, seviye.value); }); }
    }, SEVIYE_ETIKETLERI.map(function (e, i) { return el('option', { value: String(i), metin: e }); }));
    seviye.value = String(k.seviye);

    var meta = el('div', { sinif: 'konu-meta' }, [
      el('label', { sinif: 'konu-seviye' }, [el('span', { sinif: 'alan-baslik', metin: 'Seviye' }), seviye])
    ]);

    var haftaBasi = D.haftaBasiTarihi(durum.bugun);
    var plan = D.haftalikPlanAl(durum.veri, haftaBasi);
    var buHaftada = (plan.tekrarKonulari || []).some(function (t) { return t.konuId === k.id; });

    if (buHaftada) {
      meta.appendChild(el('span', { sinif: 'etiket yesil', metin: 'Bu hafta tekrar listende ✓' }));
      meta.appendChild(el('button', {
        type: 'button', sinif: 'metin-dugme sil', metin: 'Kaldır',
        'aria-label': 'Tekrar listesinden kaldır: ' + k.ad,
        onclick: function () {
          islem(function () { D.haftalikTekrarSil(durum.veri, haftaBasi, k.id); });
        }
      }));
    } else if (k.durum === 'bitti' || k.durum === 'calisiyor') {
      meta.appendChild(el('button', {
        type: 'button', sinif: 'ikincil kucuk', metin: '+ Bu Hafta Tekrar Et',
        'aria-label': k.ad + ' konusunu bu haftanın tekrar listesine ekle',
        onclick: function () {
          islem(function () {
            D.haftalikTekrarEkle(durum.veri, haftaBasi, {
              dersId: d.id,
              konuId: k.id,
              konuAdi: k.ad,
              dersAdi: d.ad
            });
          });
          U.uyariGoster('"' + k.ad + '" bu haftanın tekrar listesine eklendi!', 'bilgi', 'konular');
        }
      }));
    }

    return el('li', { sinif: 'konu ' + k.durum, 'data-konu-id': k.id }, [
      el('button', {
        type: 'button', sinif: 'durum-dugme ' + k.durum, metin: DURUM_ETIKETLERI[k.durum],
        'aria-label': k.ad + ' — durum: ' + DURUM_ETIKETLERI[k.durum] + '. Değiştirmek için tıkla.',
        onclick: function () {
          islem(function () { D.konuDurumuIlerlet(durum.veri, d.id, k.id); });
        }
      }),
      el('div', { sinif: 'konu-orta' }, [
        el('div', { sinif: 'konu-ad-satiri' }, [
          el('span', { sinif: 'konu-ad', metin: k.ad }),
          hataSayisi ? el('span', { sinif: 'etiket gecikti hata-rozeti', metin: hataSayisi + ' hata' }) : null
        ]),
        meta
      ]),
      el('button', {
        type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Konuyu sil: ' + k.ad,
        onclick: function () {
          if (window.confirm('"' + k.ad + '" konusu silinsin mi?')) { islem(function () { D.konuSil(durum.veri, d.id, k.id); }); }
        }
      })
    ]);
  }

  function dersBlogu(d) {
    var s = D.dersIlerleme(d);
    var detay = el('details', { sinif: 'ders', open: !!durum.acikDersler[d.id], 'data-ders-id': d.id });
    detay.addEventListener('toggle', function () { durum.acikDersler[d.id] = detay.open; });

    detay.appendChild(el('summary', null, [
      el('span', { sinif: 'ders-ad', metin: d.ad }),
      ilerlemeCubugu(s.yuzde, s.toplam > 0 && s.bitti === s.toplam),
      el('span', { sinif: 'ders-sayi', metin: s.bitti + ' / ' + s.toplam + ' konu' })
    ]));

    var icerik = el('div', { sinif: 'ders-icerik' });
    icerik.appendChild(el('ul', { sinif: 'konu-listesi' }, d.konular.map(function (k) { return konuSatiri(d, k); })));

    var girdi = el('input', { type: 'text', placeholder: 'Konu ekle…', 'aria-label': d.ad + ' için yeni konu', maxlength: '120', 'data-odak': 'konu-' + d.id });
    icerik.appendChild(el('form', {
      sinif: 'konu-ekle',
      onsubmit: function (olay) {
        olay.preventDefault();
        if (!girdi.value.trim()) { girdi.focus(); return; }
        durum.acikDersler[d.id] = true;
        islem(function () { D.konuEkle(durum.veri, d.id, girdi.value); }, 'konu-' + d.id);
      }
    }, [girdi, el('button', { type: 'submit', sinif: 'ikincil', metin: 'Ekle' })]));

    icerik.appendChild(el('div', { sinif: 'ders-islem-satiri' }, [
      el('button', {
        type: 'button', sinif: 'metin-dugme sil', metin: 'Bu dersi sil',
        onclick: function () {
          var mesaj = '"' + d.grup + ' ' + d.ad + '" dersi ve içindeki ' + d.konular.length + ' konu silinsin mi? Bu derse bağlı görevler, kaynaklar ve hata kayıtları silinmez; yalnızca ders bağlantıları kalkar.';
          if (window.confirm(mesaj)) { islem(function () { D.dersSil(durum.veri, d.id); }); }
        }
      })
    ]));

    detay.appendChild(icerik);
    return detay;
  }

  function derslerGorunumu() {
    var kok = el('div');
    kok.appendChild(sayfaBasligi('Dersler ve konular', 'Konunun yanındaki düğmeye tıklayınca durum sırayla değişir: Başlanmadı, Çalışıyorum, Bitti. Bitti olan konu için tekrar tarihi otomatik ayarlanır (ertesi gün, sonra 3, 7, 14, 30, 60 gün). Konu listesi genel bir başlangıç listesidir; istediğini ekleyip silebilirsin.'));

    D.GRUPLAR.forEach(function (grup) {
      var s = D.grupIlerleme(durum.veri, grup);
      kok.appendChild(el('div', { sinif: 'grup-baslik' }, [
        el('h2', { metin: grup }),
        el('span', { sinif: 'alt-yazi', metin: s.bitti + ' / ' + s.toplam + ' konu bitti (%' + s.yuzde + ')' })
      ]));
      var dersler = durum.veri.dersler.filter(function (d) { return d.grup === grup; });
      if (!dersler.length) { kok.appendChild(el('p', { sinif: 'bos', metin: 'Bu grupta ders yok.' })); }
      dersler.forEach(function (d) { kok.appendChild(dersBlogu(d)); });
    });

    kok.appendChild(el('h2', { metin: 'Yeni ders ekle' }));
    var ad = el('input', { type: 'text', placeholder: 'Ders adı', 'aria-label': 'Yeni ders adı', maxlength: '60', 'data-odak': 'yeni-ders' });
    var grupSecimi = el('select', { 'aria-label': 'Ders grubu' }, D.GRUPLAR.map(function (g) { return el('option', { value: g, metin: g }); }));
    kok.appendChild(el('form', {
      sinif: 'ders-formu',
      onsubmit: function (olay) {
        olay.preventDefault();
        if (!ad.value.trim()) { ad.focus(); return; }
        islem(function () {
          var yeni = D.dersEkle(durum.veri, { ad: ad.value, grup: grupSecimi.value });
          durum.acikDersler[yeni.id] = true;
        }, 'yeni-ders');
      }
    }, [ad, grupSecimi, el('button', { type: 'submit', sinif: 'ikincil', metin: 'Ders ekle' })]));
    return kok;
  }

  // ---------- Yedek ----------

  function yedekIndir() {
    var paket = D.disaAktar(durum.veri);
    var blob = new Blob([paket.metin], { type: 'application/json' });
    var adres = URL.createObjectURL(blob);
    var baglanti = el('a', { href: adres, download: paket.dosyaAdi });
    document.body.appendChild(baglanti);
    baglanti.click();
    baglanti.remove();
    setTimeout(function () { URL.revokeObjectURL(adres); }, 5000);
    islem(function () { durum.veri.ayarlar.sonYedek = new Date().toISOString(); });
    uyariGoster('Yedek dosyası indirildi: ' + paket.dosyaAdi + '. İndirilenler klasöründe bulabilirsin. Güvende olması için bir kopyasını USB belleğe veya bulut klasörüne de at.', 'bilgi', 'yedek');
  }

  function yedegiUygula(yeni, bilgiMesaji) {
    islem(function () {
      D.oncekiniSakla(durum.veri);
      durum.veri = yeni;
    });
    uyariGoster(bilgiMesaji, 'bilgi', 'yedek');
  }

  function yedektenYukle(metin) {
    var yeni;
    try {
      yeni = D.iceAktar(metin);
    } catch (hata) {
      uyariGoster('Yedek yüklenemedi: ' + hata.message + ' Mevcut verilerine dokunulmadı.', 'hata', 'yedek');
      return;
    }
    var mesaj = 'Yedekte ' + yeni.gorevler.length + ' görev, ' + yeni.dersler.length + ' ders, ' + yeni.denemeler.length + ' deneme ve ' + yeni.hatalar.length + ' yanlış/boş kaydı var.\n\n' +
      'Şu an uygulamada ' + durum.veri.gorevler.length + ' görev, ' + durum.veri.dersler.length + ' ders, ' + durum.veri.denemeler.length + ' deneme ve ' + durum.veri.hatalar.length + ' yanlış/boş kaydı var. Yedek yüklenirse mevcut verilerin yedeğin içindekilerle DEĞİŞTİRİLİR.\n\n' +
      '(Yine de mevcut verilerin geri alınabilmesi için ayrıca saklanır.)\n\nDevam edilsin mi?';
    if (!window.confirm(mesaj)) { return; }
    yedegiUygula(yeni, 'Yedek yüklendi: ' + yeni.gorevler.length + ' görev, ' + yeni.dersler.length + ' ders.');
  }

  function otoKopyaYukle(tarih) {
    var yeni;
    try {
      yeni = D.otoYedekVerisi(tarih);
    } catch (hata) {
      uyariGoster('Otomatik kopya yüklenemedi: ' + hata.message, 'hata', 'yedek');
      return;
    }
    var mesaj = tarih + ' tarihli otomatik kopya yüklensin mi? Mevcut verilerin bununla DEĞİŞTİRİLİR (mevcut veriler geri alınabilmesi için ayrıca saklanır).';
    if (!window.confirm(mesaj)) { return; }
    yedegiUygula(yeni, 'Otomatik kopya yüklendi: ' + tarih);
  }

  function oncekiniGeriAl() {
    var onceki = D.oncekiVeri();
    if (!onceki) { uyariGoster('Geri alınacak veri bulunamadı.', 'hata', 'yedek'); return; }
    if (!window.confirm('Yedek yüklemeden önceki verilerine dönülsün mü? Şu anki veriler yerine onlar gelir.')) { return; }
    yedegiUygula(onceki, 'Önceki verilerine dönüldü.');
  }

  function verileriSifirla(kalici) {
    var mesaj = 'TÜM VERİLERİN silinecek:\n' + durum.veri.gorevler.length + ' görev, ' + durum.veri.denemeler.length + ' deneme, ' + durum.veri.hatalar.length + ' yanlış/boş kaydı, ' + durum.veri.kaynaklar.length + ' kaynak, rutin, hedefler ve konu ilerlemen.\nDers listesi başlangıç haline dönecek.\n\n' +
      (kalici ? 'Geri dönüş OLMAYACAK.' : 'İstersen sonra "Önceki verilere dön" ile geri alabilirsin.') + '\n\nDevam edilsin mi?';
    if (!window.confirm(mesaj)) { return; }
    if (kalici && !window.confirm('Otomatik kopyalar ve geri al kaydı da silinecek. Bu işlem geri alınamaz. Emin misin?')) { return; }
    var tamam = islem(function () { durum.veri = D.tumVerileriSifirla(durum.veri, kalici); });
    if (tamam) {
      durum.filtre = 'bugun'; durum.acikGorevler = {}; durum.acikDersler = {};
      durum.kaynakDuzenle = null; durum.denemeDuzenle = null; durum.hataDuzenle = null; durum.rutinDuzenle = null;
      durum.hataFiltre = { tur: '', dersId: '', sebep: '' }; durum.sonHata = { tarih: '', tur: 'yanlis', dersId: '', denemeId: '' };
      ciz();
      uyariGoster(kalici ? 'Tüm veriler sıfırlandı. Geri dönüş yok.' : 'Tüm veriler sıfırlandı. İstersen bu sayfadaki "Önceki verilere dön" ile geri alabilirsin.', 'bilgi', 'yedek');
    }
  }

  function yedekGorunumu() {
    var kok = el('div');
    kok.appendChild(sayfaBasligi('Yedek', 'Verilerin bu bilgisayarda, tarayıcının içinde saklanır. Tarayıcı geçmişini/site verilerini silersen veriler de silinir. Bu yüzden düzenli yedek al.'));

    var gun = D.yedekGunu(durum.veri, durum.bugun);
    var sonYedekMetni = gun === null ? 'Henüz yedek almadın.' : (gun === 0 ? 'Son yedek: bugün.' : 'Son yedek: ' + gun + ' gün önce.');

    kok.appendChild(el('div', { sinif: 'yedek-blok' }, [
      el('h3', { metin: 'Yedek al' }),
      el('p', { metin: 'Görevlerini, konu ilerlemeni, kaynaklarını, denemelerini, yanlış defterini ve hedeflerini tek bir dosya olarak indirir.' }),
      el('div', { sinif: 'yedek-satir' }, [
        el('button', { type: 'button', sinif: 'birincil', id: 'yedek-indir', metin: 'Yedeği indir', onclick: yedekIndir }),
        el('span', { sinif: 'alt-yazi', metin: sonYedekMetni })
      ])
    ]));

    var dosya = el('input', {
      type: 'file', accept: '.json,application/json', id: 'yedek-dosya', 'aria-label': 'Yedek dosyası seç',
      onchange: function () {
        var secilen = dosya.files[0];
        if (!secilen) { return; }
        var okuyucu = new FileReader();
        okuyucu.onload = function () { yedektenYukle(String(okuyucu.result)); dosya.value = ''; };
        okuyucu.onerror = function () { uyariGoster('Dosya okunamadı.', 'hata', 'yedek'); };
        okuyucu.readAsText(secilen);
      }
    });
    kok.appendChild(el('div', { sinif: 'yedek-blok' }, [
      el('h3', { metin: 'Yedekten geri yükle' }),
      el('p', { metin: 'Daha önce indirdiğin yedek dosyasını (.json) seç. Eski sürümden alınmış yedekler de yüklenir. Yüklemeden önce sana sorulur.' }),
      el('div', { sinif: 'yedek-satir' }, [dosya])
    ]));

    var onceki = D.oncekiVeri();
    if (onceki) {
      kok.appendChild(el('div', { sinif: 'yedek-blok' }, [
        el('h3', { metin: 'Son geri yüklemeyi geri al' }),
        el('p', { metin: 'Yedek yüklemeden hemen önceki verilerin saklandı (' + onceki.gorevler.length + ' görev, ' + onceki.dersler.length + ' ders).' }),
        el('div', { sinif: 'yedek-satir' }, [el('button', { type: 'button', sinif: 'ikincil', id: 'onceki-geri-al', metin: 'Önceki verilere dön', onclick: oncekiniGeriAl })])
      ]));
    }

    var oto = D.otoYedekler();
    var otoBlok = el('div', { sinif: 'yedek-blok' }, [
      el('h3', { metin: 'Otomatik günlük kopyalar' }),
      el('p', { metin: 'Uygulama, her günün ilk değişikliğinden önceki durumu son 7 gün için kendiliğinden saklar. Yanlışlıkla bir şey sildiysen buradan dönebilirsin. Bu kopyalar da tarayıcının içinde durur, bu yüzden indirdiğin yedeğin yerini tutmaz.' })
    ]);
    if (!oto.length) {
      otoBlok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz otomatik kopya yok. İlk değişikliğinden sonra oluşur.' }));
    } else {
      otoBlok.appendChild(el('ul', { sinif: 'oto-liste' }, oto.map(function (k) {
        return el('li', null, [
          el('span', { metin: k.tarih + ' — ' + k.gorevSayisi + ' görev' }),
          el('button', { type: 'button', sinif: 'ikincil', 'data-oto-tarih': k.tarih, metin: 'Bu kopyayı yükle', onclick: function () { otoKopyaYukle(k.tarih); } })
        ]);
      })));
    }
    kok.appendChild(otoBlok);

    var kaliciSil = el('input', { type: 'checkbox', id: 'sifirla-kalici' });
    kok.appendChild(el('div', { sinif: 'yedek-blok tehlike-blok', id: 'sifirla-blogu' }, [
      el('h3', { metin: 'Verileri sıfırla' }),
      el('p', { metin: 'Görevlerini, konu ilerlemeni, kaynaklarını, denemelerini, yanlış defterini, hedeflerini, rutinini ve gün sonu değerlendirmelerini siler; ders listesi başlangıç haline döner. Test için girdiğin verileri temizlemek istediğinde kullan. Önce bir yedek indirmeni öneririm.' }),
      el('label', { sinif: 'onay-satiri' }, [kaliciSil, el('span', { metin: 'Otomatik günlük kopyaları ve "geri al" kaydını da kalıcı olarak sil (bu seçilirse geri dönüş olmaz)' })]),
      el('div', { sinif: 'yedek-satir' }, [el('button', { type: 'button', sinif: 'ikincil tehlike', id: 'sifirla-dugme', metin: 'Tüm verileri sıfırla', onclick: function () { verileriSifirla(kaliciSil.checked); } })])
    ]));

    if (durum.kalici === true) {
      kok.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Tarayıcı bu verileri kalıcı saklama listesine aldı.' }));
    }
    return kok;
  }

  gorunumler.bugun = bugunGorunumu;
  gorunumler.gorevler = gorevlerGorunumu;
  gorunumler.dersler = derslerGorunumu;
  gorunumler.yedek = yedekGorunumu;

  // ---------- Başlatma ----------

  function baslat() {
    var sonuc = D.yukle();
    durum.veri = sonuc.veri;

    document.querySelectorAll('.menu-dugme').forEach(function (d) {
      d.addEventListener('click', function () { gorunumeGit(d.getAttribute('data-gorunum')); });
    });
    duzenlePenceresiniHazirla();

    if (sonuc.uyari) { uyariGoster(sonuc.uyari, 'hata', 'yukleme'); }
    if (sonuc.kaydedilemez) { kayitDurumuYaz(false, 'Kayıt kapalı!'); }
    else { document.getElementById('kayit-durumu').textContent = 'Otomatik kayıt açık'; }

    ciz();

    // Başka bir sekmede değişiklik yapılırsa, onun üzerine yazmamak için yeniden yükle.
    window.addEventListener('storage', function (olay) {
      if (olay.key === D.ANAHTAR) {
        var s = D.yukle();
        durum.veri = s.veri;
        ciz();
        uyariGoster('Veriler başka bir pencerede değişti, ekran güncellendi. Uygulamayı tek pencerede kullanman önerilir.', 'uyari', 'baska-sekme');
      }
    });

    // Gece yarısı geçince "bugün" değişir.
    setInterval(function () { if (D.bugunStr() !== durum.bugun) { ciz(); } }, 60000);

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(function (v) { durum.kalici = v; }).catch(function () { durum.kalici = null; });
    }
  }

  window.YKSArayuz = {
    durum: durum,
    el: el,
    alan: alan,
    islem: islem,
    uyariGoster: uyariGoster,
    uyariSil: uyariSil,
    hataGoster: hataGoster,
    ilerlemeCubugu: ilerlemeCubugu,
    dersSecenekleri: dersSecenekleri,
    sayfaBasligi: sayfaBasligi,
    oncelikSecimi: oncelikSecimi,
    ciz: ciz,
    gorunumeGit: gorunumeGit,
    gorunumler: gorunumler,
    baslat: baslat
  };
})();
