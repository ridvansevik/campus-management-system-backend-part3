const qrCodeService = require('../src/services/qrCodeService');

describe('Part 3: QR Code Service Unit Tests', () => {
  describe('generateToken', () => {
    it('should generate a token', () => {
      const token = qrCodeService.generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate token with prefix', () => {
      const token = qrCodeService.generateToken('meal');
      expect(token).toContain('meal');
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code from string', async () => {
      const qrCode = await qrCodeService.generateQRCode('test-data');
      expect(qrCode).toBeDefined();
      expect(typeof qrCode).toBe('string');
      expect(qrCode).toMatch(/^data:image/); // Base64 image
    });

    it('should generate QR code from object', async () => {
      const data = { u: 'user-id', m: 'menu-id', type: 'meal' };
      const qrCode = await qrCodeService.generateQRCode(data);
      expect(qrCode).toBeDefined();
      expect(qrCode).toMatch(/^data:image/);
    });
  });

  describe('parseQRData', () => {
    it('should parse JSON string', () => {
      const jsonString = '{"u":"user-id","m":"menu-id"}';
      const parsed = qrCodeService.parseQRData(jsonString);
      expect(parsed).toHaveProperty('u', 'user-id');
      expect(parsed).toHaveProperty('m', 'menu-id');
    });

    it('should return token object for non-JSON string', () => {
      const token = 'simple-token-123';
      const parsed = qrCodeService.parseQRData(token);
      expect(parsed).toHaveProperty('token', token);
    });
  });

  describe('validateQRCode', () => {
    it('should validate QR code with token', () => {
      const qrCode = 'test-token-123';
      const expectedData = { token: 'test-token-123' };
      const isValid = qrCodeService.validateQRCode(qrCode, expectedData);
      expect(isValid).toBe(true);
    });

    it('should validate QR code with user and event ID', () => {
      const qrCode = '{"u":"user-123","e":"event-456"}';
      const expectedData = { userId: 'user-123', eventId: 'event-456' };
      const isValid = qrCodeService.validateQRCode(qrCode, expectedData);
      expect(isValid).toBe(true);
    });

    it('should validate QR code with user and menu ID', () => {
      const qrCode = '{"u":"user-123","m":"menu-789"}';
      const expectedData = { userId: 'user-123', menuId: 'menu-789' };
      const isValid = qrCodeService.validateQRCode(qrCode, expectedData);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid QR code', () => {
      const qrCode = 'invalid-token';
      const expectedData = { token: 'different-token' };
      const isValid = qrCodeService.validateQRCode(qrCode, expectedData);
      expect(isValid).toBe(false);
    });

    it('should return false for mismatched data', () => {
      const qrCode = '{"u":"user-123","e":"event-456"}';
      const expectedData = { userId: 'different-user', eventId: 'event-456' };
      const isValid = qrCodeService.validateQRCode(qrCode, expectedData);
      expect(isValid).toBe(false);
    });
  });
});

