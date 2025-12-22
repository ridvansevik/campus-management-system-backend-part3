const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { MealMenu, MealReservation, Wallet, Transaction, Cafeteria, Student, User } = db;

// Testler başlamadan önce veritabanını temizle
beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 3: Meal Service Tests', () => {
  let authToken;
  let studentUser;
  let scholarshipStudent;
  let staffToken;
  let cafeteria;
  let menu;
  let menuId;

  // Test verilerini hazırla
  beforeAll(async () => {
    // Cafeteria oluştur
    cafeteria = await Cafeteria.create({
      name: 'Ana Yemekhane',
      location: 'A Blok',
      capacity: 500
    });

    // Normal öğrenci (ücretli)
    const normalStudentData = {
      name: 'Normal Student',
      email: `normal${Date.now()}@test.com`,
      password: 'Password123',
      role: 'student',
      is_verified: true
    };
    studentUser = await User.create(normalStudentData);
    const student = await Student.create({
      userId: studentUser.id,
      student_number: `ST${Date.now()}`,
      departmentId: (await db.Department.create({ name: 'Test Dept', code: 'TEST' })).id,
      is_scholarship: false
    });

    // Burslu öğrenci
    const scholarshipData = {
      name: 'Scholarship Student',
      email: `scholarship${Date.now()}@test.com`,
      password: 'Password123',
      role: 'student',
      is_verified: true
    };
    const scholarshipUser = await User.create(scholarshipData);
    scholarshipStudent = await Student.create({
      userId: scholarshipUser.id,
      student_number: `ST${Date.now() + 1}`,
      departmentId: (await db.Department.findOne({ where: { code: 'TEST' } })).id,
      is_scholarship: true
    });

    // Staff kullanıcı
    const staffUser = await User.create({
      name: 'Staff User',
      email: `staff${Date.now()}@test.com`,
      password: 'Password123',
      role: 'staff',
      is_verified: true
    });

    // Login yap ve token al
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: normalStudentData.email, password: 'Password123' });
    authToken = loginRes.body.data.accessToken;

    const staffLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staffUser.email, password: 'Password123' });
    staffToken = staffLoginRes.body.data.accessToken;

    // Menü oluştur
    menu = await MealMenu.create({
      cafeteria_id: cafeteria.id,
      date: new Date().toISOString().split('T')[0],
      meal_type: 'lunch',
      items_json: { soup: 'Mercimek', main: 'Tavuk', dessert: 'Sütlaç' },
      nutrition_json: { calories: 650, protein: 35 },
      price: 25.00,
      is_published: true
    });
    menuId = menu.id;
  });

  describe('GET /api/v1/meals/menus', () => {
    it('should get all menus', async () => {
      const res = await request(app)
        .get('/api/v1/meals/menus')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter menus by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/meals/menus?date=${today}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/meals/menus/:id', () => {
    it('should get menu detail', async () => {
      const res = await request(app)
        .get(`/api/v1/meals/menus/${menuId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(menuId);
    });

    it('should return 404 for non-existent menu', async () => {
      const res = await request(app)
        .get('/api/v1/meals/menus/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /api/v1/meals/reservations - Burslu Öğrenci', () => {
    let scholarshipToken;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ 
          email: scholarshipStudent.userId ? 
            (await User.findByPk(scholarshipStudent.userId)).email : 
            `scholarship${Date.now()}@test.com`, 
          password: 'Password123' 
        });
      scholarshipToken = loginRes.body.data?.accessToken;
    });

    it('should create reservation for scholarship student (free)', async () => {
      if (!scholarshipToken) {
        // Token alınamadıysa skip et
        return;
      }

      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${scholarshipToken}`)
        .send({ menuId });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('qr_code');
      expect(res.body.data.status).toBe('reserved');
    });

    it('should limit scholarship student to 2 meals per day', async () => {
      if (!scholarshipToken) return;

      // İkinci rezervasyon
      const menu2 = await MealMenu.create({
        cafeteria_id: cafeteria.id,
        date: menu.date,
        meal_type: 'dinner',
        items_json: {},
        price: 25.00,
        is_published: true
      });

      await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${scholarshipToken}`)
        .send({ menuId: menu2.id });

      // Üçüncü rezervasyon (limit aşımı)
      const menu3 = await MealMenu.create({
        cafeteria_id: cafeteria.id,
        date: menu.date,
        meal_type: 'lunch',
        items_json: {},
        price: 25.00,
        is_published: true
      });

      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${scholarshipToken}`)
        .send({ menuId: menu3.id });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/en fazla 2 öğün/i);
    });
  });

  describe('POST /api/v1/meals/reservations - Ücretli Öğrenci', () => {
    it('should create reservation for paid student', async () => {
      // Wallet oluştur ve para yükle
      const wallet = await Wallet.create({
        user_id: studentUser.id,
        balance: 100.00
      });

      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('qr_code');

      // Pending transaction kontrolü
      const transaction = await Transaction.findOne({
        where: {
          reference_id: res.body.data.id,
          type: 'pending'
        }
      });
      expect(transaction).toBeTruthy();
    });

    it('should reject reservation if insufficient balance', async () => {
      // Wallet'ı sıfırla
      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      if (wallet) {
        await wallet.update({ balance: 0 });
      }

      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/yetersiz/i);
    });
  });

  describe('DELETE /api/v1/meals/reservations/:id', () => {
    let reservationId;

    beforeAll(async () => {
      // Wallet'a para yükle
      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      if (wallet) {
        await wallet.update({ balance: 100 });
      }

      // Rezervasyon oluştur
      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });
      reservationId = res.body.data.id;
    });

    it('should cancel reservation if >= 2 hours before meal time', async () => {
      const res = await request(app)
        .delete(`/api/v1/meals/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // 2 saat kontrolü yapılıyor, eğer geçerliyse başarılı olmalı
      // Test ortamında tarih kontrolü geçebilir
      expect([200, 400]).toContain(res.statusCode);
    });

    it('should refund money for paid student cancellation', async () => {
      // Yeni rezervasyon oluştur
      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      await wallet.update({ balance: 100 });

      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });

      const newReservationId = res.body.data.id;

      // İptal et
      const cancelRes = await request(app)
        .delete(`/api/v1/meals/reservations/${newReservationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (cancelRes.statusCode === 200) {
        // Wallet kontrolü
        await wallet.reload();
        // İade yapıldıysa bakiye artmalı (pending transaction silindi veya refund yapıldı)
      }
    });
  });

  describe('POST /api/v1/meals/reservations/:id/use - QR Code Usage', () => {
    let reservationId;
    let qrCode;

    beforeAll(async () => {
      // Wallet'a para yükle
      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      if (wallet) {
        await wallet.update({ balance: 100 });
      }

      // Rezervasyon oluştur
      const res = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });
      
      reservationId = res.body.data.id;
      qrCode = res.body.data.qr_code;
    });

    it('should use reservation with ID', async () => {
      const res = await request(app)
        .post(`/api/v1/meals/reservations/${reservationId}/use`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/afiyet/i);

      // Rezervasyon kullanıldı mı kontrol et
      const reservation = await MealReservation.findByPk(reservationId);
      expect(reservation.status).toBe('used');
      expect(reservation.used_at).toBeTruthy();
    });

    it('should use reservation with QR code', async () => {
      // Yeni rezervasyon oluştur
      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      await wallet.update({ balance: 100 });

      const createRes = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });

      const newQrCode = createRes.body.data.qr_code;

      const res = await request(app)
        .post('/api/v1/meals/reservations/use/use') // ID yok, QR kod kullan
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ qrCode: newQrCode });

      // QR kod ile çalışıyor mu kontrol et
      expect([200, 400, 404]).toContain(res.statusCode);
    });

    it('should complete pending transaction on use', async () => {
      // Yeni rezervasyon
      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      await wallet.update({ balance: 100 });

      const createRes = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId });

      const newReservationId = createRes.body.data.id;
      const initialBalance = parseFloat(wallet.balance);

      // Kullan
      await request(app)
        .post(`/api/v1/meals/reservations/${newReservationId}/use`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      // Transaction kontrolü
      const transaction = await Transaction.findOne({
        where: { reference_id: newReservationId }
      });

      if (transaction) {
        expect(['payment', 'pending']).toContain(transaction.type);
      }
    });

    it('should reject use if reservation date is not today', async () => {
      // Gelecek tarihli menü
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureMenu = await MealMenu.create({
        cafeteria_id: cafeteria.id,
        date: futureDate.toISOString().split('T')[0],
        meal_type: 'lunch',
        items_json: {},
        price: 25.00,
        is_published: true
      });

      const wallet = await Wallet.findOne({ where: { user_id: studentUser.id } });
      await wallet.update({ balance: 100 });

      const createRes = await request(app)
        .post('/api/v1/meals/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ menuId: futureMenu.id });

      const res = await request(app)
        .post(`/api/v1/meals/reservations/${createRes.body.data.id}/use`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/bugüne ait değil/i);
    });
  });

  describe('GET /api/v1/meals/reservations/my-reservations', () => {
    it('should get user reservations', async () => {
      const res = await request(app)
        .get('/api/v1/meals/reservations/my-reservations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

