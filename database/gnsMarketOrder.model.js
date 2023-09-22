module.exports = (sequelize, DataTypes) => {
    const gnsMarketOrder = sequelize.define('gnsMarketOrder', {
        asset: DataTypes.STRING,
        price: DataTypes.FLOAT,
        collateral: DataTypes.FLOAT,
        delta: DataTypes.FLOAT,
        tradeIndex: DataTypes.INTEGER,
        orderId: DataTypes.INTEGER,
        isLong: DataTypes.BOOLEAN,
        leverage: DataTypes.INTEGER,
        network: DataTypes.STRING,
        username: DataTypes.STRING
    });
    return gnsMarketOrder;
}
