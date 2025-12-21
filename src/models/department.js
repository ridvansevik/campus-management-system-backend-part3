module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    faculty_name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  Department.associate = (models) => {
    Department.hasMany(models.Course, { foreignKey: 'departmentId' });
    Department.hasMany(models.Student, { foreignKey: 'departmentId' });
    Department.hasMany(models.Faculty, { foreignKey: 'departmentId' });
  };

  return Department;
};