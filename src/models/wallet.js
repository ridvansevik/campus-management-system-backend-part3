module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define('Wallet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true // Her kullanıcının 1 cüzdanı olur
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  Wallet.associate = (models) => {
    Wallet.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Wallet.hasMany(models.Transaction, { foreignKey: 'wallet_id', as: 'transactions' });
  };

  return Wallet;
};