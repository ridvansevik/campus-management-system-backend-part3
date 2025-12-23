const { MealMenu, MealReservation, Wallet, Transaction, Cafeteria, sequelize, Student, User } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const crypto = require('crypto');
const qrCodeService = require('../services/qrCodeService');
const notificationService = require('../services/notificationService');

exports.getMenus = async (req, res) => {
  try {
    const { date } = req.query;
    const whereClause = {};
    if (date) whereClause.date = date;

    const menus = await MealMenu.findAll({
      where: whereClause,
      include: [{ model: Cafeteria }],
      order: [['date', 'DESC'], ['meal_type', 'ASC']]
    });
    res.json({ success: true, data: menus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Menü Detayı
exports.getMenuDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await MealMenu.findByPk(id, {
      include: [{ model: Cafeteria }]
    });
    
    if (!menu) {
      return res.status(404).json({ success: false, message: 'Menü bulunamadı' });
    }
    
    res.json({ success: true, data: menu });
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

    // QR Kod oluştur
    const qrToken = qrCodeService.generateToken('meal');
    const qrData = { u: userId, m: menuId, r: qrToken, type: 'meal' };
    const qrCode = await qrCodeService.generateQRCode(qrData);

    const reservation = await MealReservation.create({
      user_id: userId,
      menu_id: menuId,
      cafeteria_id: menu.cafeteria_id,
      reservation_date: menu.date,
      meal_type: menu.meal_type,
      amount: parseFloat(menu.price),
      qr_code: qrToken, // Token kaydediyoruz (QR görseli frontend'de oluşturulacak)
      status: 'reserved'
    }, { transaction: t });

    // Ödeme Alma (Sadece ücretliyse)
    // Part 3 gereksinimine göre: Pending transaction oluştur, kullanımda tamamla
    if (!isScholarship && wallet && parseFloat(menu.price) > 0) {
      // Pending transaction oluştur (henüz ödeme alınmadı)
      await Transaction.create({
        wallet_id: wallet.id,
        type: 'pending',
        amount: menu.price,
        balance_after: wallet.balance, // Bakiye değişmedi
        description: `Yemek Rezervasyonu (Beklemede): ${menu.date}`,
        reference_id: reservation.id,
        reference_type: 'meal_reservation'
      }, { transaction: t });
      
      // Bakiye kontrolü yap ama henüz düşme (kullanımda düşecek)
      if (parseFloat(wallet.balance) < parseFloat(menu.price)) {
        throw new Error('Yetersiz bakiye');
      }
    }

    await t.commit();

    // Email bildirimi gönder (async, hata olsa da devam et)
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await notificationService.sendReservationConfirmation(user, reservation, menu);
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

    res.status(201).json({ 
      success: true, 
      data: {
        ...reservation.toJSON(),
        qrCode // QR görseli frontend'e gönder
      }
    });
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

    // Part 3: 2 saat kontrolü - Yemek saatinden en az 2 saat önce iptal edilmeli
    const mealDateTime = moment(`${reservation.reservation_date} ${reservation.meal_type === 'lunch' ? '12:00' : '18:00'}`);
    const now = moment();
    const hoursUntilMeal = mealDateTime.diff(now, 'hours', true);
    
    if (hoursUntilMeal < 2) {
      throw new Error('Rezervasyonu iptal etmek için yemek saatinden en az 2 saat önce iptal etmelisiniz.');
    }

    // Pending transaction varsa sil
    const pendingTransaction = await Transaction.findOne({
      where: {
        reference_id: reservation.id,
        type: 'pending',
        reference_type: 'meal_reservation'
      },
      transaction: t
    });

    if (pendingTransaction) {
      // Pending transaction'ı sil (henüz ödeme alınmadığı için iade gerekmez)
      await pendingTransaction.destroy({ transaction: t });
    } else {
      // Eğer ödeme zaten alındıysa (pending değilse) iade yap
      const student = await Student.findOne({ where: { userId: req.user.id } });
      if (!student || !student.is_scholarship) {
        const wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
        if (wallet && parseFloat(reservation.amount) > 0) {
          const newBalance = parseFloat(wallet.balance) + parseFloat(reservation.amount);
          await wallet.update({ balance: newBalance }, { transaction: t });
          
          await Transaction.create({
            wallet_id: wallet.id,
            type: 'refund',
            amount: reservation.amount,
            balance_after: newBalance,
            description: `İade: Yemek İptali`,
            reference_id: reservation.id,
            reference_type: 'meal_reservation'
          }, { transaction: t });
        }
      }
    }

    await reservation.update({ status: 'cancelled' }, { transaction: t });
    await t.commit();

    // Email bildirimi
    try {
      const user = await User.findByPk(req.user.id);
      if (user) {
        await notificationService.sendReservationCancellation(user, reservation);
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

    res.json({ success: true, message: 'Rezervasyon iptal edildi' });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: QR ile Yemek Kullanımı (Personel İçin)
// Part 3: POST /api/v1/meals/reservations/:id/use
// Hem ID hem QR kod ile çalışabilir
exports.useReservation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params; // Route'dan gelen ID (opsiyonel)
    const { qrCode } = req.body; // Body'den gelen QR kod (opsiyonel)

    let reservation;

    // Eğer route /reservations/use ise (id yok), direkt QR kod ile ara
    // Eğer route /reservations/:id/use ise, önce ID ile dene
    if (!id || id === 'use') {
      // QR kod ile kullanım (route: /reservations/use)
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

      // QR kod formatı: {"u":"userId","m":"menuId","r":"token","type":"meal"}
      // Token'ı bul: önce r, sonra token, son olarak direkt qrCode
      const qrToken = qrData.r || qrData.token || qrCode;
      
      console.log('QR kod parse edildi:', { qrData, qrToken }); // Debug için

      // Rezervasyonu bul (QR token ile)
      reservation = await MealReservation.findOne({
        where: { 
          qr_code: qrToken,
          status: 'reserved' 
        },
        include: [
          { model: MealMenu },
          { model: User, attributes: ['id', 'name', 'email'] }
        ],
        transaction: t
      });
      
      if (!reservation) {
        console.log('Rezervasyon bulunamadı. Token:', qrToken, 'QR Code:', qrCode); // Debug için
      }
    } else {
      // ID ile kullanım (route: /reservations/:id/use)
      // ID ile bul
      reservation = await MealReservation.findByPk(id, {
        include: [
          { model: MealMenu },
          { model: User, attributes: ['id', 'name', 'email'] }
        ],
        transaction: t
      });
    }

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Geçerli rezervasyon bulunamadı.' });
    }

    // Tarih kontrolü: Bugün mü?
    const today = new Date().toISOString().split('T')[0];
    if (reservation.reservation_date !== today) {
      return res.status(400).json({ 
        success: false, 
        message: `Rezervasyon bugüne ait değil. Rezervasyon tarihi: ${reservation.reservation_date}` 
      });
    }

    // Zaten kullanılmış mı kontrolü
    if (reservation.status === 'used') {
      return res.status(400).json({ success: false, message: 'Bu rezervasyon zaten kullanılmış.' });
    }

    // Kullanımı işaretle
    await reservation.update({ 
      status: 'used', 
      used_at: new Date() 
    }, { transaction: t });

    // Eğer ücretli öğrenciyse, pending transaction'ı tamamla ve bakiyeden düş
    const student = await Student.findOne({ 
      where: { userId: reservation.user_id },
      transaction: t
    });

    // Burslu değilse (ücretli öğrenci) veya student yoksa (faculty/admin) ücret ödenmeli
    if (!student || !student.is_scholarship) {
      // Pending transaction bul
      const pendingTransaction = await Transaction.findOne({
        where: {
          reference_id: reservation.id,
          type: 'pending',
          reference_type: 'meal_reservation'
        },
        transaction: t
      });

      if (pendingTransaction && parseFloat(reservation.amount) > 0) {
        // Wallet'ı bul veya oluştur
        let wallet = await Wallet.findOne({ 
          where: { user_id: reservation.user_id },
          transaction: t
        });

        if (!wallet) {
          wallet = await Wallet.create({ 
            user_id: reservation.user_id,
            balance: 0
          }, { transaction: t });
        }

        const currentBalance = parseFloat(wallet.balance);
        const amountToDeduct = parseFloat(reservation.amount);
        const newBalance = currentBalance - amountToDeduct;
        
        if (newBalance < 0) {
          throw new Error('Yetersiz bakiye (kullanım sırasında)');
        }

        // Bakiye güncelle
        await wallet.update({ balance: newBalance }, { transaction: t });
        
        // Pending transaction'ı payment'a çevir (ödeme tamamlandı)
        await pendingTransaction.update({
          type: 'payment',
          balance_after: newBalance,
          description: `Yemek Kullanımı: ${reservation.reservation_date} - ${reservation.MealMenu?.meal_type === 'lunch' ? 'Öğle' : 'Akşam'}`
        }, { transaction: t });

        console.log(`Yemek kullanımı: ${amountToDeduct} TRY düşüldü. Yeni bakiye: ${newBalance} TRY`);
      } else if (!pendingTransaction && parseFloat(reservation.amount) > 0) {
        // Pending transaction yoksa ama ücretli ise, direkt düş (eski rezervasyonlar için)
        console.warn(`Pending transaction bulunamadı rezervasyon ID: ${reservation.id}, direkt ödeme alınıyor.`);
        
        let wallet = await Wallet.findOne({ 
          where: { user_id: reservation.user_id },
          transaction: t
        });

        if (!wallet) {
          wallet = await Wallet.create({ 
            user_id: reservation.user_id,
            balance: 0
          }, { transaction: t });
        }

        const currentBalance = parseFloat(wallet.balance);
        const amountToDeduct = parseFloat(reservation.amount);
        const newBalance = currentBalance - amountToDeduct;
        
        if (newBalance < 0) {
          throw new Error('Yetersiz bakiye');
        }

        await wallet.update({ balance: newBalance }, { transaction: t });
        
        // Yeni transaction kaydı oluştur
        await Transaction.create({
          wallet_id: wallet.id,
          type: 'payment',
          amount: amountToDeduct,
          balance_after: newBalance,
          description: `Yemek Kullanımı: ${reservation.reservation_date}`,
          reference_id: reservation.id,
          reference_type: 'meal_reservation'
        }, { transaction: t });
      }
    }

    await t.commit();

    res.json({ 
      success: true, 
      message: 'Afiyet olsun!',
      data: {
        user: reservation.User,
        mealType: reservation.meal_type,
        date: reservation.reservation_date
      }
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Cafeteria Listesi (Admin/Personel için)
exports.getCafeterias = async (req, res) => {
  try {
    const cafeterias = await Cafeteria.findAll({
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: cafeterias });
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
      include: [
        { 
          model: MealMenu,
          include: [{ model: Cafeteria }]
        }
      ],
      order: [['reservation_date', 'DESC'], ['createdAt', 'DESC']]
    });

    // Her rezervasyon için QR kod görseli oluştur (frontend'de görüntülemek için)
    const reservationsWithQR = await Promise.all(
      reservations.map(async (reservation) => {
        const reservationData = reservation.toJSON();
        
        // QR kod verisini oluştur (JSON string)
        const qrData = {
          u: reservation.user_id,
          m: reservation.menu_id,
          r: reservation.qr_code,
          type: 'meal'
        };
        
        // QR kod görseli oluştur (base64)
        try {
          const qrCodeImage = await qrCodeService.generateQRCode(qrData);
          reservationData.qrCode = qrCodeImage; // Base64 image
        } catch (qrError) {
          console.error('QR kod oluşturma hatası:', qrError);
          // QR kod oluşturulamazsa devam et
        }
        
        return reservationData;
      })
    );

    res.json({ success: true, data: reservationsWithQR });
  } catch (error) {
    console.error('getMyReservations hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};