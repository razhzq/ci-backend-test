const puppeteer = require('puppeteer');



module.exports.getArrayGNSPair = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to the website with the table
    await page.goto('https://gains-network.gitbook.io/docs-home/gtrade-leveraged-trading/pair-list');

    // Wait for the table to be rendered
    await page.waitForSelector('table');

    // Extract data from the third column of the table
    const columnData = await page.evaluate(() => {
        const table = document.querySelector('table');
        const rows = table.querySelectorAll('tr');

        const columnData = [];
        rows.forEach(row => {
            const cell = row.querySelector('td:nth-child(3)');
            if (cell) {
                columnData.push(cell.innerText.trim());
            }
        });

        return columnData;
    });

    // Print the extracted data from the third column
    console.log(columnData);

    // Close the browser
    await browser.close();

    return columnData;
}

