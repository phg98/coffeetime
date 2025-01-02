const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
// const Tesseract = require('tesseract.js');
const { createWorker } = require('tesseract.js');
const { CronJob } = require('cron');

const app = express();

app.use(cors());


let browser;
let lastGetImagineTime;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

app.use('/static', express.static(path.join(__dirname)));

app.use('/getLastGetImagineTime', (req, res) => {
    res.json({ timestamp : lastGetImagineTime });
});

// puppeteer 브라우저를 오픈한다.
const openHiddenBrowser = async () => {
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-extensions',
            ],
        });
        console.log('Browser launched successfully');
        return browser;
    } catch (error) {
        console.error('Failed to launch browser:', error.message);
    }
};

const performOCR = async (imagePath, rectangle) => {
    try {        
        const worker = await createWorker('eng');
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789',
        });
        const { data: { text } } = await worker.recognize(imagePath, 'eng', {
            // logger: m => console.log(m),
            // tessedit_char_whitelist: '0123456789',
            rectangle
        });
        return text;
    } catch (error) {
        console.error('Failed to perform OCR:', error.message);
        return null;
    }
};

// 평일 오전 7시부터 오후 5시까지 5초마다 이미지를 가져오는 스케줄러
// 지금은 테스트용으로 매일 시간무관하게 1분마다 이미지를 가져오도록 설정
const getImageScheduler = async () => {
    try {
        //const job = new CronJob('*/5 * 7-17 * * 1-5', getHanwha701Image, null, true, 'Asia/Seoul');
        const job = new CronJob('*/1 * * * *', getHanwha701Image, null, true, 'Asia/Seoul');
        console.log("Start Image Scheduler");
        job.start();

    } catch (error) {
        console.error('Failed to start image scheduler:', error.message);
    }
};

// hanwha701.com 에서 CCTV 이미지를 가져온다.
const getHanwha701Image = async () => {
    console.log("getHanwha701Image");
    const targetUrl = 'https://www.hanwha701.com';
    let page;
    try {
        if (!browser) {
            throw new Error('Browser instance is not initialized');
        }
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        page.on('console', msg => {
            if (!msg.text().includes('Service Worker registration successful')) {
                console.log('PAGE LOG:', msg.text());
            }
        });
        page.on('requestfailed', request => {
            console.log(`Request failed: ${request.url()} - ${request.failure().errorText}`);
        });

        await page.goto(targetUrl, { waitUntil: 'load', timeout: 90000 });

        // 5초 대기
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const imgSrc = await page.evaluate(() => {
            const img = document.querySelector('img');
            if (img) {
                console.log('Image found:', img.src);
                return img.src;
            } else {
                console.log('No image found');
                return null;
            }
        });

        if (imgSrc) {
            const viewSource = await page.goto(imgSrc);
            const buffer = await viewSource.buffer();
            const imagePath = path.join(__dirname, 'downloaded_image.jpg');

            fs.writeFile(imagePath, buffer, async (err) => {
                if (err) {
                    console.error('Failed to save image:', err);
                    // res.status(500).send('Failed to save image');
                } else {
                    lastGetImagineTime = new Date().toLocaleString();// 이미지 저장 시간
                    console.log('Image saved at:', imagePath);
                    const region = { left: 800, top: 430, width: 500, height: 160 }; // Example region
                    // for Test
                    let testImagePath = path.join(__dirname, 'downloaded_image.sample.jpg');
                    const ocrResult = await performOCR(testImagePath, region);
                    //const ocrResult = await performOCR(imagePath, region);
                    //res.json({ message: 'Image saved successfully', timestamp, ocrResult });
                }
            });
        } else {
            console.error('No images found on the page');
            // res.status(404).send('No images found on the page');
        }
    } catch (error) {
        console.error('Failed to fetch image URLs:', error.message);
        // res.status(500).send(`Failed to fetch image URLs: ${error.message}`);
    } finally {
        if (page) {
            await page.close();
        }
    }
};

const init = () =>{
    console.log("Init Server Start !!");
    openHiddenBrowser();
    getImageScheduler();
}

init();

app.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});
