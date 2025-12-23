module.exports = (sequelize, DataTypes) => {
  const Loan = sequelize.define('Loan', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    equipmentId: { type: DataTypes.UUID, allowNull: false },
    borrowDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    dueDate: { type: DataTypes.DATE, allowNull: false },
    returnDate: { type: DataTypes.DATE }, // Null ise henüz dönmedi
    status: { 
      type: DataTypes.ENUM('active', 'returned', 'overdue'),
      defaultValue: 'active'
    }
  });

  Loan.associate = (models) => {
    Loan.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Loan.belongsTo(models.Equipment, { foreignKey: 'equipmentId', as: 'equipment' });
  };

  return Loan;
};