const express = require('express');
const router = express.Router();


router.route("/market/open").post(
    (...args) => authenticateToken(...args), 
    (...args) => openMarketGMX(...args)
)
router.route("/limit/open").post(
    (...args) => authenticateToken(...args), 
    (...args) => openLimitGMX(...args)
);
router.route("/market/close").post(
    (...args) => authenticateToken(...args), 
    (...args) => closeMarketGMX(...args)
);
router.route("/limit/close").post(
    (...args) => authenticateToken(...args), 
    (...args) => cancelLimitGMX(...args)
    );





module.exports = router;