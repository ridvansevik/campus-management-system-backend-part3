const { Wallet, Transaction, sequelize, User } = require('../models');
const paymentService = require('../services/paymentService');
const notificationService = require('../services/notificationService');

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
  try {
    const { amount } = req.body;
    
    // Minimum tutar kontrolü
    const MIN_AMOUNT = 50;
    if (!amount || amount < MIN_AMOUNT) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum yükleme tutarı ${MIN_AMOUNT} TRY'dir.` 
      });
    }

    // Payment session oluştur
    const paymentSession = await paymentService.createPaymentSession(
      amount,
      req.user.id,
      'Cüzdan Bakiye Yükleme'
    );

    // Mock payment için pending transaction oluştur (webhook için)
    if (process.env.PAYMENT_GATEWAY === 'mock' || !process.env.PAYMENT_GATEWAY) {
      let wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
      if (!wallet) {
        wallet = await Wallet.create({ user_id: req.user.id });
      }
      
      await Transaction.create({
        wallet_id: wallet.id,
        type: 'pending',
        amount: amount,
        balance_after: parseFloat(wallet.balance),
        description: `Bakiye Yükleme Bekleniyor (Ödeme ID: ${paymentSession.sessionId})`,
        reference_id: paymentSession.sessionId,
        reference_type: 'payment_gateway'
      });
    }

    res.json({ 
      success: true, 
      data: {
        paymentUrl: paymentSession.paymentUrl,
        sessionId: paymentSession.sessionId,
        amount: paymentSession.amount
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// YENİ: Payment webhook endpoint
exports.handlePaymentWebhook = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const signature = req.headers['stripe-signature'] || req.headers['x-paytr-signature'] || '';
    const payload = JSON.stringify(req.body);
    const isMockPayment = req.body.gateway === 'mock' || (req.body.session_id && req.body.session_id.startsWith('mock_'));

    // Signature doğrula (mock payment için atla)
    if (!isMockPayment) {
      const verified = paymentService.verifyWebhookSignature(signature, payload);
      if (!verified) {
        return res.status(400).json({ success: false, message: 'Geçersiz signature' });
      }
    }

    // Payment başarılı mı kontrol et
    const sessionId = req.body.session_id || req.body.id || req.body.data?.object?.id;
    // Mock payment için userId'yi body'den al, diğerleri için metadata'dan
    let userId = isMockPayment 
      ? (req.body.userId || (sessionId && sessionId.split('_').length > 2 ? sessionId.split('_')[2] : null))
      : (req.body.metadata?.userId || req.body.userId);

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID gerekli' });
    }

    // Mock payment için userId yoksa, pending transaction'dan bul
    if (!userId && isMockPayment) {
      const pendingTx = await Transaction.findOne({
        where: {
          reference_id: sessionId,
          type: 'pending',
          reference_type: 'payment_gateway'
        },
        include: [{ model: Wallet, as: 'wallet' }]
      });
      if (pendingTx && pendingTx.wallet) {
        userId = pendingTx.wallet.user_id;
      }
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID bulunamadı' });
    }

    // Payment durumunu kontrol et
    const paymentResult = await paymentService.handlePaymentSuccess(sessionId, userId);
    
    if (!paymentResult.success) {
      return res.status(400).json({ success: false, message: 'Ödeme başarısız' });
    }

    // Wallet'a para yükle
    let wallet = await Wallet.findOne({ 
      where: { user_id: userId },
      transaction: t
    });

    if (!wallet) {
      wallet = await Wallet.create({ user_id: userId }, { transaction: t });
    }

    // Pending transaction'ı bul ve tamamla
    const pendingTransaction = await Transaction.findOne({
      where: {
        reference_id: sessionId,
        type: 'pending',
        reference_type: 'payment_gateway',
        wallet_id: wallet.id
      },
      transaction: t
    });

    if (pendingTransaction) {
      // Pending transaction'ı güncelle
      await pendingTransaction.update({
        type: 'deposit',
        balance_after: parseFloat(wallet.balance) + parseFloat(paymentResult.amount),
        description: 'Bakiye Yükleme (Kredi Kartı)'
      }, { transaction: t });
    } else {
      // Yeni transaction kaydı oluştur
      await Transaction.create({
        wallet_id: wallet.id,
        type: 'deposit',
        amount: paymentResult.amount,
        balance_after: parseFloat(wallet.balance) + parseFloat(paymentResult.amount),
        description: 'Bakiye Yükleme (Kredi Kartı)',
        reference_id: sessionId,
        reference_type: 'wallet_topup'
      }, { transaction: t });
    }

    const newBalance = parseFloat(wallet.balance) + parseFloat(paymentResult.amount);
    await wallet.update({ balance: newBalance }, { transaction: t });

    await t.commit();

    // Email bildirimi
    try {
      const user = await User.findByPk(userId);
      if (user) {
        await notificationService.sendPaymentConfirmation(user, paymentResult.amount, 'deposit');
      }
    } catch (emailError) {
      console.error('Email gönderim hatası:', emailError);
    }

    res.json({ success: true, message: 'Ödeme başarıyla işlendi' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ where: { user_id: req.user.id } });
    if (!wallet) return res.status(404).json({ success: false, message: "Cüzdan bulunamadı" });

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where: { wallet_id: wallet.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({ 
      success: true, 
      data: transactions,
      pagination: {
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};