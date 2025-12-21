module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    wallet_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('deposit', 'payment', 'refund', 'transfer'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    balance_after: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING
    },
    reference_id: { // Örneğin rezervasyon ID'si
      type: DataTypes.STRING
    }
  });

  Transaction.associate = (models) => {
    Transaction.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
  };

  return Transaction;
};