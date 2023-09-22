module.exports = (sequelize, DataTypes) => {
    const UserWallet = sequelize.define('wallet', {
        publicKey: DataTypes.STRING,
        privateKey: DataTypes.STRING,
        walletOwner: DataTypes.STRING
    });

    return UserWallet;
}