const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCourseDetails(page) {
    try {
        await page.waitForSelector('#course-pills-2', { timeout: 60000 }); // Syllabus tab
        const details = await page.evaluate(() => {
            const syllabusElement = document.querySelector('#course-pills-2');
            return syllabusElement ? {
                title: syllabusElement.querySelector('h2')?.textContent.trim() || 'Course Syllabus',
                content: syllabusElement.querySelector('.text-dark')?.innerHTML.trim() || ''
            } : { title: 'No Syllabus Available', content: '' };
        });
        const schedule = await scrapeCourseSchedule(page);
        return { ...details, schedule };
    } catch (err) {
        console.error('Error scraping course details:', err.message);
        return { title: 'Error', content: 'Failed to scrape syllabus', schedule: [] };
    }
}

async function scrapeCourseSchedule(page, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Ensure the schedule tab is present and clickable
            const scheduleTab = await page.$('#course-pills-tab-1');
            if (scheduleTab) {
                await scheduleTab.click();
                // Wait for potential navigation or content load after click
                await Promise.race([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
                    page.waitForSelector('#xcustomers', { timeout: 60000 })
                ]).catch(() => null); // Ignore navigation timeout if selector appears
            } else {
                console.log('Schedule tab not found, skipping to table check');
            }

            // Wait for the schedule table explicitly
            await page.waitForSelector('#xcustomers', { timeout: 60000 });
            const scheduleData = await page.evaluate(() => {
                const rows = document.querySelectorAll('#xcustomers tbody tr');
                return Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        venue: cells[0]?.textContent.trim() || '',
                        start_date: cells[1]?.textContent.trim() || '',
                        end_date: cells[2]?.textContent.trim() || '',
                        net_fees: cells[3]?.textContent.trim() || '',
                        pdf_link: cells[4]?.querySelector('a[href*="cover-downloading"]')?.href || '',
                        register_link: cells[4]?.querySelector('a[href*="register"]')?.href || ''
                    };
                });
            });

            return scheduleData.length > 0 ? scheduleData : [{ venue: 'No schedule available', start_date: '', end_date: '', net_fees: '', pdf_link: '', register_link: '' }];
        } catch (err) {
            console.error(`Attempt ${attempt + 1} failed scraping schedule:`, err.message);
            if (attempt === retries) {
                return [{ venue: 'Error scraping schedule', start_date: '', end_date: '', net_fees: '', pdf_link: '', register_link: '' }];
            }
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
        }
    }
}

async function scrapePageData(page, url) {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('#customers', { timeout: 60000 });

    const pageData = await page.evaluate(() => {
        const header = document.querySelector('.h4.pb-2')?.textContent.trim() || '';
        const description = Array.from(document.querySelectorAll('.mb-2 p')).map(p => p.textContent.trim()).join('\n');
        const coursesTitles = Array.from(document.querySelectorAll('#customers tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            const link = cells[1].querySelector('a');
            return {
                code: cells[0]?.textContent.trim() || '',
                title: link?.textContent.trim() || '',
                duration: cells[2]?.textContent.trim() || '',
                url: link?.href.startsWith('http') ? link.href : 'https://www.bmc.net' + link?.href || ''
            };
        });

        const cities = Array.from(document.querySelectorAll('#course-pills-2 .col-sm-6.col-lg-4.col-xl-3')).map(card => {
            const badge = card.querySelector('.badge');
            const titleLink = card.querySelector('.card-title a');
            const img = card.querySelector('.card-img');
            return {
                city: badge?.textContent.trim() || '',
                title: titleLink?.textContent.trim() || '',
                url: titleLink?.href || '',
                image: img?.src || ''
            };
        });

        const topCourses = Array.from(document.querySelectorAll('#course-pills-3 .grid-item')).map(card => {
            const badge = card.querySelector('.badge');
            const titleLink = card.querySelector('.card-title a');
            return {
                code: badge?.textContent.trim() || '',
                title: titleLink?.textContent.trim() || '',
                description: card.querySelector('p')?.textContent.trim() || '',
                location_date: card.querySelector('h4')?.textContent.trim() || '',
                duration: card.querySelector('.small')?.textContent.trim() || '',
                url: titleLink?.href || ''
            };
        });

        return { header, description, coursesTitles, cities, topCourses };
    });

    // Scrape details for each course with throttling
    for (let i = 0; i < pageData.coursesTitles.length; i++) {
        const course = pageData.coursesTitles[i];
        console.log(`Scraping details for: ${course.title}`);
        try {
            await page.goto(course.url, { waitUntil: 'networkidle2', timeout: 90000 });
            course.details = await scrapeCourseDetails(page);
        } catch (err) {
            console.error(`Failed to scrape details for ${course.title}:`, err.message);
            course.details = { title: 'Error', content: 'Navigation failed', schedule: [] };
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Throttle requests
    }

    return pageData;
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        protocolTimeout: 120000, // Increase to 120 seconds
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: null // Use full screen to avoid rendering issues
    });
    const page = await browser.newPage();

    try {
        const url = 'https://www.bmc.net/training/1/Management-and-Leadership';
        const data = await scrapePageData(page, url);
        fs.writeFileSync('ScrapedCoursesExtended.json', JSON.stringify(data, null, 2));
        console.log('Data saved to ScrapedCoursesExtended.json');
    } catch (err) {
        console.error('Error during scraping:', err);
    } finally {
        await browser.close();
    }
})();