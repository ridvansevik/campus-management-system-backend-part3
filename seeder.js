const fs = require('fs');
const colors = require('colors');
const dotenv = require('dotenv');
const db = require('./src/models'); 

// Çevre değişkenlerini yükle
dotenv.config({ path: './src/config/config.env' });

// Veritabanı Modelleri
const User = db.User;
const Student = db.Student;
const Faculty = db.Faculty;
const Department = db.Department;
const Course = db.Course;
const CourseSection = db.CourseSection;
const Classroom = db.Classroom;
const Enrollment = db.Enrollment;
const Announcement = db.Announcement;

// --- PART 3 MODELLERİ ---
const Wallet = db.Wallet;
const Cafeteria = db.Cafeteria;
const MealMenu = db.MealMenu;
const Event = db.Event;
const Schedule = db.Schedule;

// SEED FONKSİYONU
const seedData = async () => {
  try {
    // 1. VERİTABANINI SIFIRLA
    await db.sequelize.sync({ force: true });
    console.log('Veritabanı sıfırlandı ve tablolar yeniden oluşturuldu...'.cyan.bold);

    // -----------------------------------------------------------------------
    // 2. BÖLÜMLER (DEPARTMENTS)
    // -----------------------------------------------------------------------
    const deptComputer = await Department.create({ 
      name: 'Bilgisayar Mühendisliği', 
      code: 'CENG',
      faculty_name: 'Mühendislik Fakültesi'
    });
    
    const deptElectrical = await Department.create({ 
      name: 'Elektrik-Elektronik Müh.', 
      code: 'EEE',
      faculty_name: 'Mühendislik Fakültesi'
    });
    
    const deptArchitecture = await Department.create({ 
      name: 'Mimarlık', 
      code: 'ARCH',
      faculty_name: 'Mimarlık ve Tasarım Fakültesi'
    });
    
    console.log('Bölümler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 3. DERSLİKLER (CLASSROOMS)
    // -----------------------------------------------------------------------
    const room101 = await Classroom.create({ 
      code: 'MB-101', // Kod eklendi
      building: 'Mühendislik A Blok', 
      room_number: '101', 
      capacity: 60, 
      type: 'classroom',
      latitude: 41.0255, 
      longitude: 40.5201
    });

    const labComp = await Classroom.create({ 
      code: 'MB-LAB1',
      building: 'Mühendislik B Blok', 
      room_number: 'LAB-1', 
      capacity: 30, 
      type: 'lab',
      latitude: 41.0258, 
      longitude: 40.5205
    });

    const roomArch = await Classroom.create({ 
      code: 'MF-Z10',
      building: 'Mimarlık Fakültesi', 
      room_number: 'Z-10', 
      capacity: 45, 
      type: 'studio',
      latitude: 41.0260, 
      longitude: 40.5210
    });
    console.log('Derslikler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 4. KULLANICILAR (ADMIN, HOCA, ÖĞRENCİ)
    // -----------------------------------------------------------------------
    
    // --- Admin ---
    await User.create({
      name: 'Sistem Yöneticisi',
      email: 'admin@smartcampus.com',
      password_hash: 'Password123',
      role: 'admin',
      is_verified: true
    });

    // --- Hocalar ---
    const userFac1 = await User.create({
      name: 'Dr. Ahmet Yılmaz',
      email: 'ahmet@smartcampus.com',
      password_hash: 'Password123',
      role: 'faculty',
      is_verified: true
    });
    const faculty1 = await Faculty.create({
      userId: userFac1.id,
      departmentId: deptComputer.id,
      title: 'Dr. Öğr. Üyesi',
      office_number: 'A-204',
      employee_number: 'FAC-001'
    });

    const userFac2 = await User.create({
      name: 'Prof. Dr. Zeynep Kaya',
      email: 'zeynep@smartcampus.com',
      password_hash: 'Password123',
      role: 'faculty',
      is_verified: true
    });
    const faculty2 = await Faculty.create({
      userId: userFac2.id,
      departmentId: deptArchitecture.id,
      title: 'Prof. Dr.',
      office_number: 'M-101',
      employee_number: 'FAC-002'
    });

    // --- Öğrenciler ---
    const userStu1 = await User.create({
      name: 'Ali Demir',
      email: 'ali@smartcampus.com',
      password_hash: 'Password123',
      role: 'student',
      is_verified: true
    });
    const student1 = await Student.create({
      userId: userStu1.id,
      departmentId: deptComputer.id,
      student_number: '2021001',
      gpa: 3.50,
      current_semester: 3
    });

    const userStu2 = await User.create({
      name: 'Ayşe Çelik',
      email: 'ayse@smartcampus.com',
      password_hash: 'Password123',
      role: 'student',
      is_verified: true
    });
    const student2 = await Student.create({
      userId: userStu2.id,
      departmentId: deptComputer.id,
      student_number: '2021002',
      gpa: 2.80,
      current_semester: 3,
      is_scholarship: true // Ayşe burslu olsun (Yemekhane testi için)
    });

    console.log('Kullanıcılar eklendi...'.green);

    // -----------------------------------------------------------------------
    // 5. DERSLER (COURSES)
    // -----------------------------------------------------------------------
    
    const courseAlgo = await Course.create({
      code: 'CENG101',
      name: 'Algoritma ve Programlamaya Giriş',
      description: 'Temel C++ eğitimi.',
      credits: 4,
      ects: 6,
      departmentId: deptComputer.id
    });

    const courseData = await Course.create({
      code: 'CENG102',
      name: 'Veri Yapıları',
      description: 'Linked List, Tree, Graph yapıları.',
      credits: 3,
      ects: 5,
      departmentId: deptComputer.id,
      prerequisiteId: courseAlgo.id
    });

    const courseArch = await Course.create({
      code: 'ARCH101',
      name: 'Mimari Tasarıma Giriş',
      description: 'Temel çizim teknikleri.',
      credits: 4,
      ects: 7,
      departmentId: deptArchitecture.id
    });

    console.log('Dersler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 6. ŞUBELER (SECTIONS) VE ÇİZELGE (SCHEDULE)
    // -----------------------------------------------------------------------

    // CENG101
    const section1 = await CourseSection.create({
      courseId: courseAlgo.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: faculty1.id,
      classroomId: labComp.id,
      capacity: 30,
      enrolled_count: 0,
      schedule_json: { day: 'Monday', start: '09:00', room: 'MB-LAB1' } // Frontend için özet
    });
    
    // CENG101 İçin Schedule Tablosuna Kayıt (Takvimde görünmesi için)
    await Schedule.create({
      section_id: section1.id,
      classroom_id: labComp.id,
      day_of_week: 'Monday',
      start_time: '09:00',
      end_time: '12:00'
    });

    // CENG102
    const section2 = await CourseSection.create({
      courseId: courseData.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: faculty1.id,
      classroomId: room101.id,
      capacity: 60,
      enrolled_count: 0,
      schedule_json: { day: 'Wednesday', start: '13:00', room: 'MB-101' }
    });
    
    await Schedule.create({
      section_id: section2.id,
      classroom_id: room101.id,
      day_of_week: 'Wednesday',
      start_time: '13:00',
      end_time: '16:00'
    });

    // ARCH101
    const section3 = await CourseSection.create({
      courseId: courseArch.id,
      section_number: 1,
      semester: 'Spring',
      year: 2025,
      instructorId: faculty2.id,
      classroomId: roomArch.id,
      capacity: 45,
      enrolled_count: 0,
      schedule_json: { day: 'Tuesday', start: '09:00', room: 'MF-Z10' }
    });

    await Schedule.create({
      section_id: section3.id,
      classroom_id: roomArch.id,
      day_of_week: 'Tuesday',
      start_time: '09:00',
      end_time: '13:00'
    });

    console.log('Şubeler ve programlar eklendi...'.green);

    // -----------------------------------------------------------------------
    // 7. DUYURULAR
    // -----------------------------------------------------------------------
    
    await Announcement.create({
      title: '2025 Bahar Dönemi Başlıyor',
      content: 'Tüm öğrencilerimize yeni dönemde başarılar dileriz. Ders kayıtları açılmıştır.',
      target_role: 'all',
      priority: 'high'
    });

    // -----------------------------------------------------------------------
    // 8. CÜZDANLAR (WALLETS) - PART 3
    // -----------------------------------------------------------------------
    // Ali'ye 500 TL, Ayşe'ye 150 TL bakiye verelim
    await Wallet.create({ user_id: userStu1.id, balance: 500.00 });
    await Wallet.create({ user_id: userStu2.id, balance: 150.00 });
    // Hocalara da cüzdan açalım (Yemek yiyebilmeleri için)
    await Wallet.create({ user_id: userFac1.id, balance: 1000.00 });

    console.log('Cüzdanlar oluşturuldu...'.green);

    // -----------------------------------------------------------------------
    // 9. YEMEKHANE VE MENÜLER - PART 3
    // -----------------------------------------------------------------------
    const mainCafeteria = await Cafeteria.create({
      name: 'Merkez Yemekhane',
      location: 'Kampüs Orta Alan',
      capacity: 1000
    });

    const engCafeteria = await Cafeteria.create({
      name: 'Mühendislik Kantini',
      location: 'Mühendislik Binası',
      capacity: 200
    });

    // Dinamik tarih (Bugün ve Yarın)
    const today = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    // Bugünün Menüsü
    await MealMenu.create({
      cafeteria_id: mainCafeteria.id,
      date: today,
      meal_type: 'lunch',
      items_json: ['Mercimek Çorbası', 'Orman Kebabı', 'Pirinç Pilavı', 'Cacık'],
      nutrition_json: { calories: 850, protein: 25 },
      price: 20.00
    });

    await MealMenu.create({
      cafeteria_id: mainCafeteria.id,
      date: today,
      meal_type: 'dinner',
      items_json: ['Domates Çorbası', 'Tavuk Sote', 'Bulgur Pilavı', 'Tatlı'],
      nutrition_json: { calories: 780, protein: 30 },
      price: 20.00
    });

    // Yarının Menüsü
    await MealMenu.create({
      cafeteria_id: mainCafeteria.id,
      date: tomorrow,
      meal_type: 'lunch',
      items_json: ['Ezogelin Çorbası', 'Kuru Fasulye', 'Pilav', 'Turşu'],
      nutrition_json: { calories: 900, protein: 20 },
      price: 20.00
    });

    console.log('Yemekhane ve menüler eklendi...'.green);

    // -----------------------------------------------------------------------
    // 10. ETKİNLİKLER - PART 3
    // -----------------------------------------------------------------------
    
    // Gelecek bir tarih
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 10); // 10 gün sonra
    const eventDateStr = eventDate.toISOString().split('T')[0];

    await Event.create({
      title: 'Bahar Teknoloji Şenliği',
      description: 'Mühendislik fakültesi bahçesinde teknoloji stantları ve konserler.',
      category: 'Social',
      date: eventDateStr,
      start_time: '10:00',
      end_time: '18:00',
      location: 'Mühendislik Bahçesi',
      capacity: 500,
      registered_count: 0
    });

    await Event.create({
      title: 'Kariyer Zirvesi 2025',
      description: 'Sektörün önde gelen firmaları ile tanışma fırsatı.',
      category: 'Career',
      date: eventDateStr,
      start_time: '13:00',
      end_time: '17:00',
      location: 'Konferans Salonu A',
      capacity: 200,
      registered_count: 0
    });

    console.log('Etkinlikler eklendi...'.green);
    
    // -----------------------------------------------------------------------
    // 11. TEST İÇİN HAZIR KAYIT (ENROLLMENT)
    // -----------------------------------------------------------------------
    const sectionCeng101 = await CourseSection.findOne({ where: { courseId: courseAlgo.id } });
    
    if(sectionCeng101) {
        await Enrollment.create({
            studentId: student1.id,
            sectionId: sectionCeng101.id,
            status: 'passed',
            midterm_grade: 80,
            final_grade: 90,
            letter_grade: 'AA',
            grade_point: 4.0
        });
        
        await sectionCeng101.increment('enrolled_count');
        console.log('Ali CENG101 dersine kaydedildi ve AA ile geçti.'.yellow);
    }

    // Ali'nin aktif aldığı ders (CENG102)
    const sectionCeng102 = await CourseSection.findOne({ where: { courseId: courseData.id } });
    if(sectionCeng102) {
        await Enrollment.create({
            studentId: student1.id,
            sectionId: sectionCeng102.id,
            status: 'enrolled'
        });
        await sectionCeng102.increment('enrolled_count');
    }

    console.log('-------------------------------------------'.white);
    console.log('VERİ YÜKLEME İŞLEMİ BAŞARIYLA TAMAMLANDI!'.inverse.green);
    console.log('-------------------------------------------'.white);

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();