const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeCourseSchedule(page) {
    // Navigate to the Course Schedule tab if needed
    const scheduleTab = await page.$('#course-pills-tab-1');
    if (scheduleTab) {
        await scheduleTab.click();
        await page.waitForSelector('#xcustomers');
    }

    // Extract table data
    const schedule = await page.$$eval('#xcustomers tbody tr', rows => {
        return rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                venue: cells[0].textContent.trim(),
                start_date: cells[1].textContent.trim(),
                end_date: cells[2].textContent.trim(),
                net_fees: cells[3].textContent.trim(),
                pdf_link: cells[4].querySelector('a[href*="cover-downloading"]')?.href,
                register_link: cells[4].querySelector('a[href*="register"]')?.href
            };
        });
    });

    return schedule;
}

async function scrapeCourseSyllabus(page) {
    // Navigate to the Course Syllabus tab
    const syllabusTab = await page.$('#course-pills-tab-2');
    if (syllabusTab) {
        await syllabusTab.click();
        await page.waitForSelector('#course-pills-2');
    }

    // Extract syllabus content
    const syllabus = await page.$eval('#course-pills-2', el => {
        const title = el.querySelector('h2')?.textContent.trim() || 'Course Syllabus';
        const content = el.querySelector('.text-dark')?.innerHTML.trim() || '';
        return {
            title: title,
            content: content
        };
    });

    return syllabus;
}

async function scrapeCourseDetails(page, url) {
    await page.goto(url);
    await page.waitForSelector('#course-pills-2');
    
    const syllabus = await page.$eval('#course-pills-2', el => el.textContent.trim());
    return syllabus;
}

async function scrapeSchedule(page) {
    await page.waitForSelector('#xcustomers');
    
    const schedule = await page.$$eval('#xcustomers tbody tr', (rows) => {
        return rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                venue: cells[0].textContent.trim(),
                start_date: cells[1].textContent.trim(),
                end_date: cells[2].textContent.trim(),
                fees: cells[3].textContent.trim(),
                pdf_link: cells[4].querySelector('a[href*="cover-downloading"]')?.href || null,
                register_link: cells[4].querySelector('a[href*="register"]')?.href || null
            };
        });
    });

    return schedule;
}

async function scrapeCourses(page) {
    await page.goto('https://www.bmc.net/training/1/Management-and-Leadership');
    
    const courses = await scrapeCourses(page);
    const schedule = await scrapeSchedule(page);

    return {
        courses,
        schedule
    };
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        const courses = await scrapeCourses(page);
        
        // Add syllabus details to each course
        for (let course of courses.courses) {
            course.syllabus = await scrapeCourseDetails(page, course.url);
        }
        
        fs.writeFileSync('courses.json', JSON.stringify(courses, null, 2));
        console.log('Courses data saved to courses.json');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
})();
