module.exports = (sequelize, DataTypes) => {
  const MealReservation = sequelize.define('MealReservation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: DataTypes.UUID,
    menu_id: DataTypes.UUID,
    cafeteria_id: DataTypes.UUID,
    reservation_date: DataTypes.DATEONLY, // Hangi gün için
    meal_type: DataTypes.ENUM('lunch', 'dinner'),
    qr_code: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    status: {
      type: DataTypes.ENUM('reserved', 'used', 'cancelled'),
      defaultValue: 'reserved'
    },
    used_at: DataTypes.DATE
  });

  MealReservation.associate = (models) => {
    MealReservation.belongsTo(models.User, { foreignKey: 'user_id' });
    MealReservation.belongsTo(models.MealMenu, { foreignKey: 'menu_id' });
  };

  return MealReservation;
};