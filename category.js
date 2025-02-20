const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
        // Extract data from the first div
        const firstDiv = document.querySelector('.col-lg-7.position-relative');
        const title = firstDiv?.querySelector('h1')?.innerText.trim() || '';
        const description = firstDiv?.querySelector('p')?.innerText.trim() || '';

        // Extract data from the second div
        const secondDiv = document.querySelector('.mb-2');
        const summary = Array.from(secondDiv?.querySelectorAll('p'))
            .map(p => p.innerText.trim())
            .join('\n');

        // Extract data from the third div (image)
        const thirdDiv = document.querySelector('.col-lg-3.position-relative');
        const image = thirdDiv?.querySelector('img')?.src || '';

        return {
            title,
            description,
            summary,
            image,
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
        'https://www.bmc.net/training/1/Management-and-Leadership', // Replace with actual URLs
        'https://www.bmc.net/training/2/Accounting-and-Budgeting',
        'https://www.bmc.net/training/3/Human-Resource-Management',
        'https://www.bmc.net/training/4/Project-Procurement-and-Contracts',
        'https://www.bmc.net/training/5/Secretarial-and-Administration',
        'https://www.bmc.net/training/6/Public-Relations-Customer-Services-Sales-and-Marketing',
        'https://www.bmc.net/training/7/Quality-and-Productivity',
        'https://www.bmc.net/training/8/Maintenance-Engineering-Training',
        'https://www.bmc.net/training/9/Oil-and-Gas',
        'https://www.bmc.net/training/11/Construction-and-Civil-Engineering-Training',
        'https://www.bmc.net/training/12/Facilities-Management-Training',
        'https://www.bmc.net/training/13/Safety-Training',
        'https://www.bmc.net/training/15/Electrical-and-Power-Engineering-Training'

        // Add more URLs as needed
    ];

    const scrapedData = await scrapeMultiplePages(urls);
    await saveToJson(scrapedData, 'category.json');
})();