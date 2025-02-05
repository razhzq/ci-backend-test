require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { createServer } = require("http");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const socketIo = require("socket.io");
const db = require("./database/index");
const {
  createUser,
  userAuthentication,
  getAllUserTrades,
  getLeaderboards,
  userAirdropPoints,
  testDecrypt,
  authenticateToken,
  checkUsernameRedundance,
  getUserChatId,
  getUserData,
  verifyToken,
  testData,
  getAllUserLimitTrades,
  checkIP,
  checkCORS,
} = require("./controller/usercontroller");
const {
  openMarketGMX,
  OpenMarketGNS,
  closeMarketOrderGNS,
  openLimitGMX,
  closeMarketGMX,
  aggregator,
  aggregatorUser,
  cancelLimitGMX,
  cancelLimitGNS,
} = require("./controller/perpcontroller");
const {
  createBetaCodes,
  useBetaCode,
  createBetaCodesByUser,
  checkBetaCode,
  getUserBetaCodes,
} = require("./controller/betacodecontroller");
const {
  transferETH,
  transferDAI,
  getUserWalletDetails,
  getETHBalance,
  getDAIBalance,
} = require("./controller/walletcontroller");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");
var cron = require("node-cron");
const { calculateDeltaGMX, calculateDeltaGNS } = require("./cron/delta");
const checkLimitOrderActiveGMX = require("./cron/limitOrderGMX");
const { getPriceGNS, getPriceGMX } = require("./controller/pricecontroller");
const { resourceLimits } = require("worker_threads");

const app = express();

//socket
const server = createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("client Connected");
  socket.on("tradeActive", (data) => {
    io.emit("tradeActive", data);
  });
  socket.on("tradeClosed", (data) => {
    io.emit("tradeClosed", data);
  });
  socket.on("gmxLimitOpen", (data) => {
    io.emit("gmxLimitOpen", data);
  });
  socket.on("tpTriggerGMX", (data) => {
    io.emit("tpTriggerGMX", data)
  })
  socket.on("slTriggerGMX", (data) => {
    io.emit("slTriggerGMX", data)
  })
});



app.use(bodyParser.json());
app.use(
  cors({
    origin: "https://api.telegram.org/bot6335555882:AAFyZgnYQlCyndoLAEpKgqHKTdk74LrPGVA/",
  })
);

const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres", // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  dialectOptions: {
    ssl:'Amazon RDS'
},
});

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

db.sequelize.sync().then(() => {
  console.log("Drop and re-sync db.");
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.route('/gmx/', gmxRouter);

//ROUTES
app.get("/user/allTrades/:username", getAllUserTrades);
app.get("/user/limitTrades/:username", getAllUserLimitTrades);
app.get("/leaderboards", getLeaderboards);

app.get("/chat/:username", checkCORS, getUserChatId);

app.post("/price/gns", getPriceGNS);
app.post("/price/gmx", getPriceGMX);
app.post("/aggregator", aggregator);
app.post("/aggregator/user", aggregatorUser);

app.get("/user/data/:username", checkCORS ,getUserData);
app.post("/user/create", checkCORS,createUser);
app.post("/user/auth", checkCORS,userAuthentication);
app.get("/user/check/:username", checkUsernameRedundance);
app.get("/verify/token", checkCORS , verifyToken);



app.post("/market/gns", authenticateToken, OpenMarketGNS);
app.post("/close/gns", authenticateToken, closeMarketOrderGNS);
app.post("/close/limit/gns", authenticateToken, cancelLimitGNS);

app.post("/code/create",createBetaCodes);
app.post("/code/create/referral", checkCORS, createBetaCodesByUser);
app.post("/code/use", checkCORS,useBetaCode);
app.post("/code/check", checkCORS, checkBetaCode);
app.get('/code/list/:username', getUserBetaCodes);

app.get("/wallet/user/:username", getUserWalletDetails);
app.get("/wallet/balance/eth/:username", getETHBalance);
app.get("/wallet/balance/dai/:username", getDAIBalance);
app.post("/wallet/withdraw/eth", authenticateToken, transferETH);
app.post("/wallet/withdraw/dai", authenticateToken, transferDAI);

app.post("/user/airdrop", userAirdropPoints);

app.get("/", (_, res) => {
   res.status(200).json('Welcome to ApedBot API');
})

// const port = process.env.EA_PORT || 8081

server.listen(8080, () => console.log(`app listening on port !`));

cron.schedule("* * * * *", () => {
  calculateDeltaGMX();
  calculateDeltaGNS();
});

// cron.schedule("* * * * *", () => {
//   checkLimitOrderActiveGMX();
// });
