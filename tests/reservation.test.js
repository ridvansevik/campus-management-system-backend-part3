const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { Reservation, Classroom, User } = db;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 3: Classroom Reservation Tests', () => {
  let authToken;
  let adminToken;
  let userId;
  let classroomId;

  beforeAll(async () => {
    // Classroom oluştur
    const classroom = await Classroom.create({
      code: 'B201',
      capacity: 40,
      building: 'B Block'
    });
    classroomId = classroom.id;

    // Normal kullanıcı
    const user = await User.create({
      name: 'Reservation Test User',
      email: `reservation${Date.now()}@test.com`,
      password: 'Password123',
      role: 'student',
      is_verified: true
    });
    userId = user.id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Password123' });
    authToken = loginRes.body.data.accessToken;

    // Admin kullanıcı
    const admin = await User.create({
      name: 'Reservation Admin',
      email: `reservationadmin${Date.now()}@test.com`,
      password: 'Password123',
      role: 'admin',
      is_verified: true
    });

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = adminLoginRes.body.data.accessToken;
  });

  describe('POST /api/v1/reservations', () => {
    it('should create classroom reservation', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          classroomId,
          date,
          startTime: '10:00',
          endTime: '12:00',
          purpose: 'Study Group'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });

    it('should reject reservation if classroom is already booked', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      // İlk rezervasyon
      await Reservation.create({
        classroom_id: classroomId,
        user_id: userId,
        date,
        start_time: '10:00',
        end_time: '12:00',
        purpose: 'First Reservation',
        status: 'approved'
      });

      // Çakışan rezervasyon
      const res = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          classroomId,
          date,
          startTime: '11:00',
          endTime: '13:00',
          purpose: 'Conflicting Reservation'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/dolu/i);
    });
  });

  describe('GET /api/v1/reservations', () => {
    it('should get reservations with filters', async () => {
      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/v1/reservations?date=${date}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should filter by classroom', async () => {
      const res = await request(app)
        .get(`/api/v1/reservations?classroomId=${classroomId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/reservations?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should show only user reservations for non-admin', async () => {
      // Başka kullanıcının rezervasyonu
      const otherUser = await User.create({
        name: 'Other User',
        email: `other${Date.now()}@test.com`,
        password: 'Password123',
        role: 'student',
        is_verified: true
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      await Reservation.create({
        classroom_id: classroomId,
        user_id: otherUser.id,
        date,
        start_time: '14:00',
        end_time: '16:00',
        purpose: 'Other User Reservation',
        status: 'pending'
      });

      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      // Sadece kendi rezervasyonlarını görmeli
      res.body.data.forEach(reservation => {
        expect(reservation.user_id || reservation.requester?.id).toBe(userId);
      });
    });
  });

  describe('PUT /api/v1/reservations/:id/approve', () => {
    let reservationId;

    beforeAll(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const reservation = await Reservation.create({
        classroom_id: classroomId,
        user_id: userId,
        date,
        start_time: '14:00',
        end_time: '16:00',
        purpose: 'Approval Test',
        status: 'pending'
      });
      reservationId = reservation.id;
    });

    it('should approve reservation (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      // Status kontrolü
      const reservation = await Reservation.findByPk(reservationId);
      expect(reservation.status).toBe('approved');
      expect(reservation.approved_by).toBeTruthy();
    });

    it('should reject if not admin', async () => {
      // Yeni rezervasyon
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const reservation = await Reservation.create({
        classroom_id: classroomId,
        user_id: userId,
        date,
        start_time: '16:00',
        end_time: '18:00',
        purpose: 'Non-admin Test',
        status: 'pending'
      });

      const res = await request(app)
        .put(`/api/v1/reservations/${reservation.id}/approve`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('PUT /api/v1/reservations/:id/reject', () => {
    let reservationId;

    beforeAll(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const reservation = await Reservation.create({
        classroom_id: classroomId,
        user_id: userId,
        date,
        start_time: '18:00',
        end_time: '20:00',
        purpose: 'Rejection Test',
        status: 'pending'
      });
      reservationId = reservation.id;
    });

    it('should reject reservation (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      // Status kontrolü
      const reservation = await Reservation.findByPk(reservationId);
      expect(reservation.status).toBe('rejected');
    });
  });
});

