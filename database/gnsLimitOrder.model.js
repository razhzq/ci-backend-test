module.exports = (sequelize, DataTypes) => {
    const gnsLimitOrder = sequelize.define('gnsLimitOrder', {
        asset: DataTypes.STRING,
        price: DataTypes.FLOAT,
        collateral: DataTypes.FLOAT,
        delta: DataTypes.FLOAT,
        tradeIndex: DataTypes.INTEGER,
        isLong: DataTypes.BOOLEAN,
        leverage: DataTypes.INTEGER,
        network: DataTypes.STRING,
        username: DataTypes.STRING
    });
    return gnsLimitOrder;
}