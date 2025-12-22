const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');
const { Schedule, CourseSection, Classroom, Course, Department, Faculty, Enrollment, Student, User } = db;

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Part 3: Course Scheduling Tests', () => {
  let authToken;
  let adminToken;
  let studentId;
  let sectionId;

  beforeAll(async () => {
    // Department ve Course oluştur
    const department = await Department.create({
      name: 'Computer Science',
      code: 'CSE'
    });

    const course = await Course.create({
      name: 'Introduction to Programming',
      code: 'CSE101',
      credits: 3,
      departmentId: department.id
    });

    // Faculty oluştur
    const facultyUser = await User.create({
      name: 'Faculty User',
      email: `faculty${Date.now()}@test.com`,
      password: 'Password123',
      role: 'faculty',
      is_verified: true
    });

    const faculty = await Faculty.create({
      userId: facultyUser.id,
      employee_number: `FAC${Date.now()}`,
      departmentId: department.id
    });

    // Classroom oluştur
    await Classroom.create({
      code: 'A101',
      capacity: 50,
      building: 'A Block'
    });

    // Section oluştur
    const section = await CourseSection.create({
      courseId: course.id,
      section_number: 1,
      semester: 'Fall',
      year: 2024,
      instructorId: faculty.id,
      capacity: 30
    });
    sectionId = section.id;

    // Student oluştur
    const studentUser = await User.create({
      name: 'Schedule Test Student',
      email: `schedule${Date.now()}@test.com`,
      password: 'Password123',
      role: 'student',
      is_verified: true
    });

    const student = await Student.create({
      userId: studentUser.id,
      student_number: `ST${Date.now()}`,
      departmentId: department.id
    });
    studentId = student.id;

    // Enrollment
    await Enrollment.create({
      studentId: student.id,
      sectionId: section.id,
      status: 'enrolled'
    });

    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: studentUser.email, password: 'Password123' });
    authToken = loginRes.body.data.accessToken;

    // Admin login
    const admin = await User.create({
      name: 'Schedule Admin',
      email: `scheduleadmin${Date.now()}@test.com`,
      password: 'Password123',
      role: 'admin',
      is_verified: true
    });

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = adminLoginRes.body.data.accessToken;
  });

  describe('POST /api/v1/scheduling/generate', () => {
    it('should generate schedule using CSP algorithm', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          semester: 'Fall',
          year: 2024,
          clearExisting: false
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should reject if not admin', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          semester: 'Fall',
          year: 2024
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('GET /api/v1/scheduling/my-schedule', () => {
    it('should get student schedule', async () => {
      // Önce bir schedule oluştur
      const classroom = await Classroom.findOne();
      const section = await CourseSection.findByPk(sectionId);

      if (classroom && section) {
        await Schedule.create({
          section_id: section.id,
          classroom_id: classroom.id,
          day_of_week: 'Monday',
          start_time: '09:00',
          end_time: '10:40'
        });
      }

      const res = await request(app)
        .get('/api/v1/scheduling/my-schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/scheduling/:scheduleId', () => {
    it('should get schedule detail', async () => {
      const classroom = await Classroom.findOne();
      const section = await CourseSection.findByPk(sectionId);

      if (classroom && section) {
        const schedule = await Schedule.create({
          section_id: section.id,
          classroom_id: classroom.id,
          day_of_week: 'Tuesday',
          start_time: '11:00',
          end_time: '12:40'
        });

        const res = await request(app)
          .get(`/api/v1/scheduling/${schedule.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(schedule.id);
      }
    });
  });

  describe('GET /api/v1/scheduling/my-schedule/ical', () => {
    it('should export schedule as iCal file', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/my-schedule/ical')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toMatch(/text\/calendar/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('END:VCALENDAR');
    });
  });
});

