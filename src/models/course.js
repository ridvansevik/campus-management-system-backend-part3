module.exports = (sequelize, DataTypes) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    credits: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ects: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    departmentId: {
      type: DataTypes.UUID, // GÜNCELLENDİ
      allowNull: false
    },
    prerequisiteId: {
      type: DataTypes.UUID, // GÜNCELLENDİ
      allowNull: true
    }
  });

  Course.associate = (models) => {
    Course.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Course.belongsTo(models.Course, { foreignKey: 'prerequisiteId', as: 'prerequisite' });
    Course.hasMany(models.CourseSection, { foreignKey: 'courseId', as: 'sections' });
  };

  return Course;
};