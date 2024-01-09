require("dotenv").config({ path: "../.env" });
const { Sequelize } = require("sequelize");
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
});
const providerUrl = process.env.ETH_URL;
const adminPassword = process.env.adminPassword;
const User = require("../database/user.model")(sequelize, Sequelize);
const gnsMarketOrder = require("../database/gnsMarketOrder.model")(
  sequelize,
  Sequelize
);
const gmxMarketOrder = require("../database/gmxMarketOrder.model")(
  sequelize,
  Sequelize
);
const UserWallet = require("../database/userWallet.model")(
  sequelize,
  Sequelize
);
const UserData = require("../database/userData.model")(sequelize, Sequelize);
const gasOptimize = require("../database/gasOptimize.model")(sequelize, Sequelize);
const multiplier = require("../database/multiplier.model")(
  sequelize,
  Sequelize
);
const gnsLimitOrder = require("../database/gnsLimitOrder.model")(sequelize, Sequelize);
const gmxLimitOrder = require("../database/gmxLimitOrder.model")(sequelize, Sequelize);
const bcrypt = require("bcrypt");
const { Web3 } = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const crypto = require("crypto");
const util = require("util");
const { decryptor, encryptor } = require("../helpers/decypter");

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.KEY, "hex");
const iv = Buffer.from(process.env.IV_KEY, "hex");

const jwt = require("jsonwebtoken");
const { error } = require("console");
const { resourceLimits } = require("worker_threads");
const jwtSecret = process.env.JWT_SECRET;

// const asyncCipherUpdate = util.promisify(cipher.update);
// const asyncCipherFinal = util.promisify(cipher.final);

module.exports.createUser = async (req, res) => {
  const { username, password, chatId } = req.body;

  try {
    const saltRounds = 10;
    const hashPassword = await bcrypt.hash(password, saltRounds);

    const newAccount = await web3.eth.accounts.create();

    const encryptedKey = await encryptor(newAccount.privateKey);

    await User.create({
      username: username,
      password: hashPassword,
      chatId: chatId,
    });

    await UserData.create({
      points: 0,
      pnl: 0,
      username: username,
    });

    await UserWallet.create({
      publicKey: newAccount.address,
      privateKey: encryptedKey,
      walletOwner: username,
    });

    await gasOptimize.create({
      username: username,
      gmxPositionRouterApprove: false,
      gmxOrderBookApprove: false,
      gmxDaiApprove: false,
      gnsDaiApprove: false
    })

    res.status(200).json(`User ${username} created successfully`);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: error,
    });
  }
};

module.exports.getUserChatId = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username: username } });
    if (!user) {
      res.status(400).json({
        error: "user not exist",
      });
    }
    res.status(200).json({
      chatId: user.chatId,
    });
  } catch (error) {
    res.status(400).json("error");
    console.error(error);
  }
};

module.exports.userAuthentication = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ where: { username: username } });

    if (!user) {
      return res.status(404).json({
        auth: "user not exist!",
      });
    }

    const hashedPassword = user.password;

    const matchedPassword = await bcrypt.compare(password, hashedPassword);

    if (!matchedPassword) {
      res.status(401).json({
        auth: "fail",
      });
    }

    const token = jwt.sign(
      { username: user.username, userId: user.id },
      jwtSecret,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      auth: "success",
      token: token,
    });
  } catch (error) {
    res.status(500).json("auth failed");
  }
};

module.exports.getAllUserTrades = async (req, res) => {
  const { username } = req.params;

  try {
    let gmxTrade = await gmxMarketOrder.findAll({
      where: { trade_status: 0, username: username },
    });
    let gnsTrade = await gnsMarketOrder.findAll({
      where: { trade_status: 0, username: username },
    });
    
    gmxTrade = gmxTrade.map(trade => trade.get({ plain: true }));
    gmxTrade.forEach(trade => trade.platform = 'gmx');

    gnsTrade = gnsTrade.map(trade => trade.get({ plain: true }));
    gnsTrade.forEach(trade => trade.platform = 'gns');

    const allTrades = gnsTrade.concat(gmxTrade);
    res.status(200).json(allTrades);

  } catch (error) {
    res.status(400).json(error);
  }
};

module.exports.getAllUserLimitTrades = async (req, res) => {
  const {username} = req.params;

  try {
    let gmxTrade = await gmxLimitOrder.findAll({ where: { username: username}})
    let gnsTrade = await gnsLimitOrder.findAll({ where: { username: username}})

    gmxTrade = gmxTrade.map(trade => trade.get({ plain: true }));
    gmxTrade.forEach(trade => trade.platform = 'gmx');

    gnsTrade = gnsTrade.map(trade => trade.get({ plain: true }));
    gnsTrade.forEach(trade => trade.platform = 'gns');

    const allTrades = gnsTrade.concat(gmxTrade);
    res.status(200).json(allTrades);


  } catch (error) {
    res.status(400).json(error);
  }
}

module.exports.getUserData = async (req, res) => {
  const { username } = req.params;

  try {
    const data = await UserData.findOne({ where: { username: username } });

    if (!data) {
      res.status(400).json("Error user data");
    }

    res.status(200).json({
      totalPoints: data.points,
      totalEarning: data.pnl,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: "Error fething User Data",
    });
  }
};

module.exports.getLeaderboards = async (_, res) => {
  const users = await UserData.findAll();

  try {
    if (users.length > 0) {
      users.sort((a, b) => a.pnl - b.pnl);
      res.status(200).json(users);
    } else {
      res.status(200).json({ user: "no users" });
    }
  } catch (error) {
    res.status(400).json("error leaderboard");
  }
};

module.exports.userAirdropPoints = async (req, res) => {
  const { username, points, masterPassword } = req.body;

  while (masterPassword == adminPassword) {
    const user = await UserData.findOne({ where: { username: username } });
    if (user) {
      const totalPoints = user.points + points;
      UserData.update(
        { points: totalPoints },
        { where: { username: username } }
      );

      res.status(200).json({
        status: "success",
        totalPoints: totalPoints,
      });
    }

    break;
  }
  res.status(400).json("incorrect master password");
};

module.exports.authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ auth: "fail" });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ auth: "fail" });
    }

    req.user = user;
    next();
  });
};

module.exports.verifyToken = (req, res) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ auth: "fail" });
  }

  console.log("token: ", token);

  jwt.verify(token, jwtSecret, (err) => {
    if (err) {
      return res.status(403).json({ auth: "fail" });
    } else {
      return res.status(200).json({ auth: "success" });
    }
  });
};

module.exports.checkUsernameRedundance = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username: username } });

    if (user) {
      res.status(200).json({
        availability: false,
      });
      return;
    }

    res.status(200).json({
      availability: true,
    });
  } catch (error) {
    res.status(400).json({
      error: error,
    });
  }
};
