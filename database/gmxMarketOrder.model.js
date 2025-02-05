module.exports = (sequelize, DataTypes) => {
    const gmxMarketOrder = sequelize.define('gmxMarketOrder', {
        asset: DataTypes.STRING,
        trade_status: DataTypes.INTEGER,
        indexToken: DataTypes.STRING,
        delta: DataTypes.FLOAT,
        collateral: DataTypes.FLOAT,
        sizeDelta: DataTypes.FLOAT, //USD Value of the position including leverage 
        isLong: DataTypes.BOOLEAN,
        price: DataTypes.FLOAT,
        takeProfit: DataTypes.FLOAT,
        stopLoss: DataTypes.FLOAT,
        username: DataTypes.STRING
    });
   
    return gmxMarketOrder;
}