const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
        const cardBody = document.querySelector('.card-body');
        if (!cardBody) return null;

        const title = cardBody.querySelector('h3')?.innerText.trim() || '';
        const image = cardBody.querySelector('img')?.src || '';
        const description = Array.from(cardBody.querySelectorAll('p'))
            .map(p => p.innerText.trim())
            .join('\n');
        const listItems = Array.from(cardBody.querySelectorAll('ul.bullet_list li'))
            .map(li => li.innerText.trim());

        return {
            title,
            image,
            description,
            listItems
        };
    });

    await browser.close();
    return data;
}

async function scrapeMultiplePages(urls) {
    const results = [];
    for (const url of urls) {
        const data = await scrapePage(url);
        if (data) {
            results.push(data);
        }
    }
    return results;
}

async function saveToJson(data, filename) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filename}`);
}

(async () => {
    const urls = [
        'https://www.bmc.net/public_programs', // Replace with actual URLs
        'https://www.bmc.net/customised_training',
        'https://www.bmc.net/research',
        'https://www.bmc.net/consulting',
        'https://www.bmc.net/in-house-training'
        // Add more URLs as needed
    ];

    const scrapedData = await scrapeMultiplePages(urls);
    await saveToJson(scrapedData, 'output.json');
})();