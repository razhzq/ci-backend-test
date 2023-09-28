require("dotenv").config();
const cors = require('cors')
const express = require('express')
const { createServer } = require('http')
const bodyParser = require('body-parser')
const Sequelize = require('sequelize')
const socketIo = require('socket.io');
const db = require('./database/index');
const { createUser, userAuthentication, getAllUserTrades } = require("./controller/usercontroller");
const { openMarketGMX, OpenMarketGNS, closeMarketOrderGNS, openLimitGMX, closeMarketGMX } = require("./controller/perpcontroller");
const { createBetaCodes, useBetaCode } = require("./controller/betacodecontroller");
const { transferETH, transferDAI } = require("./controller/walletcontroller");
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');
var cron = require('node-cron');
const { calculateDeltaGMX, calculateDeltaGNS } = require("./cron/delta");

const app = express()


//socket
const server = createServer(app);
const io = socketIo(server);

const callbackGNSEvent = require('./cron/eventCallback')(io)
const callbackGNSPolygonEvent = require('./cron/eventCallbackPolygon')(io)
const checkLimitOrderActiveGMX = require('./cron/limitOrderGMX')(io)


app.use(bodyParser.json())
app.use(cors({
    origin: '*'
 }))


const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
}).catch(err => {
   console.error('Unable to connect to the database:', err);
});

db.sequelize.sync().then(() => {
  console.log("Drop and re-sync db.");
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//ROUTES
app.get('/user/allTrades/:username', getAllUserTrades)
app.post('/user/create', createUser);
app.post('/user/auth', userAuthentication);

app.post('/market/gns', OpenMarketGNS);
app.post('/close/gns', closeMarketOrderGNS);
app.post('/market/gmx', openMarketGMX);
app.post('/limit/gmx', openLimitGMX);
app.post('/close/gmx', closeMarketGMX);

app.post('/code/create', createBetaCodes);
app.post('/code/use', useBetaCode);

app.post('/wallet/withdraw/eth', transferETH);
app.post('/wallet/withdraw/dai', transferDAI);





// const port = process.env.EA_PORT || 8081

server.listen(8080, () => console.log(`app listening on port !`))

cron.schedule('* * * * *', () => {
  calculateDeltaGMX();
  calculateDeltaGNS();
});

cron.schedule('* * * * *', () => {
  checkLimitOrderActiveGMX();
});




module.exports = {io};



