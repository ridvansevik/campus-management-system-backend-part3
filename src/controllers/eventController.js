const { Event, EventRegistration, sequelize } = require('../models');
const QRCode = require('qrcode');

exports.getEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      order: [['date', 'ASC']]
    });
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
// YENİ: Etkinlik Oluşturma (Admin)
exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Check-in (Görevli)
exports.checkInEvent = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    
    const registration = await EventRegistration.findOne({
      where: { id: registrationId, event_id: eventId }
    });

    if (!registration) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    if (registration.checked_in) return res.status(400).json({ success: false, message: 'Zaten giriş yapılmış' });

    await registration.update({
      checked_in: true,
      checked_in_at: new Date()
    });

    res.json({ success: true, message: 'Giriş onaylandı' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Kayıt İptali
exports.cancelRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id);
    
    if (!registration) throw new Error('Kayıt bulunamadı');
    if (registration.user_id !== req.user.id) throw new Error('Yetkisiz işlem');

    const event = await Event.findByPk(registration.event_id);
    
    // Kaydı sil
    await registration.destroy({ transaction: t });

    // Sayacı azalt
    if (event) {
      await event.decrement('registered_count', { transaction: t });
    }

    await t.commit();
    res.json({ success: true, message: 'Etkinlik kaydı iptal edildi.' });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};
exports.registerEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await Event.findByPk(eventId);
    if (!event) throw new Error('Etkinlik bulunamadı');

    if (event.registered_count >= event.capacity) {
      throw new Error('Kontenjan dolu');
    }

    const existing = await EventRegistration.findOne({
      where: { event_id: eventId, user_id: userId }
    });
    if (existing) throw new Error('Zaten kayıtlısınız');

    // QR Kod
    const qrData = JSON.stringify({ u: userId, e: eventId, type: 'event' });
    const qrImage = await QRCode.toDataURL(qrData);

    const registration = await EventRegistration.create({
      event_id: eventId,
      user_id: userId,
      qr_code: qrImage
    }, { transaction: t });

    // Sayaç artır (Atomic increment)
    await event.increment('registered_count', { transaction: t });

    await t.commit();
    res.status(201).json({ success: true, data: registration });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getMyEvents = async (req, res) => {
  try {
    const registrations = await EventRegistration.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Event }]
    });
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Güncelleme
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ success: false, message: 'Etkinlik bulunamadı' });

    await event.update(req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Silme/İptal Etme
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ success: false, message: 'Etkinlik bulunamadı' });

    // Hard delete yerine status güncellemek daha güvenlidir
    await event.update({ status: 'cancelled' });
    
    // Opsiyonel: Katılımcılara bildirim gönder (NotificationService)
    
    res.json({ success: true, message: 'Etkinlik iptal edildi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinliğe Kayıtlı Kişileri Listeleme (Personel için)
exports.getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const registrations = await EventRegistration.findAll({
      where: { event_id: eventId },
      include: [
        { 
          model: require('../models').User, 
          attributes: ['id', 'name', 'email', 'student_number'] 
        }
      ]
    });
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};