const { Wallet, Transaction, sequelize } = require('../models');

exports.getBalance = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
    
    // Cüzdan yoksa otomatik oluştur
    if (!wallet) {
      wallet = await Wallet.create({ user_id: req.user.id });
    }

    res.json({ success: true, data: wallet });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.topUpWallet = async (req, res) => {
  // Basitleştirilmiş mock ödeme işlemi
  const t = await sequelize.transaction();
  try {
    const { amount } = req.body;
    
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Geçersiz miktar" });
    }

    let wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
    if (!wallet) {
      wallet = await Wallet.create({ user_id: req.user.id }, { transaction: t });
    }

    const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
    
    await wallet.update({ balance: newBalance }, { transaction: t });

    await Transaction.create({
      wallet_id: wallet.id,
      type: 'deposit',
      amount: amount,
      balance_after: newBalance,
      description: 'Bakiye Yükleme (Kredi Kartı)'
    }, { transaction: t });

    await t.commit();
    res.json({ success: true, data: { balance: newBalance } });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
    if (!wallet) return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });

    const transactions = await Transaction.findAll({
      where: { wallet_id: wallet.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};