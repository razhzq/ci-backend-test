routes specification: 


1. Get price for GNS (POST)
/price/gns/ 
pass in request.body:
asset: 'asset_name'
example:
asset: 'BTC/USD'

2. Get price for GMX (POST)
/price/gmx/ 
pass in request.body:
asset: 'asset_name'
example:
asset: 'BTC/USD'


3. Get Leaderboards (GET)
/leaderboards
return users leaderboards based on pnl in increasing order

4. Aggregator (POST)
/aggregator
request.body:
{
    asset: 'BTC/USD',
    isLong: true,
} 

5. open order GMX (POST)
/open/market/gmx
request.body:
{
   userAddress: '0xasd13123123123',
   asset: 'BTC/USD',
   collateral: 500,
   leverage: 5,
   isLong: true,
}

6. open order GNS (POST)
/market/gns
request.body:
{
    collateral: 100,
    leverage: 5,
    asset: 'BTC/USD',
    tp: 28000.20,  //TP Price
    sl: 20000.20,  //SL Price - can be zero
    isLong: true,
    userAddress: '0xcadsdads',
    orderType: 0   // 0 - for market order  1 - limit order
}


8. close order GMX (POST) 
/close/gmx
request.body:
{
    asset: 'BTC/USD',
    collateral: 500,
    isLong: true,
    leverage: 5,
    userAddress: '0x0'
}

9. close order GNS (POST) 
/close/gns
request.body: 
{
    asset: 'BTC/USD',
    tradeIndex: 2,
    userAddress: '0x1'
}

10. create beta Code (POST)
/code/create
-saved to database beta code created
request.body: 
{
    codes : ["ab-1234", "ab-1232132"]  // array of betacodes
}

12. use beta code (POST)
/code/use
use beta code
request.body:
{
    "code": "ab-234"
}

if code submitted has been used, API return error status 400 'code already used'


13. get all user Trades
/user/allTrades/:username

example: api2.aped.xyz/user/allTrades/jojo

-return array of all user's open trades

14. transfer ETH from wallet
/wallet/withdraw/eth
request.body = {
    etherAmount: '0.50',
    toAddress: '0x2',
    username: 'jojo', //username of wallet owner
    network: 'polygon'  // or arbitrum
}


15. transfer DAI from wallet
/wallet/withdraw/dai
request.body = {
    daiAmount: '0.50',
    toAddress: '0x2',
    username: 'jojo', //username of wallet owner
    network: 'polygon'  // or arbitrum
}

16. get user wallet details
/user/wallet
-get user wallet details including public key and encrypted privatekey
request.body = {
    username: 'sds'
}



SOCKET SUBSCRIPTION
1. 'tradeActive'
subscribe to events when a gns limit trade is opened

2. 'tradeClosed'
subscribe to events when a gns market order is closed due to tp or sl or liquidated

3. 'gmxLimitOpen'
subscribe to events when a gmx limit order is opened


all of these events return the trade data of the particular trade from database




