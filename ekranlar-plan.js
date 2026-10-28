/*
 * ekranlar-plan.js — Aşama 3 ekranları: Plan, Rapor, Rutin.
 * Ortak yardımcılar uygulama.js içindeki window.YKSArayuz üzerinden gelir.
 */
(function () {
  'use strict';

  var U = window.YKSArayuz;
  var D = window.YKSDepo;
  var A = window.YKSAnaliz;
  var P = window.YKSPlanlayici;
  var R = window.YKSRapor;
  var G = window.YKSGrafik;
  var el = U.el, alan = U.alan, islem = U.islem, durum = U.durum;

  var GUN_SIRASI = [1, 2, 3, 4, 5, 6, 0];            // Pazartesi'den başlar
  var GUN_KISA = { 0: 'Paz', 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt' };
  var PUAN_ETIKETLERI = ['Seçilmedi', '1 - Çok kötü', '2 - Kötü', '3 - İdare eder', '4 - İyi', '5 - Çok iyi'];

  function giris(ozellikler, deger) {
    var e = el('input', ozellikler);
    if (deger !== undefined && deger !== null) { e.value = deger; }
    return e;
  }

  function simdiDakika() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function aralikMetni(bas, bit) { return A.saateCevir(bas) + '-' + A.saateCevir(bit); }

  // ======================= PLAN =======================

  var TUR_ETIKETLERI = {
    sabit: 'Planlı görev',
    gorev: 'Göreve saat verilecek',
    oneri: 'Önerilen konu',
    mesgul: 'Meşgul'
  };

  function programSatiri(o) {
    var sinif = 'program-satir program-' + o.tur;
    var baslik = o.baslik;
    var alt = '';
    if (o.tur === 'oneri') { alt = o.dersAdi + ', ' + o.neden; }
    var etiketler = [el('span', { sinif: 'etiket program-etiket-' + o.tur, metin: TUR_ETIKETLERI[o.tur] })];
    if (o.gecikti) { etiketler.push(el('span', { sinif: 'etiket gecikti', metin: 'Gecikmiş görev' })); }
    if (o.oncelik === 3) { etiketler.push(el('span', { sinif: 'etiket yuksek', metin: 'Yüksek öncelik' })); }
    return el('li', { sinif: sinif, 'data-tur': o.tur }, [
      el('span', { sinif: 'program-saat', metin: aralikMetni(o.bas, o.bit) }),
      el('div', { sinif: 'program-icerik' }, [
        el('div', { sinif: 'program-baslik' }, [el('span', { sinif: 'program-ad', metin: baslik })].concat(etiketler)),
        alt ? el('div', { sinif: 'alt-yazi program-neden', metin: alt }) : null
      ])
    ]);
  }

  function planBolumu(tarih) {
    var plan = P.gunlukPlan(durum.veri, tarih, durum.bugun, simdiDakika());
    var kap = el('div', { sinif: 'plan-bolumu' });
    if (!plan.pencereVar) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Bu gün için tanımlı çalışma saati yok. Rutin sayfasından bu güne çalışma penceresi ekleyebilirsin.' }));
      return kap;
    }
    var ozet = 'Planlanan: ' + (A.sureMetni(plan.planlananDk) || '0 dk') + '. Günlük hedef: ' + (A.sureMetni(plan.hedefDk) || '0 dk') + '.';
    if (plan.yapilanDk) { ozet += ' Bugün yapılan: ' + A.sureMetni(plan.yapilanDk) + '.'; }
    kap.appendChild(el('p', { sinif: 'alt-yazi plan-ozet', metin: ozet }));

    var satirlar = plan.ogeler.map(function (o) { return { bas: o.bas, nesne: programSatiri(o) }; });
    plan.mesgul.forEach(function (m) {
      satirlar.push({ bas: m.bas, nesne: programSatiri({ tur: 'mesgul', bas: m.bas, bit: m.bit, baslik: m.ad }) });
    });
    satirlar.sort(function (a, b) { return a.bas - b.bas; });
    if (!satirlar.length) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Bu gün için yerleştirilecek bir şey yok. Serbest zaman: ' + (A.sureMetni(plan.serbestDk) || '0 dk') + '.' }));
    } else {
      kap.appendChild(el('ul', { sinif: 'program-listesi' }, satirlar.map(function (x) { return x.nesne; })));
    }

    if (plan.sigmayanlar.length) {
      kap.appendChild(el('div', { sinif: 'hatirlatma', 'data-bolum': 'sigmayan' }, [
        el('strong', { metin: 'Boş zamana sığmayan görevler: ' }),
        el('span', { metin: plan.sigmayanlar.map(function (s) { return s.baslik + ' (' + A.sureMetni(s.sure) + ')'; }).join(', ') + '. Süreyi kısaltmayı, görevi bölmeyi veya Rutin sayfasına çalışma saati eklemeyi dene.' })
      ]));
    }

    var uygulanacak = plan.ogeler.filter(function (o) { return o.tur === 'gorev' || o.tur === 'oneri'; });
    if (uygulanacak.length) {
      kap.appendChild(el('div', { sinif: 'form-satir' }, [
        el('button', {
          type: 'button', sinif: 'birincil', id: 'plani-uygula', metin: 'Programı uygula',
          onclick: function () {
            var sonuc = null;
            if (islem(function () { sonuc = P.planiUygula(durum.veri, plan); })) {
              U.uyariGoster(sonuc.guncellenen + ' göreve saat verildi, ' + sonuc.eklenen + ' önerilen konu göreve eklendi. Görevler sayfasından düzenleyebilirsin.', 'bilgi', 'plan');
            }
          }
        }),
        el('span', { sinif: 'alt-yazi', metin: 'Uygulayınca görevlere saat verilir ve önerilen konular görev olarak eklenir. İstediğini sonra silebilir veya düzenleyebilirsin.' })
      ]));
    }
    return kap;
  }

  function yenidenPlanBolumu() {
    var kap = el('div', { sinif: 'yeniden-plan', id: 'yeniden-plan' });
    kap.appendChild(el('h2', { metin: 'Geciken görevleri yeniden planla' }));
    var s = P.yenidenPlanla(durum.veri, durum.bugun, simdiDakika(), 7);
    if (!s.gecikenSayisi) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Geciken görevin yok.' }));
      return kap;
    }
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: s.gecikenSayisi + ' geciken görev var. Önümüzdeki 7 günün boş çalışma saatlerine öncelik sırasıyla dağıtılır (yüksek öncelik ve eski görev önce).' }));
    if (s.hata) {
      kap.appendChild(el('div', { sinif: 'hatirlatma' }, [
        el('span', { metin: s.hata + ' ' }),
        el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Rutin sayfasına git', onclick: function () { U.gorunumeGit('rutin'); } })
      ]));
      return kap;
    }
    if (s.oneriler.length) {
      kap.appendChild(el('ul', { sinif: 'oneri-listesi' }, s.oneriler.map(function (o) {
        return el('li', { sinif: 'yeniden-satir', 'data-gorev-id': o.gorevId }, [
          el('span', { sinif: 'program-ad', metin: o.baslik }),
          el('span', { sinif: 'alt-yazi', metin: D.kisaTarih(o.eskiTarih, durum.bugun) + ' yerine ' + D.tarihEtiketi(o.yeniTarih, durum.bugun) + ' ' + o.yeniSaat + ' (' + A.sureMetni(o.sure) + ')' })
        ]);
      })));
      kap.appendChild(el('div', { sinif: 'form-satir' }, [
        el('button', {
          type: 'button', sinif: 'birincil', id: 'yeniden-uygula', metin: 'Önerilen düzeni uygula',
          onclick: function () {
            var n = 0;
            if (islem(function () { n = P.yenidenPlanlaUygula(durum.veri, s); })) {
              U.uyariGoster(n + ' görevin tarihi ve saati güncellendi.', 'bilgi', 'plan');
            }
          }
        })
      ]));
    }
    if (s.sigmayanlar.length) {
      kap.appendChild(el('div', { sinif: 'hatirlatma', 'data-bolum': 'yeniden-sigmayan' }, [
        el('strong', { metin: 'Önümüzdeki 7 günde sığmayanlar: ' }),
        el('span', { metin: s.sigmayanlar.map(function (x) { return x.baslik + ' (' + A.sureMetni(x.sure) + ')'; }).join(', ') + '. Süreyi kısaltmak veya rutine çalışma saati eklemek işe yarar.' })
      ]));
    }
    return kap;
  }

  function oncelikBolumu(tarih) {
    var kap = el('div', { sinif: 'oncelik-bolumu' });
    kap.appendChild(el('h2', { metin: 'Önerilen konular' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Konu durumu, seviyen, yanlış kayıtların, tekrar tarihi ve dersin hedefe uzaklığına göre puanlanır. Zaten göreve eklediğin konular listelenmez.' }));
    var liste = P.konuOnceligi(durum.veri, durum.bugun, { limit: 10 });
    if (!liste.length) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Şu an önerilecek konu yok.' }));
      return kap;
    }
    kap.appendChild(el('ul', { sinif: 'oneri-listesi' }, liste.map(function (k) {
      return el('li', { sinif: 'yeniden-satir', 'data-konu-id': k.konuId }, [
        el('div', { sinif: 'program-icerik' }, [
          el('span', { sinif: 'program-ad', metin: k.konuAdi }),
          el('div', { sinif: 'alt-yazi', metin: k.dersAdi + ', ' + k.neden })
        ]),
        el('button', {
          type: 'button', sinif: 'ikincil kucuk', metin: 'Göreve ekle', 'aria-label': 'Göreve ekle: ' + k.konuAdi,
          onclick: function () {
            islem(function () {
              D.gorevEkle(durum.veri, { baslik: 'Çalış: ' + k.konuAdi, tarih: tarih, sureDk: durum.veri.rutin.blokDk, dersId: k.dersId, konuId: k.konuId, notlar: k.neden });
            });
          }
        })
      ]);
    })));
    return kap;
  }

  function planGorunumu() {
    var tarih = durum.planTarihi || durum.bugun;
    if (tarih < durum.bugun) { tarih = durum.bugun; }
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Plan', 'Rutinindeki boş çalışma saatlerine, görevlerini önceliğe göre ve önerilen konuları yerleştirir. Önce önizlersin, beğenirsen uygularsın.'));

    if (!P.rutinVarMi(durum.veri)) {
      kok.appendChild(el('div', { sinif: 'hatirlatma' }, [
        el('span', { metin: 'Plan oluşturmak için önce çalışma saatlerini tanımlaman gerekiyor. ' }),
        el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Rutin sayfasına git', onclick: function () { U.gorunumeGit('rutin'); } })
      ]));
    }

    var tarihGirdisi = giris({ type: 'date', min: durum.bugun, 'aria-label': 'Plan tarihi', onchange: function () { durum.planTarihi = tarihGirdisi.value || ''; U.ciz(); } }, tarih);
    kok.appendChild(el('div', { sinif: 'plan-tarih-satiri' }, [
      el('button', { type: 'button', sinif: 'filtre' + (tarih === durum.bugun ? ' aktif' : ''), metin: 'Bugün', onclick: function () { durum.planTarihi = ''; U.ciz(); } }),
      el('button', { type: 'button', sinif: 'filtre' + (tarih === D.tarihEkle(durum.bugun, 1) ? ' aktif' : ''), metin: 'Yarın', onclick: function () { durum.planTarihi = D.tarihEkle(durum.bugun, 1); U.ciz(); } }),
      tarihGirdisi,
      el('span', { sinif: 'alt-yazi', metin: D.uzunTarih(tarih).gunAy + ', ' + D.uzunTarih(tarih).gunYil })
    ]));

    kok.appendChild(el('h2', { metin: 'Günün programı' }));
    kok.appendChild(planBolumu(tarih));
    kok.appendChild(yenidenPlanBolumu());
    kok.appendChild(oncelikBolumu(tarih));
    return kok;
  }

  // ======================= RAPOR =======================

  function raporSatiri(ad, deger) {
    return el('li', {}, [el('span', { sinif: 'alt-yazi', metin: ad }), el('strong', { metin: deger })]);
  }

  function gunSonuBolumu(tarih) {
    var r = R.gunlukRapor(durum.veri, tarih);
    var kap = el('div', { sinif: 'gun-sonu', 'data-bolum': 'gun-sonu' });
    kap.appendChild(el('h2', { metin: 'Gün sonu raporu' }));

    var satirlar = [
      raporSatiri('Tamamlanan görev', r.tamamlananSayisi + (r.tamamlananDk ? ' (' + A.sureMetni(r.tamamlananDk) + ')' : '')),
      raporSatiri('O güne planlanan görevlerden tamamlanan', r.planliSayisi ? r.planliTamam + ' / ' + r.planliSayisi : 'Planlanan görev yok'),
      raporSatiri('Çalışma hedefi', r.hedefDk ? A.sureMetni(r.tamamlananDk || 0) + (r.tamamlananDk ? '' : '0 dk') + ' / ' + A.sureMetni(r.hedefDk) + ' (%' + r.hedefOrani + ')' : 'Tanımlı değil'),
      raporSatiri('Geciken görev', String(r.gecikenSayisi)),
      raporSatiri('Yanlış/boş kaydı', String(r.hatalar))
    ];
    if (r.denemeler.length) { satirlar.push(raporSatiri('Girilen deneme', r.denemeler.map(function (d) { return (d.ad || d.tur) + ': ' + A.netMetni(A.denemeToplami(d).net) + ' net'; }).join(', '))); }
    if (r.konular.length) { satirlar.push(raporSatiri('Çalışılan konular', r.konular.map(function (k) { return k.konuAdi; }).join(', '))); }
    kap.appendChild(el('ul', { sinif: 'rapor-listesi' }, satirlar));

    if (r.kalanGorevler.length) {
      kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Yapılmayan görevler: ' + r.kalanGorevler.map(function (g) { return g.baslik; }).join(', ') + '.' }));
    }

    var d = r.degerlendirme || { puan: 0, notlar: '', odak: '' };
    var puan = el('select', { 'aria-label': 'Günü puanla' }, PUAN_ETIKETLERI.map(function (e, i) { return el('option', { value: String(i), metin: e }); }));
    puan.value = String(d.puan);
    var not = el('textarea', { rows: '3', maxlength: '1000', 'aria-label': 'Gün notu', placeholder: 'Bugün nasıl geçti? Neler iyi gitti, neler aksadı?' });
    not.value = d.notlar;
    var odak = giris({ type: 'text', maxlength: '300', 'aria-label': 'Ertesi günün odak noktası', placeholder: 'örn. Türev: 30 soru + yanlışları gözden geçir' }, d.odak);
    kap.appendChild(el('form', {
      sinif: 'kayit-formu', 'data-form': 'gun-sonu',
      onsubmit: function (olay) {
        olay.preventDefault();
        var tamam = islem(function () { D.gunlukKaydet(durum.veri, tarih, { puan: puan.value, notlar: not.value, odak: odak.value }); });
        if (tamam) { U.uyariGoster('Değerlendirmen kaydedildi.', 'bilgi', 'rapor'); }
      }
    }, [
      el('h3', { metin: 'Günü değerlendir' }),
      el('div', { sinif: 'form-satir' }, [alan('Bu günü puanla', puan, 'dar'), alan('Ertesi günün odak noktası', odak, 'genis')]),
      alan('Gün notu', not, 'genis'),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: 'Değerlendirmeyi kaydet' }), el('span', { sinif: 'alt-yazi', metin: 'Odak noktası ertesi gün Bugün ekranında görünür.' })])
    ]));
    return kap;
  }

  function haftalikBolum() {
    var h = R.haftalikRapor(durum.veri, durum.bugun);
    var kap = el('div', { sinif: 'haftalik', 'data-bolum': 'haftalik' });
    kap.appendChild(el('h2', { metin: 'Haftalık analiz (son 7 gün)' }));
    var gunlukOrtHedef = Math.round(h.hedefToplamDk / 7);
    kap.appendChild(el('div', { sinif: 'grafik-bolumu', 'data-grafik': 'hafta' }, [
      el('h3', { metin: 'Günlük çalışma süresi (dakika)' }),
      G.cubukGrafigi(h.gunler.map(function (g) {
        return { etiket: g.gunAdi, deger: g.tamamlananDk, ipucu: D.kisaTarih(g.tarih, durum.bugun) + ': ' + (A.sureMetni(g.tamamlananDk) || '0 dk') };
      }), { hedef: gunlukOrtHedef || null, birim: 'dk', aciklama: 'Son 7 günün çalışma süresi grafiği' }),
      el('p', { sinif: 'alt-yazi', metin: 'Çalışma süresi, tamamladığın görevlerin süresinden hesaplanır. Süre girmediğin görev grafiğe yansımaz.' })
    ]));

    var ozet = [
      raporSatiri('Toplam çalışma', A.sureMetni(h.toplamDk) || '0 dk'),
      raporSatiri('Hedefe oran', h.hedefOrani === null ? 'Hedef yok' : '%' + h.hedefOrani + ' (' + A.sureMetni(h.hedefToplamDk) + ' hedef)'),
      raporSatiri('Tamamlanan görev', String(h.tamamlananSayisi)),
      raporSatiri('Tarihli görevlerin tamamlanma oranı', h.tamamlanmaOrani === null ? 'Tarihli görev yok' : '%' + h.tamamlanmaOrani + ' (' + h.planliTamam + ' / ' + h.planliSayisi + ')'),
      raporSatiri('Geciken görev', String(h.gecikenSayisi)),
      raporSatiri('Tekrarı geciken konu', String(h.tekrarGeciken)),
      raporSatiri('Yanlış/boş kaydı', String(h.hataSayisi)),
      raporSatiri('Girilen deneme', String(h.denemeSayisi)),
      raporSatiri('Ortalama gün puanı', h.ortalamaPuan === null ? 'Değerlendirme yok' : String(h.ortalamaPuan).replace('.', ',') + ' / 5')
    ];
    kap.appendChild(el('ul', { sinif: 'rapor-listesi' }, ozet));

    kap.appendChild(el('h3', { metin: 'Kişisel öneriler' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Bu öneriler kayıtlarına bakan basit kurallarla üretilir (yapay zekâ değildir). Her önerinin nedeni yanında yazar.' }));
    kap.appendChild(el('ul', { sinif: 'oneri-metinleri' }, R.oneriler(durum.veri, durum.bugun, h).map(function (o) {
      return el('li', { sinif: 'oneri-maddesi' }, [el('strong', { metin: o.baslik }), el('p', { metin: o.metin })]);
    })));
    return kap;
  }

  function raporGorunumu() {
    var tarih = durum.raporTarihi || durum.bugun;
    if (tarih > durum.bugun) { tarih = durum.bugun; }
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Rapor', 'Gün sonunda günü değerlendir, ertesi günün odağını yaz ve son 7 günün analizine bak.'));
    var girdi = giris({ type: 'date', max: durum.bugun, 'aria-label': 'Rapor tarihi', onchange: function () { durum.raporTarihi = girdi.value || ''; U.ciz(); } }, tarih);
    kok.appendChild(el('div', { sinif: 'plan-tarih-satiri' }, [
      el('button', { type: 'button', sinif: 'filtre' + (tarih === durum.bugun ? ' aktif' : ''), metin: 'Bugün', onclick: function () { durum.raporTarihi = ''; U.ciz(); } }),
      el('button', { type: 'button', sinif: 'filtre' + (tarih === D.tarihEkle(durum.bugun, -1) ? ' aktif' : ''), metin: 'Dün', onclick: function () { durum.raporTarihi = D.tarihEkle(durum.bugun, -1); U.ciz(); } }),
      girdi,
      el('span', { sinif: 'alt-yazi', metin: D.uzunTarih(tarih).gunAy + ', ' + D.uzunTarih(tarih).gunYil })
    ]));
    kok.appendChild(gunSonuBolumu(tarih));
    kok.appendChild(haftalikBolum());
    return kok;
  }

  // ======================= RUTİN =======================

  function blokSatiri(b) {
    return el('li', { sinif: 'blok', 'data-blok-id': b.id }, [
      el('div', { sinif: 'blok-bilgi' }, [
        el('span', { sinif: 'kaynak-ad', metin: b.ad }),
        el('span', { sinif: 'etiket ' + (b.tur === 'calisma' ? 'bugun' : ''), metin: b.tur === 'calisma' ? 'Çalışma' : 'Meşgul' }),
        el('span', { sinif: 'alt-yazi', metin: GUN_SIRASI.filter(function (g) { return b.gunler.indexOf(g) >= 0; }).map(function (g) { return GUN_KISA[g]; }).join(' ') + ', ' + b.bas + '-' + b.bit })
      ]),
      el('div', { sinif: 'kaynak-islemler' }, [
        el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Düzenle', 'aria-label': 'Bloğu düzenle: ' + b.ad, onclick: function () { durum.rutinDuzenle = b.id; U.ciz(); } }),
        el('button', {
          type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Bloğu sil: ' + b.ad,
          onclick: function () { if (window.confirm('"' + b.ad + '" bloğu silinsin mi?')) { islem(function () { D.rutinBlokSil(durum.veri, b.id); }); } }
        })
      ])
    ]);
  }

  function blokFormu(b) {
    var duzenleme = !!b;
    var v = b || { ad: '', tur: 'calisma', gunler: [1, 2, 3, 4, 5], bas: '', bit: '' };
    var ad = giris({ type: 'text', maxlength: '60', placeholder: 'örn. Akşam çalışması, Okul, Yemek', 'aria-label': 'Blok adı', 'data-odak': 'blok-ad' }, v.ad);
    var tur = el('select', { 'aria-label': 'Blok türü' }, [el('option', { value: 'calisma', metin: 'Çalışma penceresi' }), el('option', { value: 'mesgul', metin: 'Meşgul (okul, yemek, uyku...)' })]);
    tur.value = v.tur;
    var bas = giris({ type: 'time', 'aria-label': 'Başlangıç saati' }, v.bas);
    var bit = giris({ type: 'time', 'aria-label': 'Bitiş saati' }, v.bit);
    var kutular = {};
    var gunKap = el('div', { sinif: 'gun-secimi', role: 'group', 'aria-label': 'Günler' });
    GUN_SIRASI.forEach(function (g) {
      var kutu = el('input', { type: 'checkbox', 'data-gun': String(g), 'aria-label': GUN_KISA[g] });
      kutu.checked = v.gunler.indexOf(g) >= 0;
      kutular[g] = kutu;
      gunKap.appendChild(el('label', { sinif: 'gun-kutusu' }, [kutu, el('span', { metin: GUN_KISA[g] })]));
    });
    function sec(liste) { GUN_SIRASI.forEach(function (g) { kutular[g].checked = liste.indexOf(g) >= 0; }); }
    var hizli = el('div', { sinif: 'hizli-gun' }, [
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Hafta içi', onclick: function () { sec([1, 2, 3, 4, 5]); } }),
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Hafta sonu', onclick: function () { sec([6, 0]); } }),
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Her gün', onclick: function () { sec([0, 1, 2, 3, 4, 5, 6]); } })
    ]);
    var dugmeler = [el('button', { type: 'submit', sinif: 'birincil', metin: duzenleme ? 'Değişiklikleri kaydet' : 'Blok ekle' })];
    if (duzenleme) { dugmeler.push(el('button', { type: 'button', sinif: 'ikincil', metin: 'Vazgeç', onclick: function () { durum.rutinDuzenle = null; U.ciz(); } })); }

    return el('form', {
      sinif: 'kayit-formu', 'data-form': 'blok',
      onsubmit: function (olay) {
        olay.preventDefault();
        var secenek = { ad: ad.value, tur: tur.value, gunler: GUN_SIRASI.filter(function (g) { return kutular[g].checked; }), bas: bas.value, bit: bit.value };
        islem(function () {
          if (duzenleme) { D.rutinBlokGuncelle(durum.veri, b.id, secenek); } else { D.rutinBlokEkle(durum.veri, secenek); }
          durum.rutinDuzenle = null;
        }, 'blok-ad');
      }
    }, [
      el('h3', { metin: duzenleme ? 'Bloğu düzenle' : 'Yeni blok' }),
      el('div', { sinif: 'form-satir' }, [alan('Ad', ad, 'genis'), alan('Tür', tur)]),
      el('div', { sinif: 'form-satir' }, [alan('Başlangıç', bas, 'dar'), alan('Bitiş', bit, 'dar')]),
      el('div', {}, [el('span', { sinif: 'alan-baslik', metin: 'Günler' }), gunKap, hizli]),
      el('div', { sinif: 'form-satir' }, dugmeler)
    ]);
  }

  function ornekRutinEkle() {
    var ornek = [
      { ad: 'Okul / dershane', tur: 'mesgul', gunler: [1, 2, 3, 4, 5], bas: '08:00', bit: '16:00' },
      { ad: 'Akşam çalışması 1', tur: 'calisma', gunler: [1, 2, 3, 4, 5], bas: '17:00', bit: '19:00' },
      { ad: 'Akşam çalışması 2', tur: 'calisma', gunler: [1, 2, 3, 4, 5], bas: '20:00', bit: '22:00' },
      { ad: 'Hafta sonu sabah', tur: 'calisma', gunler: [6, 0], bas: '09:00', bit: '12:00' },
      { ad: 'Hafta sonu öğleden sonra', tur: 'calisma', gunler: [6, 0], bas: '14:00', bit: '18:00' }
    ];
    islem(function () { ornek.forEach(function (b) { D.rutinBlokEkle(durum.veri, b); }); });
  }

  function rutinGorunumu() {
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Rutin', 'Haftalık düzenini tanımla. "Çalışma penceresi" çalışabileceğin saatlerdir; Plan sayfası görevleri ve önerilen konuları bunlara yerleştirir. "Meşgul" bloklar (okul, yemek, uyku) çalışma saatlerinden düşülür.'));

    var r = durum.veri.rutin;
    var hedef = giris({ type: 'number', min: '0', max: '1440', step: '1', inputmode: 'numeric', 'aria-label': 'Günlük çalışma hedefi (dakika)' }, r.gunlukHedefDk ? String(r.gunlukHedefDk) : '');
    var blok = giris({ type: 'number', min: '15', max: '180', step: '1', inputmode: 'numeric', 'aria-label': 'Çalışma bloğu süresi (dakika)' }, String(r.blokDk));
    var mola = giris({ type: 'number', min: '0', max: '60', step: '1', inputmode: 'numeric', 'aria-label': 'Mola süresi (dakika)' }, String(r.molaDk));
    var varsayilan = giris({ type: 'number', min: '5', max: '240', step: '1', inputmode: 'numeric', 'aria-label': 'Varsayılan görev süresi (dakika)' }, String(r.varsayilanSureDk));
    kok.appendChild(el('form', {
      sinif: 'kayit-formu', 'data-form': 'rutin-ayar',
      onsubmit: function (olay) {
        olay.preventDefault();
        var tamam = islem(function () { D.rutinAyarlariKaydet(durum.veri, { gunlukHedefDk: hedef.value, blokDk: blok.value, molaDk: mola.value, varsayilanSureDk: varsayilan.value }); });
        if (tamam) { U.uyariGoster('Rutin ayarları kaydedildi.', 'bilgi', 'rutin'); }
      }
    }, [
      el('h3', { metin: 'Plan ayarları' }),
      el('div', { sinif: 'form-satir' }, [
        alan('Günlük çalışma hedefi (dk)', hedef), alan('Konu bloğu süresi (dk)', blok, 'dar'), alan('Mola (dk)', mola, 'dar'), alan('Varsayılan görev süresi (dk)', varsayilan)
      ]),
      el('p', { sinif: 'alt-yazi', metin: 'Günlük hedefi boş bırakırsan o günün çalışma pencerelerinin toplamı hedef sayılır. Süresi girilmemiş görevler "varsayılan görev süresi" kadar yer kaplar.' }),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: 'Ayarları kaydet' })])
    ]));

    var duzenlenen = null;
    if (durum.rutinDuzenle) {
      r.bloklar.forEach(function (b) { if (b.id === durum.rutinDuzenle) { duzenlenen = b; } });
      if (!duzenlenen) { durum.rutinDuzenle = null; }
    }
    kok.appendChild(el('h2', { metin: 'Çalışma ve meşgul saatleri' }));
    kok.appendChild(blokFormu(duzenlenen));

    if (!r.bloklar.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz blok eklemedin.' }));
      kok.appendChild(el('div', { sinif: 'form-satir' }, [
        el('button', { type: 'button', sinif: 'ikincil', id: 'ornek-rutin', metin: 'Örnek rutin ekle', onclick: ornekRutinEkle }),
        el('span', { sinif: 'alt-yazi', metin: 'Örnek bir hafta içi/hafta sonu düzeni ekler; kendi saatlerine göre düzenleyip silebilirsin.' })
      ]));
    } else {
      var sirali = r.bloklar.slice().sort(function (a, b) { return (a.tur === b.tur ? 0 : (a.tur === 'calisma' ? -1 : 1)) || (a.bas < b.bas ? -1 : (a.bas > b.bas ? 1 : 0)); });
      kok.appendChild(el('ul', { sinif: 'blok-listesi' }, sirali.map(blokSatiri)));
    }

    // Tekrarlanan Rutinler (Paragraf, Problem, Geometri, Özel)
    kok.appendChild(el('h2', { metin: 'Tekrarlanan Rutinler (Paragraf, Problem, Geometri ve Özel)' }));
    kok.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Her gün veya seçtiğin günlerde tekrarlanan rutinler. Konu planından bağımsız yönetilir, günlük listede görünür ve geçmiş kayıtların bozulmaz.' }));

    var tekrarlananDuzenlenen = null;
    if (durum.tekrarlananRutinDuzenle) {
      (durum.veri.tekrarlananRutinler || []).forEach(function (tr) {
        if (tr.id === durum.tekrarlananRutinDuzenle) { tekrarlananDuzenlenen = tr; }
      });
      if (!tekrarlananDuzenlenen) { durum.tekrarlananRutinDuzenle = null; }
    }
    kok.appendChild(tekrarlananRutinFormu(tekrarlananDuzenlenen));

    var rutinler = durum.veri.tekrarlananRutinler || [];
    if (!rutinler.length) {
      kok.appendChild(el('p', { sinif: 'bos', metin: 'Henüz tekrarlanan rutin tanımlanmadı.' }));
      kok.appendChild(el('div', { sinif: 'form-satir' }, [
        el('button', {
          type: 'button', sinif: 'ikincil', metin: 'Varsayılan rutinleri yükle (Paragraf, Problem, Geometri)',
          onclick: function () {
            islem(function () {
              D.varsayilanRutinler().forEach(function (vr) { D.tekrarlananRutinEkle(durum.veri, vr); });
            });
          }
        })
      ]));
    } else {
      kok.appendChild(el('ul', { sinif: 'blok-listesi tekrarlanan-rutin-listesi' }, rutinler.map(tekrarlananRutinSatiri)));
    }

    return kok;
  }

  function tekrarlananRutinSatiri(r) {
    var turMetni = D.RUTIN_TURLERI[r.tur] || r.tur;
    var hedefBirim = r.hedefTuru === 'soru' ? 'soru' : 'dk';
    var gunlerMetni = GUN_SIRASI.filter(function (g) { return (r.gunler || []).indexOf(g) >= 0; }).map(function (g) { return GUN_KISA[g]; }).join(' ') || 'Her gün';
    var tarihMetni = r.baslangic ? D.kisaTarih(r.baslangic, durum.bugun) + ' başlangıç' : '';
    if (r.bitis) { tarihMetni += ' (bitiş: ' + D.kisaTarih(r.bitis, durum.bugun) + ')'; }

    return el('li', { sinif: 'blok tekrarlanan-rutin-satir', 'data-rutin-id': r.id }, [
      el('div', { sinif: 'blok-bilgi' }, [
        el('div', { sinif: 'rutin-baslik-satir' }, [
          el('span', { sinif: 'kaynak-ad', metin: r.ad }),
          el('span', { sinif: 'etiket rutin-tur-' + r.tur, metin: turMetni }),
          r.hedefDeger ? el('span', { sinif: 'etiket bugun', metin: 'Günlük ' + r.hedefDeger + ' ' + hedefBirim }) : null
        ]),
        el('span', { sinif: 'alt-yazi', metin: gunlerMetni + (tarihMetni ? ' • ' + tarihMetni : '') })
      ]),
      el('div', { sinif: 'kaynak-islemler' }, [
        el('button', {
          type: 'button', sinif: 'metin-dugme', metin: 'Düzenle', 'aria-label': 'Rutini düzenle: ' + r.ad,
          onclick: function () { durum.tekrarlananRutinDuzenle = r.id; U.ciz(); }
        }),
        el('button', {
          type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Rutini sil: ' + r.ad,
          onclick: function () {
            if (window.confirm('"' + r.ad + '" rutini silinsin mi?\n(Geçmiş günlerdeki tamamlama kayıtları korunur.)')) {
              islem(function () { D.tekrarlananRutinSil(durum.veri, r.id); });
            }
          }
        })
      ])
    ]);
  }

  function tekrarlananRutinFormu(r) {
    var duzenleme = !!r;
    var v = r || { ad: '', tur: 'paragraf', hedefTuru: 'soru', hedefDeger: 20, gunler: [1, 2, 3, 4, 5, 6, 0], baslangic: durum.bugun, bitis: '' };
    var ad = giris({ type: 'text', maxlength: '80', placeholder: 'örn. Günlük Paragraf Çözümü', 'aria-label': 'Rutin adı', 'data-odak': 'tekrar-rutin-ad' }, v.ad);

    var turSecenekleri = Object.keys(D.RUTIN_TURLERI).map(function (k) { return [k, D.RUTIN_TURLERI[k]]; });
    var tur = el('select', { 'aria-label': 'Rutin türü' }, turSecenekleri.map(function (o) { return el('option', { value: o[0], metin: o[1] }); }));
    tur.value = v.tur;

    var hedefTuru = el('select', { 'aria-label': 'Hedef türü' }, [
      el('option', { value: 'soru', metin: 'Soru sayısı' }),
      el('option', { value: 'sure', metin: 'Çalışma süresi (dk)' })
    ]);
    hedefTuru.value = v.hedefTuru || 'soru';

    var hedefDeger = giris({ type: 'number', min: '1', max: '999', step: '1', inputmode: 'numeric', 'aria-label': 'Günlük hedef' }, String(v.hedefDeger || ''));
    var baslangic = giris({ type: 'date', 'aria-label': 'Başlangıç tarihi' }, v.baslangic || durum.bugun);
    var bitis = giris({ type: 'date', 'aria-label': 'Bitiş tarihi (isteğe bağlı)' }, v.bitis || '');

    var kutular = {};
    var gunKap = el('div', { sinif: 'gun-secimi', role: 'group', 'aria-label': 'Rutin günleri' });
    GUN_SIRASI.forEach(function (g) {
      var kutu = el('input', { type: 'checkbox', 'data-gun': String(g), 'aria-label': GUN_KISA[g] });
      kutu.checked = (v.gunler || []).indexOf(g) >= 0;
      kutular[g] = kutu;
      gunKap.appendChild(el('label', { sinif: 'gun-kutusu' }, [kutu, el('span', { metin: GUN_KISA[g] })]));
    });
    function sec(liste) { GUN_SIRASI.forEach(function (g) { kutular[g].checked = liste.indexOf(g) >= 0; }); }
    var hizli = el('div', { sinif: 'hizli-gun' }, [
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Hafta içi', onclick: function () { sec([1, 2, 3, 4, 5]); } }),
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Hafta sonu', onclick: function () { sec([6, 0]); } }),
      el('button', { type: 'button', sinif: 'metin-dugme', metin: 'Her gün', onclick: function () { sec([0, 1, 2, 3, 4, 5, 6]); } })
    ]);

    var dugmeler = [el('button', { type: 'submit', sinif: 'birincil', metin: duzenleme ? 'Rutini kaydet' : 'Yeni rutin ekle' })];
    if (duzenleme) {
      dugmeler.push(el('button', {
        type: 'button', sinif: 'ikincil', metin: 'Vazgeç',
        onclick: function () { durum.tekrarlananRutinDuzenle = null; U.ciz(); }
      }));
    }

    return el('form', {
      sinif: 'kayit-formu', 'data-form': 'tekrarlanan-rutin',
      onsubmit: function (olay) {
        olay.preventDefault();
        var seciliGunler = GUN_SIRASI.filter(function (g) { return kutular[g].checked; });
        var secenek = {
          ad: ad.value,
          tur: tur.value,
          hedefTuru: hedefTuru.value,
          hedefDeger: hedefDeger.value,
          gunler: seciliGunler,
          baslangic: baslangic.value,
          bitis: bitis.value
        };
        islem(function () {
          if (duzenleme) {
            D.tekrarlananRutinGuncelle(durum.veri, r.id, secenek);
          } else {
            D.tekrarlananRutinEkle(durum.veri, secenek);
          }
          durum.tekrarlananRutinDuzenle = null;
        }, 'tekrar-rutin-ad');
      }
    }, [
      el('h3', { metin: duzenleme ? 'Rutini düzenle' : 'Yeni tekrarlanan rutin' }),
      el('div', { sinif: 'form-satir' }, [alan('Rutin adı', ad, 'genis'), alan('Tür', tur)]),
      el('div', { sinif: 'form-satir' }, [alan('Hedef türü', hedefTuru), alan('Günlük hedef miktar', hedefDeger, 'dar')]),
      el('div', { sinif: 'form-satir' }, [alan('Başlangıç', baslangic), alan('Bitiş (isteğe bağlı)', bitis)]),
      el('div', {}, [el('span', { sinif: 'alan-baslik', metin: 'Uygulanacak günler' }), gunKap, hizli]),
      el('div', { sinif: 'form-satir' }, dugmeler)
    ]);
  }

  // ======================= HAFTALIK PLANLAMA =======================

  function haftalikPlanGorunumu() {
    var kok = el('div');
    kok.appendChild(U.sayfaBasligi('Haftalık Planlama', 'Pazar akşamı veya hafta başında önündeki haftayı planla. Ödevlerini, kısıtlamalarını ve önceliklerini gir; akıllı planlayıcı sana çakışmasız bir program taslağı oluştursun.'));

    var seciliHaftaBasi = durum.haftaBasi || D.haftaBasiTarihi(durum.bugun);
    durum.haftaBasi = seciliHaftaBasi;
    var haftaSonu = D.tarihEkle(seciliHaftaBasi, 6);

    // Hafta Seçim Çubuğu
    var haftaBasiGirdi = giris({ type: 'date', 'aria-label': 'Hafta başlangıç tarihi' }, seciliHaftaBasi);
    haftaBasiGirdi.addEventListener('change', function () {
      if (haftaBasiGirdi.value) {
        durum.haftaBasi = D.haftaBasiTarihi(haftaBasiGirdi.value);
        U.ciz();
      }
    });

    var buHaftaBasi = D.haftaBasiTarihi(durum.bugun);
    var gelecekHaftaBasi = D.tarihEkle(buHaftaBasi, 7);

    var haftaSecici = el('div', { sinif: 'haftalik-secici-bar' }, [
      el('div', { sinif: 'haftalik-tarih-bilgi' }, [
        el('strong', { metin: D.kisaTarih(seciliHaftaBasi, durum.bugun) + ' – ' + D.kisaTarih(haftaSonu, durum.bugun) + ' Haftası' }),
        el('span', { sinif: 'alt-yazi', metin: seciliHaftaBasi === buHaftaBasi ? ' (Bu hafta)' : (seciliHaftaBasi === gelecekHaftaBasi ? ' (Gelecek hafta)' : '') })
      ]),
      el('div', { sinif: 'haftalik-secici-dugmeler' }, [
        el('button', {
          type: 'button', sinif: 'filtre' + (seciliHaftaBasi === buHaftaBasi ? ' aktif' : ''), metin: 'Bu Hafta',
          onclick: function () { durum.haftaBasi = buHaftaBasi; U.ciz(); }
        }),
        el('button', {
          type: 'button', sinif: 'filtre' + (seciliHaftaBasi === gelecekHaftaBasi ? ' aktif' : ''), metin: 'Gelecek Hafta',
          onclick: function () { durum.haftaBasi = gelecekHaftaBasi; U.ciz(); }
        }),
        alan('Hafta seç', haftaBasiGirdi, 'dar')
      ])
    ]);
    kok.appendChild(haftaSecici);

    var plan = D.haftalikPlanAl(durum.veri, seciliHaftaBasi);

    // Bölüm A: Haftalık Ödevler
    kok.appendChild(haftalikOdevlerBolumu(seciliHaftaBasi, plan));

    // Bölüm B: Müsaitlik ve Kısıtlamalar
    kok.appendChild(haftalikKisitlamalarBolumu(seciliHaftaBasi, plan));

    // Bölüm C: Bu Hafta Tekrar Edilecek Konular (Kullanıcının Seçimi)
    kok.appendChild(haftalikTekrarBolumu(seciliHaftaBasi, plan));

    // Bölüm D: AI Talimatları ve Hafta Öncelikleri
    kok.appendChild(haftalikTalimatlarBolumu(seciliHaftaBasi, plan));

    // Bölüm E: Haftalık Program Taslağı
    kok.appendChild(haftalikProgramTaslagiBolumu(seciliHaftaBasi, plan));

    return kok;
  }

  function haftalikOdevlerBolumu(haftaBasi, plan) {
    var kap = el('div', { sinif: 'haftalik-bolum odevler-bolumu' });
    kap.appendChild(el('h2', { metin: 'A. Haftalık Ödevler (' + plan.odevler.length + ')' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Bu hafta yetiştirmen gereken ödevler, son teslim tarihleri ve tercih ettiğin çalışma günleri.' }));

    var ad = giris({ type: 'text', maxlength: '150', placeholder: 'Ödev adı (örn. Fonksiyonlar soru föyü)', 'aria-label': 'Ödev adı' });
    var ders = U.dersSecenekleri('');
    var sonTeslim = giris({ type: 'date', 'aria-label': 'Son teslim tarihi' }, D.tarihEkle(haftaBasi, 4)); // Cuma
    var tercihGun = el('select', { 'aria-label': 'Tercih edilen çalışma günü' }, [
      el('option', { value: '', metin: 'Gün fark etmez' }),
      el('option', { value: D.tarihEkle(haftaBasi, 0), metin: 'Pazartesi' }),
      el('option', { value: D.tarihEkle(haftaBasi, 1), metin: 'Salı' }),
      el('option', { value: D.tarihEkle(haftaBasi, 2), metin: 'Çarşamba' }),
      el('option', { value: D.tarihEkle(haftaBasi, 3), metin: 'Perşembe' }),
      el('option', { value: D.tarihEkle(haftaBasi, 4), metin: 'Cuma' }),
      el('option', { value: D.tarihEkle(haftaBasi, 5), metin: 'Cumartesi' }),
      el('option', { value: D.tarihEkle(haftaBasi, 6), metin: 'Pazar' })
    ]);
    var sureDk = giris({ type: 'number', min: '10', max: '600', step: '5', inputmode: 'numeric', placeholder: 'Dk', 'aria-label': 'Tahmini süre' }, '60');
    var soruSayisi = giris({ type: 'number', min: '0', max: '999', step: '1', inputmode: 'numeric', placeholder: 'Soru', 'aria-label': 'Soru sayısı' }, '');

    kap.appendChild(el('form', {
      sinif: 'kayit-formu', 'data-form': 'haftalik-odev',
      onsubmit: function (olay) {
        olay.preventDefault();
        if (!ad.value.trim()) { return; }
        islem(function () {
          D.haftalikOdevEkle(durum.veri, haftaBasi, {
            baslik: ad.value,
            dersId: ders.value,
            sonTeslim: sonTeslim.value,
            tercihGun: tercihGun.value,
            sureDk: sureDk.value,
            soruSayisi: soruSayisi.value
          });
        });
      }
    }, [
      el('h3', { metin: 'Yeni ödev ekle' }),
      el('div', { sinif: 'form-satir' }, [alan('Ödev başlığı', ad, 'genis'), alan('Ders', ders)]),
      el('div', { sinif: 'form-satir' }, [alan('Son teslim tarihi', sonTeslim), alan('Tercih edilen gün', tercihGun), alan('Süre (dk)', sureDk, 'dar'), alan('Soru', soruSayisi, 'dar')]),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: 'Ödev ekle' })])
    ]));

    if (!plan.odevler.length) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Bu hafta için henüz ödev eklenmedi.' }));
    } else {
      kap.appendChild(el('ul', { sinif: 'haftalik-odev-listesi' }, plan.odevler.map(function (o) {
        var d = D.dersBul(durum.veri, o.dersId);
        var kutu = el('input', {
          type: 'checkbox', isaretli: o.tamamlandi, 'aria-label': o.baslik + ' tamamlandı',
          onchange: function () {
            islem(function () { D.haftalikOdevTamamla(durum.veri, haftaBasi, o.id, kutu.checked); });
          }
        });
        return el('li', { sinif: 'blok odev-satir' + (o.tamamlandi ? ' tamam' : '') }, [
          el('div', { sinif: 'blok-bilgi' }, [
            el('div', { sinif: 'odev-ust' }, [
              kutu,
              el('span', { sinif: 'kaynak-ad' + (o.tamamlandi ? ' ustu-cizili' : ''), metin: o.baslik }),
              d ? el('span', { sinif: 'etiket', metin: d.grup + ' ' + d.ad }) : null,
              o.sureDk ? el('span', { sinif: 'etiket bugun', metin: o.sureDk + ' dk' }) : null,
              o.soruSayisi ? el('span', { sinif: 'alt-yazi', metin: o.soruSayisi + ' soru' }) : null
            ]),
            el('span', { sinif: 'alt-yazi', metin: 'Son teslim: ' + (o.sonTeslim ? D.kisaTarih(o.sonTeslim, durum.bugun) : 'belirtilmedi') + (o.tercihGun ? ' • Tercih: ' + D.kisaTarih(o.tercihGun, durum.bugun) : '') })
          ]),
          el('div', { sinif: 'kaynak-islemler' }, [
            el('button', {
              type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Ödevi sil: ' + o.baslik,
              onclick: function () { islem(function () { D.haftalikOdevSil(durum.veri, haftaBasi, o.id); }); }
            })
          ])
        ]);
      })));
    }
    return kap;
  }

  function haftalikKisitlamalarBolumu(haftaBasi, plan) {
    var kap = el('div', { sinif: 'haftalik-bolum kisitlama-bolumu' });
    kap.appendChild(el('h2', { metin: 'B. Müsaitlik ve Kısıtlamalar (' + plan.kisitlamalar.length + ')' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Bu hafta çalışamayacağın saatler veya günler (örn. "Pazartesi 18.00-21.00 arası doluyum", "Çarşamba akşamı çalışamayacağım").' }));

    var gunSecenekleri = [];
    for (var i = 0; i < 7; i++) {
      var t = D.tarihEkle(haftaBasi, i);
      var gunAdi = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][i];
      gunSecenekleri.push(el('option', { value: t, metin: gunAdi + ' (' + D.kisaTarih(t, durum.bugun) + ')' }));
    }
    var gun = el('select', { 'aria-label': 'Kısıtlama günü' }, gunSecenekleri);
    var tumGun = el('input', { type: 'checkbox', 'aria-label': 'Tüm gün meşgul' });
    var bas = giris({ type: 'time', 'aria-label': 'Başlangıç saati' }, '18:00');
    var bit = giris({ type: 'time', 'aria-label': 'Bitiş saati' }, '21:00');
    var aciklama = giris({ type: 'text', maxlength: '100', placeholder: 'örn. Dershane, Ailevi işler, Spor', 'aria-label': 'Kısıtlama nedeni' }, '');

    function guncelleSaatGorunurluk() {
      bas.disabled = tumGun.checked;
      bit.disabled = tumGun.checked;
    }
    tumGun.addEventListener('change', guncelleSaatGorunurluk);

    kap.appendChild(el('form', {
      sinif: 'kayit-formu', 'data-form': 'haftalik-kisit',
      onsubmit: function (olay) {
        olay.preventDefault();
        islem(function () {
          D.haftalikKisitlamaEkle(durum.veri, haftaBasi, {
            tarih: gun.value,
            tumGun: tumGun.checked,
            bas: tumGun.checked ? '00:00' : bas.value,
            bit: tumGun.checked ? '23:59' : bit.value,
            aciklama: aciklama.value
          });
        });
      }
    }, [
      el('h3', { metin: 'Yeni kısıtlama ekle' }),
      el('div', { sinif: 'form-satir' }, [alan('Gün', gun), alan('Neden / Açıklama', aciklama, 'genis')]),
      el('div', { sinif: 'form-satir' }, [
        el('label', { sinif: 'onay-satiri' }, [tumGun, el('span', { metin: 'Tüm gün meşgulüm' })]),
        alan('Başlangıç', bas, 'dar'), alan('Bitiş', bit, 'dar')
      ]),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: 'Kısıtlama ekle' })])
    ]));

    if (!plan.kisitlamalar.length) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Bu hafta için henüz özel bir kısıtlama girilmedi.' }));
    } else {
      kap.appendChild(el('ul', { sinif: 'haftalik-kisit-listesi' }, plan.kisitlamalar.map(function (k) {
        var saatMetni = k.tumGun ? 'Tüm gün meşgul' : k.bas + ' – ' + k.bit;
        return el('li', { sinif: 'blok kisit-satir' }, [
          el('div', { sinif: 'blok-bilgi' }, [
            el('div', { sinif: 'kisit-ust' }, [
              el('strong', { metin: D.kisaTarih(k.tarih, durum.bugun) + ': ' }),
              el('span', { sinif: 'etiket gecikti', metin: saatMetni }),
              k.aciklama ? el('span', { sinif: 'kaynak-ad', metin: k.aciklama }) : null
            ])
          ]),
          el('div', { sinif: 'kaynak-islemler' }, [
            el('button', {
              type: 'button', sinif: 'metin-dugme sil', metin: 'Sil', 'aria-label': 'Kısıtlamayı sil: ' + (k.aciklama || saatMetni),
              onclick: function () { islem(function () { D.haftalikKisitlamaSil(durum.veri, haftaBasi, k.id); }); }
            })
          ])
        ]);
      })));
    }
    return kap;
  }

  function haftalikTekrarBolumu(haftaBasi, plan) {
    var kap = el('div', { sinif: 'haftalik-bolum tekrar-bolumu' });
    var tekrarlar = plan.tekrarKonulari || [];
    kap.appendChild(el('h2', { metin: 'C. Bu Hafta Tekrar Etmek İstediğin Konular (' + tekrarlar.length + ')' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Sistem kafasına göre zorla tekrar dayatmaz. Sadece senin bu hafta tekrar etmek istediğin konuları seçebilirsin. Buraya eklediğin konular haftalık taslağa otomatik dağıtılır.' }));

    var ders = U.dersSecenekleri('');
    var konuGirdisi = giris({ type: 'text', maxlength: '120', placeholder: 'Tekrar etmek istediğin konu adı (örn. Parabol)', 'aria-label': 'Tekrar konu adı' });
    var soruGirdisi = giris({ type: 'number', min: '5', max: '200', step: '5', inputmode: 'numeric', placeholder: 'Soru', 'aria-label': 'Hedef soru' }, '20');
    var sureGirdisi = giris({ type: 'number', min: '15', max: '180', step: '5', inputmode: 'numeric', placeholder: 'Dk', 'aria-label': 'Hedef süre' }, '40');

    kap.appendChild(el('form', {
      sinif: 'kayit-formu', 'data-form': 'haftalik-tekrar',
      onsubmit: function (olay) {
        olay.preventDefault();
        var konuAdi = konuGirdisi.value.trim();
        if (!konuAdi) { return; }
        var dersObj = D.dersBul(durum.veri, ders.value);
        var dersAdi = dersObj ? (dersObj.grup + ' ' + dersObj.ad) : '';
        islem(function () {
          D.haftalikTekrarEkle(durum.veri, haftaBasi, {
            dersId: ders.value,
            dersAdi: dersAdi,
            konuAdi: konuAdi,
            hedefSoru: soruGirdisi.value,
            sureDk: sureGirdisi.value
          });
        });
        konuGirdisi.value = '';
      }
    }, [
      el('h3', { metin: 'Listeye tekrar konusu ekle' }),
      el('div', { sinif: 'form-satir' }, [alan('Ders (isteğe bağlı)', ders), alan('Konu adı', konuGirdisi, 'genis')]),
      el('div', { sinif: 'form-satir' }, [alan('Hedef soru sayısı', soruGirdisi, 'dar'), alan('Tahmini süre (dk)', sureGirdisi, 'dar')]),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: '+ Tekrar Listeme Ekle' })])
    ]));

    if (!tekrarlar.length) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Bu hafta için henüz tekrar konusu seçmedin. Yukarıdan konu ekleyebilir veya "Dersler ve Konular" sayfasından "+ Bu Hafta Tekrar Et" butonuna basabilirsin.' }));
    } else {
      kap.appendChild(el('ul', { sinif: 'haftalik-odev-listesi' }, tekrarlar.map(function (tk) {
        var kutu = el('input', {
          type: 'checkbox', isaretli: tk.tamamlandi, 'aria-label': tk.konuAdi + ' tekrar edildi',
          onchange: function () {
            islem(function () { D.haftalikTekrarDurum(durum.veri, haftaBasi, tk.id, kutu.checked); });
          }
        });
        return el('li', { sinif: 'blok odev-satir' + (tk.tamamlandi ? ' tamam' : '') }, [
          el('div', { sinif: 'blok-bilgi' }, [
            el('div', { sinif: 'odev-ust' }, [
              kutu,
              el('strong', { metin: tk.konuAdi }),
              tk.dersAdi ? el('span', { sinif: 'etiket', metin: tk.dersAdi }) : null,
              el('span', { sinif: 'etiket ikincil', metin: (tk.hedefSoru ? tk.hedefSoru + ' soru' : '') + (tk.hedefSoru && tk.sureDk ? ' / ' : '') + (tk.sureDk ? tk.sureDk + ' dk' : '') })
            ])
          ]),
          el('div', { sinif: 'kaynak-islemler' }, [
            el('button', {
              type: 'button', sinif: 'metin-dugme sil', metin: 'Kaldır', 'aria-label': 'Tekrarı kaldır: ' + tk.konuAdi,
              onclick: function () {
                islem(function () { D.haftalikTekrarSil(durum.veri, haftaBasi, tk.id); });
              }
            })
          ])
        ]);
      })));
    }

    return kap;
  }

  function haftalikTalimatlarBolumu(haftaBasi, plan) {
    var kap = el('div', { sinif: 'haftalik-bolum talimatlar-bolumu' });
    kap.appendChild(el('h2', { metin: 'D. AI İçin Haftalık Talimatlar ve Notlar' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Bu hafta öncelik vermek istediğin dersler, özellikle bitirmek istediğin konular ve program oluşturulurken yapay zekânın bilmesini istediğin notlar.' }));

    var oncelikliDersler = giris({ type: 'text', maxlength: '200', placeholder: 'örn. Matematik, Fizik', 'aria-label': 'Öncelikli dersler' }, plan.oncelikliDersler || '');
    var bitirilecekKonular = giris({ type: 'text', maxlength: '200', placeholder: 'örn. Türev, Elektrostatik', 'aria-label': 'Bitirilecek konular' }, plan.bitirilecekKonular || '');
    var talimat = el('textarea', { rows: '3', maxlength: '800', placeholder: 'Bu haftaya özel AI talimatları (örn. Hafta sonu deneme çözeceğim için Cuma akşamını hafif tut, TYT Geometriye en az 4 saat ayır)...', 'aria-label': 'Haftalık özel notlar' });
    talimat.value = plan.talimat || '';

    kap.appendChild(el('form', {
      sinif: 'kayit-formu', 'data-form': 'haftalik-talimat',
      onsubmit: function (olay) {
        olay.preventDefault();
        var tamam = islem(function () {
          D.haftalikTalimatKaydet(durum.veri, haftaBasi, {
            talimat: talimat.value,
            oncelikliDersler: oncelikliDersler.value,
            bitirilecekKonular: bitirilecekKonular.value
          });
        });
        if (tamam) { U.uyariGoster('Haftalık talimatlar kaydedildi.', 'bilgi', 'haftalik'); }
      }
    }, [
      el('div', { sinif: 'form-satir' }, [alan('Bu hafta öncelikli dersler', oncelikliDersler, 'genis'), alan('Özellikle bitirmek istediğim konular', bitirilecekKonular, 'genis')]),
      alan('AI Haftalık Talimatı ve Notlar', talimat, 'genis'),
      el('div', { sinif: 'form-satir' }, [el('button', { type: 'submit', sinif: 'birincil', metin: 'Talimatları kaydet' })])
    ]));
    return kap;
  }

  function haftalikProgramTaslagiBolumu(haftaBasi, plan) {
    var kap = el('div', { sinif: 'haftalik-bolum program-taslagi-bolumu' });
    kap.appendChild(el('h2', { metin: 'E. Haftalık Program Taslağı ve Takvime Aktarma' }));
    kap.appendChild(el('p', { sinif: 'alt-yazi', metin: 'Ödevler, kısıtlamalar, rutinler ve zayıf konular birleştirilerek sana özel 7 günlük bir taslak hazırlanır. Onaylamadan mevcut programının üzerine yazılmaz.' }));

    var taslakVar = plan.program && plan.program.gunler && plan.program.gunler.length > 0;

    var dugmeler = el('div', { sinif: 'form-satir haftalik-eylemler' }, [
      el('button', {
        type: 'button', sinif: 'birincil', id: 'akilli-taslak-olustur', metin: 'Akıllı Haftalık Taslak Oluştur',
        onclick: function () {
          islem(function () {
            var taslak = P.haftalikPlanTaslagi(durum.veri, haftaBasi, durum.bugun);
            D.haftalikProgramKaydet(durum.veri, haftaBasi, taslak.gunler);
          });
          U.uyariGoster('Haftalık program taslağı hazırlandı! Aşağıdan gün gün inceleyebilir ve onaylayabilirsin.', 'bilgi', 'haftalik');
        }
      })
    ]);

    if (taslakVar) {
      var toplamDk = plan.program.gunler.reduce(function (t, g) { return t + (g.toplamDk || 0); }, 0);
      dugmeler.appendChild(el('button', {
        type: 'button', sinif: 'birincil yesil-dugme', id: 'taslagi-uygula',
        metin: plan.program.uygulandi ? 'Programı Yeniden Uygula' : 'Programı Onayla ve Görevlere Aktar (' + A.sureMetni(toplamDk) + ')',
        onclick: function () {
          if (window.confirm('Bu haftalık taslaktaki görevler takviminize eklenecektir. Onaylıyor musunuz?')) {
            var sonuc = null;
            if (islem(function () { sonuc = D.haftalikProgramiUygula(durum.veri, haftaBasi); })) {
              U.uyariGoster(sonuc.eklenen + ' görev takviminize eklendi! Görevler ve Bugün sayfalarından takip edebilirsiniz.', 'bilgi', 'haftalik');
            }
          }
        }
      }));
    }
    kap.appendChild(dugmeler);

    if (!taslakVar) {
      kap.appendChild(el('p', { sinif: 'bos', metin: 'Henüz bir haftalık taslak oluşturulmadı. Yukarıdaki "Akıllı Haftalık Taslak Oluştur" düğmesine basarak programını oluştur.' }));
    } else {
      var grid = el('div', { sinif: 'haftalik-grid' });
      plan.program.gunler.forEach(function (gun) {
        var gunKart = el('div', { sinif: 'haftalik-gun-kart' }, [
          el('div', { sinif: 'haftalik-gun-baslik' }, [
            el('strong', { metin: gun.gunAdi }),
            el('span', { sinif: 'alt-yazi', metin: D.kisaTarih(gun.tarih, durum.bugun) }),
            gun.toplamDk ? el('span', { sinif: 'etiket bugun', metin: A.sureMetni(gun.toplamDk) }) : null
          ])
        ]);

        var icerikListesi = el('ul', { sinif: 'haftalik-gun-ogeler' });

        // Kısıtlamalar
        (gun.kisitlamalar || []).forEach(function (k) {
          icerikListesi.appendChild(el('li', { sinif: 'gun-oge gun-oge-kisit' }, [
            el('span', { sinif: 'etiket gecikti', metin: 'Meşgul' }),
            el('span', { metin: (k.tumGun ? 'Tüm gün' : k.bas + '-' + k.bit) + (k.aciklama ? ': ' + k.aciklama : '') })
          ]));
        });

        // Rutinler
        (gun.rutinler || []).forEach(function (r) {
          var birim = r.hedefTuru === 'soru' ? 'soru' : 'dk';
          icerikListesi.appendChild(el('li', { sinif: 'gun-oge gun-oge-rutin' }, [
            el('span', { sinif: 'etiket rutin-tur-' + r.tur, metin: D.RUTIN_TURLERI[r.tur] || r.tur }),
            el('span', { metin: r.ad + (r.hedefDeger ? ' (' + r.hedefDeger + ' ' + birim + ')' : '') })
          ]));
        });

        // Görevler
        (gun.gorevler || []).forEach(function (g) {
          var ders = D.dersBul(durum.veri, g.dersId);
          icerikListesi.appendChild(el('li', { sinif: 'gun-oge gun-oge-gorev' }, [
            el('span', { sinif: 'alt-yazi', metin: g.saat ? g.saat + ' (' + g.sureDk + ' dk)' : g.sureDk + ' dk' }),
            el('span', { sinif: 'gorev-baslik-metin', metin: g.baslik }),
            ders ? el('span', { sinif: 'etiket', metin: ders.grup + ' ' + ders.ad }) : null
          ]));
        });

        if (!icerikListesi.children.length) {
          icerikListesi.appendChild(el('li', { sinif: 'bos-metin alt-yazi', metin: 'Planlanan iş yok / Serbest' }));
        }

        gunKart.appendChild(icerikListesi);
        grid.appendChild(gunKart);
      });
      kap.appendChild(grid);
    }

    return kap;
  }

  // ---------- Birleştirilmiş Planlama Ekranı (Haftalık / Günlük / Rutin) ----------

  function planlamaGorunumu() {
    durum.planlamaAltSekme = durum.planlamaAltSekme || 'haftalik';
    var kok = el('div', { sinif: 'sayfa planlama-sayfasi' });

    var sekmeler = el('div', { sinif: 'alt-sekme-cubugu' }, [
      el('button', {
        type: 'button',
        sinif: 'alt-sekme-dugme' + (durum.planlamaAltSekme === 'haftalik' ? ' aktif' : ''),
        metin: '📅 Haftalık Planlama',
        onclick: function () { durum.planlamaAltSekme = 'haftalik'; U.ciz(); }
      }),
      el('button', {
        type: 'button',
        sinif: 'alt-sekme-dugme' + (durum.planlamaAltSekme === 'gunluk' ? ' aktif' : ''),
        metin: '⏱ Günlük Otomatik Plan',
        onclick: function () { durum.planlamaAltSekme = 'gunluk'; U.ciz(); }
      }),
      el('button', {
        type: 'button',
        sinif: 'alt-sekme-dugme' + (durum.planlamaAltSekme === 'rutin' ? ' aktif' : ''),
        metin: '🔄 Rutinler ve Boş Zaman',
        onclick: function () { durum.planlamaAltSekme = 'rutin'; U.ciz(); }
      })
    ]);

    kok.appendChild(sekmeler);

    var govde = el('div', { sinif: 'planlama-icerik' });
    if (durum.planlamaAltSekme === 'gunluk') {
      govde.appendChild(planGorunumu());
    } else if (durum.planlamaAltSekme === 'rutin') {
      govde.appendChild(rutinGorunumu());
    } else {
      govde.appendChild(haftalikPlanGorunumu());
    }
    kok.appendChild(govde);
    return kok;
  }

  // ---------- Birleştirilmiş Gelişim Ekranı (Hedefler / Rapor) ----------

  function gelisimGorunumu() {
    durum.gelisimAltSekme = durum.gelisimAltSekme || 'hedefler';
    var kok = el('div', { sinif: 'sayfa gelisim-sayfasi' });

    var sekmeler = el('div', { sinif: 'alt-sekme-cubugu' }, [
      el('button', {
        type: 'button',
        sinif: 'alt-sekme-dugme' + (durum.gelisimAltSekme === 'hedefler' ? ' aktif' : ''),
        metin: '🎯 Hedefler ve Seviye',
        onclick: function () { durum.gelisimAltSekme = 'hedefler'; U.ciz(); }
      }),
      el('button', {
        type: 'button',
        sinif: 'alt-sekme-dugme' + (durum.gelisimAltSekme === 'rapor' ? ' aktif' : ''),
        metin: '📊 Çalışma Raporu ve İlerleme',
        onclick: function () { durum.gelisimAltSekme = 'rapor'; U.ciz(); }
      })
    ]);

    kok.appendChild(sekmeler);

    var govde = el('div', { sinif: 'gelisim-icerik' });
    if (durum.gelisimAltSekme === 'rapor') {
      govde.appendChild(raporGorunumu());
    } else {
      govde.appendChild(U.gorunumler.hedeflerAsil ? U.gorunumler.hedeflerAsil() : U.gorunumler.hedefler());
    }
    kok.appendChild(govde);
    return kok;
  }

  var hedeflerAsil = U.gorunumler.hedefler;
  U.gorunumler.hedeflerAsil = hedeflerAsil;

  U.gorunumler.planlama = planlamaGorunumu;
  U.gorunumler.gelisim = gelisimGorunumu;

  // Geriye dönük uyumluluk (eski linkler ve testler için)
  U.gorunumler.plan = function () { durum.planlamaAltSekme = 'gunluk'; return planlamaGorunumu(); };
  U.gorunumler.rutin = function () { durum.planlamaAltSekme = 'rutin'; return planlamaGorunumu(); };
  U.gorunumler.haftalik = function () { durum.planlamaAltSekme = 'haftalik'; return planlamaGorunumu(); };
  U.gorunumler.hedefler = function () { durum.gelisimAltSekme = 'hedefler'; return gelisimGorunumu(); };
  U.gorunumler.rapor = function () { durum.gelisimAltSekme = 'rapor'; return gelisimGorunumu(); };
})();
