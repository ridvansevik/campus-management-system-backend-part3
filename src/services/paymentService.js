/**
 * Payment Service
 * Payment gateway entegrasyonu (Stripe/PayTR)
 * 
 * Not: Bu servis test modunda çalışır. Production'da gerçek API key'ler kullanılmalı.
 */

/**
 * Payment session oluştur (Stripe veya PayTR)
 * @param {Number} amount - Ödeme tutarı
 * @param {String} userId - Kullanıcı ID
 * @param {String} description - İşlem açıklaması
 * @returns {Object} Payment session bilgileri
 */
exports.createPaymentSession = async (amount, userId, description = 'Bakiye Yükleme') => {
  try {
    // Minimum tutar kontrolü
    const MIN_AMOUNT = 50;
    if (amount < MIN_AMOUNT) {
      throw new Error(`Minimum yükleme tutarı ${MIN_AMOUNT} TRY'dir.`);
    }

    // Payment gateway seçimi (environment variable'dan)
    const paymentGateway = process.env.PAYMENT_GATEWAY || 'mock'; // 'stripe', 'paytr', 'mock'

    if (paymentGateway === 'mock') {
      // Mock payment - test için
      const sessionId = `mock_${Date.now()}_${userId}`;
      return {
        success: true,
        paymentUrl: `${process.env.FRONTEND_URL}/payment/success?session_id=${sessionId}&amount=${amount}`,
        sessionId: sessionId,
        amount,
        gateway: 'mock'
      };
    }

    if (paymentGateway === 'stripe') {
      // Stripe entegrasyonu
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'try',
            product_data: {
              name: description,
            },
            unit_amount: Math.round(amount * 100), // Stripe kuruş cinsinden
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/wallet?canceled=true`,
        metadata: {
          userId,
          type: 'wallet_topup'
        }
      });

      return {
        success: true,
        paymentUrl: session.url,
        sessionId: session.id,
        amount,
        gateway: 'stripe'
      };
    }

    if (paymentGateway === 'paytr') {
      // PayTR entegrasyonu (Türk ödeme sistemi)
      // PayTR API dokümantasyonuna göre implement edilmeli
      // Şimdilik mock döndürüyoruz
      return {
        success: true,
        paymentUrl: `${process.env.PAYTR_IFRAME_URL}?token=mock_token_${Date.now()}`,
        sessionId: `paytr_${Date.now()}_${userId}`,
        amount,
        gateway: 'paytr'
      };
    }

    throw new Error('Geçersiz payment gateway');
  } catch (error) {
    throw new Error(`Ödeme oturumu oluşturma hatası: ${error.message}`);
  }
};

/**
 * Webhook signature doğrulama (Stripe)
 * @param {String} signature - Webhook signature
 * @param {String} payload - Request body
 * @returns {Boolean} Doğrulama sonucu
 */
exports.verifyWebhookSignature = (signature, payload) => {
  try {
    const paymentGateway = process.env.PAYMENT_GATEWAY || 'mock';
    
    if (paymentGateway === 'mock') {
      // Mock için her zaman true döndür
      return true;
    }

    if (paymentGateway === 'stripe') {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      try {
        const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        return event;
      } catch (err) {
        return false;
      }
    }

    // PayTR için hash kontrolü yapılmalı
    if (paymentGateway === 'paytr') {
      // PayTR hash doğrulama implementasyonu
      return true; // Şimdilik true
    }

    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Ödeme başarılı olduğunda çağrılır
 * @param {String} sessionId - Payment session ID
 * @param {String} userId - Kullanıcı ID
 * @returns {Object} Ödeme bilgileri
 */
exports.handlePaymentSuccess = async (sessionId, userId) => {
  try {
    const paymentGateway = process.env.PAYMENT_GATEWAY || 'mock';
    
    if (paymentGateway === 'mock') {
      // Mock payment - sessionId'den amount'u parse et
      // Format: mock_TIMESTAMP_USERID veya sessionId'den amount'u al
      // Eğer sessionId'de amount yoksa, pending transaction'dan al
      try {
        // SessionId formatı: mock_TIMESTAMP veya mock_TIMESTAMP_USERID
        // Amount'u pending transaction'dan almak daha doğru
        const { Transaction } = require('../models');
        const pendingTransaction = await Transaction.findOne({
          where: {
            reference_id: sessionId,
            type: 'pending',
            reference_type: 'payment_gateway'
          },
          order: [['createdAt', 'DESC']]
        });
        
        if (pendingTransaction) {
          return {
            success: true,
            amount: parseFloat(pendingTransaction.amount),
            sessionId
          };
        }
        
        // Fallback: 100 TRY (test için)
        return {
          success: true,
          amount: 100,
          sessionId
        };
      } catch (error) {
        console.error('Mock payment amount parse hatası:', error);
        return {
          success: true,
          amount: 100, // Fallback
          sessionId
        };
      }
    }

    if (paymentGateway === 'stripe') {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        return {
          success: true,
          amount: session.amount_total / 100, // Kuruştan liraya
          sessionId
        };
      }
    }

    return { success: false };
  } catch (error) {
    throw new Error(`Ödeme işleme hatası: ${error.message}`);
  }
};

