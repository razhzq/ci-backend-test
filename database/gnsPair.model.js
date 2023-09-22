module.exports = (sequelize, DataTypes) => {
    const gnsPair = sequelize.define('gnsPair', {
        pairId: DataTypes.INTEGER,
        contractAddress: DataTypes.STRING,
        pairName : DataTypes.STRING,
        network: DataTypes.STRING
    });

    return gnsPair;
}