const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCourseDetails(page) {
    try {
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
        console.error('Error scraping course details:', err);
        return { title: 'Error', content: 'Failed to scrape', schedule: [] };
    }
}

async function scrapeCourseSchedule(page) {
    try {
        const scheduleTab = await page.$('#course-pills-tab-1');
        if (scheduleTab) {
            await scheduleTab.click();
            await page.waitForSelector('#xcustomers', { timeout: 5000 });
        }

        return await page.$$eval('#xcustomers tbody tr', rows => {
            return rows.map(row => {
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
        }) || [];
    } catch (err) {
        console.error('Error scraping schedule:', err);
        return [{ venue: 'Error scraping schedule', start_date: '', end_date: '', net_fees: '', pdf_link: '', register_link: '' }];
    }
}

async function scrapePageData(page, url) {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.card-body', { timeout: 10000 });

    const pageData = await page.evaluate(() => {
        // Header and Description
        const header = document.querySelector('.h4.pb-2')?.textContent.trim() || '';
        const description = Array.from(document.querySelectorAll('.mb-2 p')).map(p => p.textContent.trim()).join('\n');

        // Courses Titles
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

        // Courses Cities
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

        // All Courses Cities
        const allCities = Array.from(document.querySelectorAll('#course-pills-2 .col-sm-6.col-xl-3')).map(card => {
            const link = card.querySelector('a');
            const img = card.querySelector('img');
            return {
                title: link?.textContent.trim() || '',
                url: link?.href || '',
                image: img?.src || ''
            };
        }).filter(city => city.title && city.url);

        // Top Courses
        const topCourses = Array.from(document.querySelectorAll('#course-pills-3 .grid-item')).map(card => {
            const badge = card.querySelector('.badge');
            const titleLink = card.querySelector('.card-title a');
            const description = card.querySelector('p')?.textContent.trim();
            const locationDate = card.querySelector('h4')?.textContent.trim();
            const duration = card.querySelector('.small')?.textContent.trim();
            return {
                code: badge?.textContent.trim() || '',
                title: titleLink?.textContent.trim() || '',
                description: description || '',
                location_date: locationDate || '',
                duration: duration || '',
                url: titleLink?.href || ''
            };
        });

        return {
            header,
            description,
            coursesTitles: {
                sectionTitle: document.querySelector('#course-pills-1 h3')?.textContent.trim() || '',
                courses: coursesTitles
            },
            coursesCities: {
                sectionTitle: document.querySelector('#course-pills-2 h3')?.textContent.trim() || '',
                cities,
                allCities
            },
            topCourses: {
                sectionTitle: document.querySelector('#course-pills-3 h3')?.textContent.trim() || '',
                courses: topCourses
            }
        };
    });

    // Scrape details for each course
    for (let course of pageData.coursesTitles.courses) {
        console.log(`Scraping details for: ${course.title}`);
        await page.goto(course.url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#course-pills-2', { timeout: 10000 }).catch(() => console.log('Syllabus tab not found'));
        course.details = await scrapeCourseDetails(page);
    }

    return pageData;
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        const url = 'https://www.bmc.net/training/1/Management-and-Leadership'; // Replace with actual URL
        const data = await scrapePageData(page, url);
        fs.writeFileSync('ScrapedCoursesExtended.json', JSON.stringify(data, null, 2));
        console.log('Data saved to ScrapedCoursesExtended.json');
    } catch (err) {
        console.error('Error during scraping:', err);
    } finally {
        await browser.close();
    }
})();