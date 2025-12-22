const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { Event, EventRegistration, User } = db;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 3: Event Management Tests', () => {
  let authToken;
  let adminToken;
  let userId;
  let eventId;

  beforeAll(async () => {
    // Normal kullanıcı
    const user = await User.create({
      name: 'Event Test User',
      email: `event${Date.now()}@test.com`,
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
      name: 'Admin User',
      email: `admin${Date.now()}@test.com`,
      password: 'Password123',
      role: 'admin',
      is_verified: true
    });

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = adminLoginRes.body.data.accessToken;

    // Test event oluştur
    const event = await Event.create({
      title: 'Test Event',
      description: 'Test Description',
      category: 'Conference',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 gün sonra
      start_time: '10:00',
      end_time: '12:00',
      location: 'A101',
      capacity: 50,
      registration_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_paid: false,
      price: 0,
      status: 'active'
    });
    eventId = event.id;
  });

  describe('GET /api/v1/events', () => {
    it('should get all events', async () => {
      const res = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should filter events by category', async () => {
      const res = await request(app)
        .get('/api/v1/events?category=Conference')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].category).toBe('Conference');
      }
    });

    it('should search events by title', async () => {
      const res = await request(app)
        .get('/api/v1/events?search=Test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should filter events by date', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/events?date=${futureDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('GET /api/v1/events/:id', () => {
    it('should get event detail', async () => {
      const res = await request(app)
        .get(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(eventId);
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app)
        .get('/api/v1/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /api/v1/events/:eventId/register', () => {
    it('should register user to event', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${eventId}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('qr_code');
      expect(res.body.data).toHaveProperty('qrCode'); // QR görseli

      // Event registered_count artmalı
      const event = await Event.findByPk(eventId);
      expect(event.registered_count).toBeGreaterThan(0);
    });

    it('should reject duplicate registration', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${eventId}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/zaten kayıtl/i);
    });

    it('should reject registration after deadline', async () => {
      // Deadline geçmiş event
      const pastEvent = await Event.create({
        title: 'Past Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '12:00',
        location: 'A102',
        capacity: 50,
        registration_deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Dün
        status: 'active'
      });

      const res = await request(app)
        .post(`/api/v1/events/${pastEvent.id}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/son tarih/i);
    });

    it('should reject registration if capacity full', async () => {
      // Kapasitesi 1 olan event
      const smallEvent = await Event.create({
        title: 'Small Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '12:00',
        location: 'A103',
        capacity: 1,
        registration_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active'
      });

      // İlk kayıt
      const newUser = await User.create({
        name: 'New User',
        email: `new${Date.now()}@test.com`,
        password: 'Password123',
        role: 'student',
        is_verified: true
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: newUser.email, password: 'Password123' });
      const newToken = loginRes.body.data.accessToken;

      await request(app)
        .post(`/api/v1/events/${smallEvent.id}/register`)
        .set('Authorization', `Bearer ${newToken}`)
        .send({});

      // İkinci kayıt (kapasite dolu)
      const res = await request(app)
        .post(`/api/v1/events/${smallEvent.id}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/kontenjan|dolu/i);
    });
  });

  describe('DELETE /api/v1/events/registrations/:id', () => {
    let registrationId;

    beforeAll(async () => {
      // Yeni event ve kayıt
      const newEvent = await Event.create({
        title: 'Cancel Test Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '12:00',
        location: 'A104',
        capacity: 50,
        registration_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active'
      });

      const regRes = await request(app)
        .post(`/api/v1/events/${newEvent.id}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      registrationId = regRes.body.data.id;
    });

    it('should cancel event registration', async () => {
      const res = await request(app)
        .delete(`/api/v1/events/registrations/${registrationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      // Registration silinmeli
      const registration = await EventRegistration.findByPk(registrationId);
      expect(registration).toBeNull();
    });

    it('should reject cancellation if already checked in', async () => {
      // Check-in yapılmış kayıt
      const newEvent = await Event.create({
        title: 'Checked In Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '12:00',
        location: 'A105',
        capacity: 50,
        status: 'active'
      });

      const regRes = await request(app)
        .post(`/api/v1/events/${newEvent.id}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const regId = regRes.body.data.id;

      // Check-in yap
      await EventRegistration.update(
        { checked_in: true, checked_in_at: new Date() },
        { where: { id: regId } }
      );

      // İptal etmeyi dene
      const res = await request(app)
        .delete(`/api/v1/events/registrations/${regId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/giriş yapılmış/i);
    });
  });

  describe('POST /api/v1/events/:eventId/registrations/:registrationId/checkin', () => {
    let checkInEventId;
    let checkInRegistrationId;

    beforeAll(async () => {
      const event = await Event.create({
        title: 'Check-in Test Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '12:00',
        location: 'A106',
        capacity: 50,
        status: 'active'
      });
      checkInEventId = event.id;

      const regRes = await request(app)
        .post(`/api/v1/events/${checkInEventId}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      checkInRegistrationId = regRes.body.data.id;
    });

    it('should check in user with registration ID', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${checkInEventId}/registrations/${checkInRegistrationId}/checkin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      // Check-in yapıldı mı kontrol et
      const registration = await EventRegistration.findByPk(checkInRegistrationId);
      expect(registration.checked_in).toBe(true);
      expect(registration.checked_in_at).toBeTruthy();
    });

    it('should check in user with QR code', async () => {
      // Yeni kayıt
      const newEvent = await Event.create({
        title: 'QR Check-in Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '12:00',
        location: 'A107',
        capacity: 50,
        status: 'active'
      });

      const regRes = await request(app)
        .post(`/api/v1/events/${newEvent.id}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const qrCode = regRes.body.data.qr_code;

      const res = await request(app)
        .post(`/api/v1/events/${newEvent.id}/registrations/${regRes.body.data.id}/checkin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ qrCode });

      expect(res.statusCode).toEqual(200);
    });

    it('should reject duplicate check-in', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${checkInEventId}/registrations/${checkInRegistrationId}/checkin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/zaten giriş/i);
    });
  });

  describe('GET /api/v1/events/my-events', () => {
    it('should get user events', async () => {
      const res = await request(app)
        .get('/api/v1/events/my-events')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

