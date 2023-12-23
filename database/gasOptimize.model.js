module.exports = (sequelize, DataTypes) => {
    const gasOptimize = sequelize.define('gasOptimize', {
        username: DataTypes.STRING,
        gmxPositionRouterApprove: DataTypes.BOOLEAN,
        gmxOrderBookApprove: DataTypes.BOOLEAN,
        gmxDaiApprove: DataTypes.BOOLEAN,
        gnsDaiApprove: DataTypes.BOOLEAN
    });

    return gasOptimize;
}