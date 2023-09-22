module.exports = (sequelize, DataTypes) => {
    const gmxLimitOrder = sequelize.define('gmxLimitOrder', {
        asset: DataTypes.STRING,
        collateralToken: DataTypes.STRING,
        indexToken: DataTypes.STRING,
        collateral: DataTypes.FLOAT,
        sizeDelta: DataTypes.FLOAT, //USD Value of the position including leverage 
        isLong: DataTypes.BOOLEAN,
        price: DataTypes.FLOAT,
        username: DataTypes.STRING
    });
   
    return gmxLimitOrder;
}