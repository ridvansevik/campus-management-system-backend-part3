const { Equipment, Loan, User } = require('../models');
const { Op } = require('sequelize');

// Tüm ekipmanları listele
exports.getAllEquipment = async (req, res) => {
  try {
    const equipment = await Equipment.findAll();
    res.json({ success: true, data: equipment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Ekipman Ödünç Al (Loan)
exports.borrowEquipment = async (req, res) => {
  try {
    const { equipmentId, dueDate } = req.body;
    const userId = req.user.id;

    const item = await Equipment.findByPk(equipmentId);
    if (!item || item.status !== 'available') {
      return res.status(400).json({ success: false, message: 'Ekipman mevcut değil veya müsait değil.' });
    }

    const loan = await Loan.create({
      userId,
      equipmentId,
      dueDate
    });

    // Ekipman durumunu güncelle
    await item.update({ status: 'borrowed' });

    res.status(201).json({ success: true, data: loan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Ekipman İade Et (Return)
exports.returnEquipment = async (req, res) => {
  try {
    const { loanId } = req.body;
    
    const loan = await Loan.findByPk(loanId, { include: ['equipment'] });
    if (!loan || loan.status === 'returned') {
      return res.status(404).json({ success: false, message: 'Aktif ödünç kaydı bulunamadı.' });
    }

    // İade işlemini kaydet
    await loan.update({ 
      returnDate: new Date(),
      status: 'returned'
    });

    // Ekipmanı tekrar boşa çıkar
    if (loan.equipment) {
      await loan.equipment.update({ status: 'available' });
    }

    res.json({ success: true, message: 'Ekipman başarıyla iade alındı.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};