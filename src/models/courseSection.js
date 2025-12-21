module.exports = (sequelize, DataTypes) => {
  const CourseSection = sequelize.define('CourseSection', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    section_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    semester: {
        type: DataTypes.ENUM('Fall', 'Spring', 'Summer'),
        allowNull: false
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    instructorId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    classroomId: {
        type: DataTypes.UUID, // BURASI GÜNCELLENDİ (INTEGER -> UUID)
        allowNull: false
    },
    capacity: {
        type: DataTypes.INTEGER,
        defaultValue: 30
    },
    enrolled_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    schedule_json: {
        type: DataTypes.JSONB // Ders programı özeti için
    }
  });

  CourseSection.associate = (models) => {
    CourseSection.belongsTo(models.Course, { foreignKey: 'courseId', as: 'course' });
    CourseSection.belongsTo(models.Faculty, { foreignKey: 'instructorId', as: 'instructor' });
    CourseSection.belongsTo(models.Classroom, { foreignKey: 'classroomId', as: 'classroom' });
    
    // Part 2 & 3 İlişkileri
    CourseSection.hasMany(models.Enrollment, { foreignKey: 'sectionId', as: 'enrollments' });
    CourseSection.hasMany(models.AttendanceSession, { foreignKey: 'sectionId', as: 'sessions' });
    CourseSection.hasMany(models.Schedule, { foreignKey: 'section_id', as: 'schedules' });
  };

  return CourseSection;
};