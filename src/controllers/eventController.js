const { Event, EventRegistration, sequelize, User } = require('../models');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const qrCodeService = require('../services/qrCodeService');
const notificationService = require('../services/notificationService');

exports.getEvents = async (req, res) => {
  try {
    const { category, date, search, page = 1, limit = 10 } = req.query;
    const whereClause = { status: 'active' }; // Sadece aktif etkinlikler

    // Filter by category
    if (category) {
      whereClause.category = category;
    }

    // Filter by date
    if (date) {
      whereClause.date = { [Op.gte]: date }; // Bu tarihten sonraki etkinlikler
    }

    // Search by title
    if (search) {
      whereClause.title = { [Op.iLike]: `%${search}%` };
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: events } = await Event.findAndCountAll({
      where: whereClause,
      order: [['date', 'ASC'], ['start_time', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({ 
      success: true, 
      data: events,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Etkinlik Detayı
exports.getEventDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id, {
      include: [{
        model: EventRegistration,
        attributes: ['id', 'user_id', 'checked_in'],
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      }]
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Etkinlik bulunamadı' });
    }

    res.json({ success: true, data: event });
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

// YENİ: Etkinlik Check-in (Görevli) - QR kod ile
exports.checkInEvent = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params; // Route parametreleri (opsiyonel)
    const { qrCode } = req.body; // QR kod string'i
    
    let registration;
    
    // Eğer route /events/checkin ise (eventId ve registrationId yok), direkt QR kod ile ara
    if (!eventId || !registrationId) {
      // QR kod ile check-in (route: /events/checkin)
      if (!qrCode) {
        return res.status(400).json({ success: false, message: 'QR kod gerekli.' });
      }
      
      // QR kod parse et
      let qrData;
      try {
        qrData = qrCodeService.parseQRData(qrCode);
      } catch (error) {
        console.error('QR kod parse hatası:', error);
        return res.status(400).json({ success: false, message: 'Geçersiz QR kod formatı.' });
      }
      
      // QR kod formatı: {"u":"userId","e":"eventId","r":"token","type":"event"}
      // Token'ı bul: önce r, sonra token
      const qrToken = qrData.r || qrData.token || qrCode;
      const qrEventId = qrData.e || qrData.eventId;
      
      console.log('Event QR kod parse edildi:', { qrData, qrToken, qrEventId }); // Debug için
      
      // Rezervasyonu bul (QR token ile)
      const whereClause = {
        qr_code: qrToken,
        checked_in: false
      };
      
      // Eğer QR kod'da eventId varsa, onu da kullan
      if (qrEventId) {
        whereClause.event_id = qrEventId;
      }
      
      registration = await EventRegistration.findOne({
        where: whereClause,
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }, {
          model: Event
        }]
      });
      
      if (!registration) {
        console.log('Event kaydı bulunamadı. Token:', qrToken, 'Event ID:', qrEventId, 'QR Code:', qrCode); // Debug için
      }
    } else {
      // ID ile check-in (route: /events/:eventId/registrations/:registrationId/checkin)
      if (qrCode) {
        // QR kod ile bul (eventId ile birlikte)
        const qrData = qrCodeService.parseQRData(qrCode);
        const qrToken = qrData.r || qrData.token || qrCode;
        
        registration = await EventRegistration.findOne({
          where: { 
            qr_code: qrToken,
            event_id: eventId
          },
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        });
      } else {
        // Registration ID ile bul
        registration = await EventRegistration.findOne({
          where: { id: registrationId, event_id: eventId },
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        });
      }
    }

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    }

    if (registration.checked_in) {
      return res.status(400).json({ success: false, message: 'Zaten giriş yapılmış' });
    }

    await registration.update({
      checked_in: true,
      checked_in_at: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Giriş onaylandı',
      data: {
        user: registration.User,
        checkedInAt: registration.checked_in_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Kayıt İptali
exports.cancelRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const registration = await EventRegistration.findByPk(id, {
      include: [{ model: Event }]
    });
    
    if (!registration) throw new Error('Kayıt bulunamadı');
    if (registration.user_id !== req.user.id) throw new Error('Yetkisiz işlem');
    
    // Check-in yapılmışsa iptal edilemez
    if (registration.checked_in) {
      throw new Error('Giriş yapılmış etkinlikler iptal edilemez');
    }

    const event = registration.Event;
    
    // Kaydı sil
    await registration.destroy({ transaction: t });

    // Sayacı azalt
    if (event) {
      await event.decrement('registered_count', { transaction: t });
    }

    await t.commit();

    // Email bildirimi
    try {
      const user = await User.findByPk(req.user.id);
      if (user && event) {
        await notificationService.sendEventCancellation(user, event);
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

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
    const { customFields } = req.body; // Custom fields (JSON)
    const userId = req.user.id;

    const event = await Event.findByPk(eventId);
    if (!event) throw new Error('Etkinlik bulunamadı');

    // Status kontrolü
    if (event.status !== 'active') {
      throw new Error('Bu etkinlik aktif değil');
    }

    // Registration deadline kontrolü
    if (event.registration_deadline) {
      const today = new Date().toISOString().split('T')[0];
      if (today > event.registration_deadline) {
        throw new Error('Kayıt son tarihi geçmiş');
      }
    }

    // Kontenjan kontrolü
    if (event.registered_count >= event.capacity) {
      throw new Error('Kontenjan dolu');
    }

    // Zaten kayıtlı mı kontrolü
    const existing = await EventRegistration.findOne({
      where: { event_id: eventId, user_id: userId },
      transaction: t
    });
    if (existing) throw new Error('Zaten kayıtlısınız');

    // QR Kod oluştur
    const qrToken = qrCodeService.generateToken('event');
    const qrData = { u: userId, e: eventId, r: qrToken, type: 'event' };
    const qrCode = await qrCodeService.generateQRCode(qrData);

    const registration = await EventRegistration.create({
      event_id: eventId,
      user_id: userId,
      qr_code: qrToken, // Token kaydediyoruz
      custom_fields_json: customFields || {}
    }, { transaction: t });

    // Sayaç artır (Atomic increment)
    await event.increment('registered_count', { transaction: t });

    await t.commit();

    // Email bildirimi
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await notificationService.sendEventRegistrationConfirmation(user, event, qrCode);
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

    res.status(201).json({ 
      success: true, 
      data: {
        ...registration.toJSON(),
        qrCode // QR görseli frontend'e gönder
      }
    });
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