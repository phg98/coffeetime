const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
// const Tesseract = require('tesseract.js');
const { createWorker } = require('tesseract.js');
const app = express();

app.use(cors());

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

app.use('/static', express.static(path.join(__dirname)));

let browser;

(async () => {
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--single-process',
                '--disable-extensions',
            ],
        });
        console.log('Browser launched successfully');
    } catch (error) {
        console.error('Failed to launch browser:', error.message);
    }
})();

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

app.get('/images', async (req, res) => {
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
                    res.status(500).send('Failed to save image');
                } else {
                    const timestamp = new Date().toLocaleString(); // 이미지 저장 시간
                    console.log('Image saved at:', imagePath);
                    const region = { left: 800, top: 430, width: 500, height: 160 }; // Example region
                    // for Test
                    let testImagePath = path.join(__dirname, 'downloaded_image.sample.jpg');
                    const ocrResult = await performOCR(testImagePath, region);
                    //const ocrResult = await performOCR(imagePath, region);
                    res.json({ message: 'Image saved successfully', timestamp, ocrResult });
                }
            });
        } else {
            console.error('No images found on the page');
            res.status(404).send('No images found on the page');
        }
    } catch (error) {
        console.error('Failed to fetch image URLs:', error.message);
        res.status(500).send(`Failed to fetch image URLs: ${error.message}`);
    } finally {
        if (page) {
            await page.close();
        }
    }
});

app.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});
