const { MealMenu, MealReservation, Wallet, Transaction, Cafeteria, sequelize, Student } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const crypto = require('crypto'); // QRCode yerine crypto kullanıyoruz

exports.getMenus = async (req, res) => {
  try {
    const { date } = req.query;
    const whereClause = {};
    if (date) whereClause.date = date;

    const menus = await MealMenu.findAll({
      where: whereClause,
      include: [{ model: Cafeteria }]
    });
    res.json({ success: true, data: menus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GÜNCELLENMİŞ: Rezervasyon Oluşturma (Burslu/Ücretli Mantığı ile)
exports.createReservation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { menuId } = req.body;
    const userId = req.user.id;

    // Öğrenci bilgisini al (Burslu mu değil mi?)
    const student = await Student.findOne({ where: { userId: userId } });
    const isScholarship = student ? student.is_scholarship : false;

    const menu = await MealMenu.findByPk(menuId);
    if (!menu) throw new Error('Menü bulunamadı');

    // Mükerrer kontrolü
    const existing = await MealReservation.findOne({
      where: { user_id: userId, menu_id: menuId, status: { [Op.not]: 'cancelled' } }
    });
    if (existing) throw new Error('Bu öğün için zaten işleminiz var.');

    let wallet;
    
    if (isScholarship) {
      // BURSLU ÖĞRENCİ MANTIĞI
      // O gün için kaç rezervasyonu var? (Max 2)
      const dailyCount = await MealReservation.count({
        where: { 
          user_id: userId, 
          reservation_date: menu.date,
          status: { [Op.not]: 'cancelled' }
        }
      });
      if (dailyCount >= 2) throw new Error('Burslu öğrenciler günde en fazla 2 öğün alabilir.');
    } else {
      // ÜCRETLİ ÖĞRENCİ MANTIĞI
      if (parseFloat(menu.price) > 0) {
        wallet = await Wallet.findOne({ where: { user_id: userId } });
        if (!wallet || parseFloat(wallet.balance) < parseFloat(menu.price)) {
          throw new Error('Yetersiz bakiye');
        }
      }
    }

    // QR Kod yerine Random Token oluşturuyoruz (Attendance yapısındaki gibi)
    const qrToken = crypto.randomBytes(16).toString('hex');

    const reservation = await MealReservation.create({
      user_id: userId,
      menu_id: menuId,
      cafeteria_id: menu.cafeteria_id,
      reservation_date: menu.date,
      meal_type: menu.meal_type,
      qr_code: qrToken, // Resim değil, string kaydediyoruz
      status: 'reserved'
    }, { transaction: t });

    // Ödeme Alma (Sadece ücretliyse)
    if (!isScholarship && wallet) {
      const newBalance = parseFloat(wallet.balance) - parseFloat(menu.price);
      await wallet.update({ balance: newBalance }, { transaction: t });
      
      await Transaction.create({
        wallet_id: wallet.id,
        type: 'payment',
        amount: menu.price,
        balance_after: newBalance,
        description: `Yemek Rezervasyonu: ${menu.date}`,
        reference_id: reservation.id
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Rezervasyon İptali
exports.cancelReservation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const reservation = await MealReservation.findByPk(id, {
      include: [{ model: MealMenu }]
    });

    if (!reservation) throw new Error('Rezervasyon bulunamadı');
    if (reservation.user_id !== req.user.id) throw new Error('Yetkisiz işlem');
    if (reservation.status !== 'reserved') throw new Error('Sadece aktif rezervasyonlar iptal edilebilir');

    // Para iadesi (Eğer ücret ödediyse ve burslu değilse)
    if (parseFloat(reservation.MealMenu.price) > 0) {
       const student = await Student.findOne({ where: { userId: req.user.id } });
       // Sadece burslu olmayanlara iade yap (Burslular zaten ödemedi)
       if (!student || !student.is_scholarship) {
         const wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
         if (wallet) {
           const newBalance = parseFloat(wallet.balance) + parseFloat(reservation.MealMenu.price);
           await wallet.update({ balance: newBalance }, { transaction: t });
           
           await Transaction.create({
             wallet_id: wallet.id,
             type: 'refund',
             amount: reservation.MealMenu.price,
             balance_after: newBalance,
             description: `İade: Yemek İptali`,
             reference_id: reservation.id
           }, { transaction: t });
         }
       }
    }

    await reservation.update({ status: 'cancelled' }, { transaction: t });
    await t.commit();
    res.json({ success: true, message: 'Rezervasyon iptal edildi' });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: QR ile Yemek Kullanımı (Personel İçin)
exports.useReservation = async (req, res) => {
  try {
    const { userId, menuId } = req.body; 
    
    const reservation = await MealReservation.findOne({
      where: { 
        user_id: userId, 
        menu_id: menuId, 
        status: 'reserved' 
      }
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Geçerli rezervasyon bulunamadı.' });
    }

    // Tarih kontrolü: Bugün mü?
    const today = new Date().toISOString().split('T')[0];
    if (reservation.reservation_date !== today) {
      return res.status(400).json({ success: false, message: 'Rezervasyon bugüne ait değil.' });
    }

    await reservation.update({ 
      status: 'used', 
      used_at: new Date() 
    });

    res.json({ success: true, message: 'Afiyet olsun!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Menü Oluşturma (Admin/Personel)
exports.createMenu = async (req, res) => {
  try {
    const menu = await MealMenu.create(req.body);
    res.status(201).json({ success: true, data: menu });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Menü Güncelleme
exports.updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await MealMenu.findByPk(id);
    if (!menu) return res.status(404).json({ success: false, message: 'Menü bulunamadı' });

    await menu.update(req.body);
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Menü Silme
exports.deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await MealMenu.findByPk(id);
    if (!menu) return res.status(404).json({ success: false, message: 'Menü bulunamadı' });

    await menu.destroy();
    res.json({ success: true, message: 'Menü silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await MealReservation.findAll({
      where: { user_id: req.user.id },
      include: [{ model: MealMenu, include: [Cafeteria] }],
      order: [['reservation_date', 'DESC']]
    });
    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};