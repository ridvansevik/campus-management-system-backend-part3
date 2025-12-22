const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * QR Code Service
 * QR kod oluşturma ve doğrulama işlemleri
 */

/**
 * QR kod oluştur (UUID veya JSON string)
 * @param {Object|String} data - QR kod içeriği
 * @returns {Promise<String>} QR kod string (base64 image veya UUID)
 */
exports.generateQRCode = async (data) => {
  try {
    // Eğer data object ise JSON string'e çevir
    const qrData = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // QR kod görseli oluştur (base64)
    const qrImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300
    });
    
    return qrImage;
  } catch (error) {
    throw new Error(`QR kod oluşturma hatası: ${error.message}`);
  }
};

/**
 * Basit token oluştur (UUID benzeri)
 * @param {String} prefix - Token öneki (opsiyonel)
 * @returns {String} Random token
 */
exports.generateToken = (prefix = '') => {
  const token = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${token}` : token;
};

/**
 * QR kod verisini parse et
 * @param {String} qrCode - QR kod string (JSON veya UUID)
 * @returns {Object} Parsed data
 */
exports.parseQRData = (qrCode) => {
  try {
    // Eğer base64 image ise, önce decode et (şimdilik basit token kullanıyoruz)
    // Gerçek implementasyonda QR scanner'dan gelen data parse edilir
    
    // JSON string ise parse et
    if (qrCode.startsWith('{')) {
      const parsed = JSON.parse(qrCode);
      // QR kod formatı: {"u":"userId","m":"menuId","r":"token","type":"meal"}
      // Token'ı hem r hem de token olarak erişilebilir yap
      if (parsed.r && !parsed.token) {
        parsed.token = parsed.r;
      }
      return parsed;
    }
    
    // UUID/token ise direkt döndür
    return { token: qrCode, r: qrCode };
  } catch (error) {
    throw new Error(`QR kod parse hatası: ${error.message}`);
  }
};

/**
 * QR kod doğrula
 * @param {String} qrCode - QR kod string
 * @param {Object} expectedData - Beklenen veri
 * @returns {Boolean} Doğrulama sonucu
 */
exports.validateQRCode = (qrCode, expectedData) => {
  try {
    const parsed = this.parseQRData(qrCode);
    
    // Token karşılaştırması
    if (expectedData.token && parsed.token === expectedData.token) {
      return true;
    }
    
    // JSON data karşılaştırması
    if (expectedData.userId && parsed.u === expectedData.userId) {
      if (expectedData.eventId && parsed.e === expectedData.eventId) {
        return true;
      }
      if (expectedData.menuId && parsed.m === expectedData.menuId) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

