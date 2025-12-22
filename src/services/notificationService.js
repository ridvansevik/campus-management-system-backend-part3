const sendEmail = require('../utils/emailService');

/**
 * Notification Service
 * Email, push notification ve SMS gönderimi
 */

/**
 * Yemek rezervasyon onay email'i gönder
 */
exports.sendReservationConfirmation = async (user, reservation, menu) => {
  try {
    const message = `
Merhaba ${user.name},

Yemek rezervasyonunuz başarıyla oluşturuldu.

Detaylar:
- Tarih: ${reservation.reservation_date}
- Öğün: ${reservation.meal_type === 'lunch' ? 'Öğle Yemeği' : 'Akşam Yemeği'}
- Menü: ${menu.items_json ? JSON.stringify(menu.items_json) : 'Standart Menü'}
- QR Kod: Rezervasyonlarım sayfasından QR kodunuzu görebilirsiniz.

İyi günler!
    `;

    await sendEmail({
      email: user.email,
      subject: 'Yemek Rezervasyonu Onayı',
      message
    });
  } catch (error) {
    console.error('Rezervasyon onay email gönderim hatası:', error);
    // Email hatası kritik değil, log'la devam et
  }
};

/**
 * Yemek rezervasyon iptal email'i gönder
 */
exports.sendReservationCancellation = async (user, reservation) => {
  try {
    const message = `
Merhaba ${user.name},

Yemek rezervasyonunuz iptal edildi.

Detaylar:
- Tarih: ${reservation.reservation_date}
- Öğün: ${reservation.meal_type === 'lunch' ? 'Öğle Yemeği' : 'Akşam Yemeği'}

${reservation.amount > 0 ? `İade tutarı: ${reservation.amount} TRY (Cüzdanınıza yüklendi)` : ''}

İyi günler!
    `;

    await sendEmail({
      email: user.email,
      subject: 'Yemek Rezervasyonu İptali',
      message
    });
  } catch (error) {
    console.error('Rezervasyon iptal email gönderim hatası:', error);
  }
};

/**
 * Etkinlik kayıt onay email'i gönder
 */
exports.sendEventRegistrationConfirmation = async (user, event, qrCode) => {
  try {
    const message = `
Merhaba ${user.name},

${event.title} etkinliğine başarıyla kayıt oldunuz.

Etkinlik Detayları:
- Tarih: ${event.date}
- Saat: ${event.start_time} - ${event.end_time}
- Konum: ${event.location}
${event.is_paid ? `- Ücret: ${event.price} TRY` : ''}

QR kodunuzu etkinlik girişinde göstermeniz gerekmektedir.
QR kodunuzu "Etkinliklerim" sayfasından görebilirsiniz.

İyi günler!
    `;

    await sendEmail({
      email: user.email,
      subject: `Etkinlik Kaydı: ${event.title}`,
      message
    });
  } catch (error) {
    console.error('Etkinlik kayıt email gönderim hatası:', error);
  }
};

/**
 * Etkinlik kayıt iptal email'i gönder
 */
exports.sendEventCancellation = async (user, event) => {
  try {
    const message = `
Merhaba ${user.name},

${event.title} etkinliğine olan kaydınız iptal edildi.

Etkinlik Detayları:
- Tarih: ${event.date}
- Saat: ${event.start_time} - ${event.end_time}

İyi günler!
    `;

    await sendEmail({
      email: user.email,
      subject: `Etkinlik Kayıt İptali: ${event.title}`,
      message
    });
  } catch (error) {
    console.error('Etkinlik iptal email gönderim hatası:', error);
  }
};

/**
 * Ödeme onay email'i gönder
 */
exports.sendPaymentConfirmation = async (user, amount, transactionType) => {
  try {
    const message = `
Merhaba ${user.name},

${transactionType === 'deposit' ? 'Cüzdanınıza para yüklendi.' : 'Ödemeniz tamamlandı.'}

Detaylar:
- Tutar: ${amount} TRY
- İşlem Tipi: ${transactionType === 'deposit' ? 'Bakiye Yükleme' : 'Ödeme'}
- Tarih: ${new Date().toLocaleString('tr-TR')}

İyi günler!
    `;

    await sendEmail({
      email: user.email,
      subject: transactionType === 'deposit' ? 'Bakiye Yükleme Onayı' : 'Ödeme Onayı',
      message
    });
  } catch (error) {
    console.error('Ödeme onay email gönderim hatası:', error);
  }
};

/**
 * Derslik rezervasyon onay/red email'i gönder
 */
exports.sendClassroomReservationStatus = async (user, reservation, status) => {
  try {
    const message = `
Merhaba ${user.name},

Derslik rezervasyon talebiniz ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.

Detaylar:
- Derslik: ${reservation.classroom_id}
- Tarih: ${reservation.date}
- Saat: ${reservation.start_time} - ${reservation.end_time}
- Amaç: ${reservation.purpose}
- Durum: ${status === 'approved' ? 'Onaylandı' : 'Reddedildi'}

İyi günler!
    `;

    await sendEmail({
      email: user.email,
      subject: `Derslik Rezervasyon ${status === 'approved' ? 'Onayı' : 'Reddi'}`,
      message
    });
  } catch (error) {
    console.error('Derslik rezervasyon email gönderim hatası:', error);
  }
};

