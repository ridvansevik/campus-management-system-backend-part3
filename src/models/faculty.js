module.exports = (sequelize, DataTypes) => {
  const Faculty = sequelize.define('Faculty', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID, // User tablosu genelde UUID'dir
      allowNull: false,
      unique: true
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING
    },
    office_number: {
      type: DataTypes.STRING
    },
    employee_number: {
      type: DataTypes.STRING,
      unique: true
    }
  });

  Faculty.associate = (models) => {
    Faculty.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Faculty.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Faculty.hasMany(models.CourseSection, { foreignKey: 'instructorId', as: 'sections' });
  };

  return Faculty;
};