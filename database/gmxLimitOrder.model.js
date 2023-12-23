module.exports = (sequelize, DataTypes) => {
    const gmxLimitOrder = sequelize.define('gmxLimitOrder', {
        asset: DataTypes.STRING,
        orderIndex: DataTypes.INTEGER,
        indexToken: DataTypes.STRING,
        collateral: DataTypes.FLOAT,
        sizeDelta: DataTypes.FLOAT, //USD Value of the position including leverage
        leverage: DataTypes.INTEGER, 
        isLong: DataTypes.BOOLEAN,
        price: DataTypes.FLOAT,
        username: DataTypes.STRING
    });
   
    return gmxLimitOrder;
}