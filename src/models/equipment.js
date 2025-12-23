module.exports = (sequelize, DataTypes) => {
  const Equipment = sequelize.define('Equipment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING }, // örn: Laptop, Projektör, Kamera
    serial_number: { type: DataTypes.STRING, unique: true },
    status: { 
      type: DataTypes.ENUM('available', 'borrowed', 'maintenance', 'lost'),
      defaultValue: 'available' 
    },
    condition: { type: DataTypes.STRING } // New, Used, Damaged
  });

  Equipment.associate = (models) => {
    Equipment.hasMany(models.Loan, { foreignKey: 'equipmentId', as: 'loans' });
  };

  return Equipment;
};