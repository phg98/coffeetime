const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { CronJob } = require('cron');

const app = express();

app.use(cors());


let browser;
let lastGetImagineTime;
let ocrResultText;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

app.use('/static', express.static(path.join(__dirname)));

app.use('/getLastGetImagineTime', (req, res) => {
    res.json({ timestamp : lastGetImagineTime });
});

app.use('/getOcrResult', (req, res) => {
    res.json({ ocrResult : ocrResultText });
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

const performOCR = async (imageBuffer) => {
    try {
        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'kor', {
            logger: m => console.log(m),
        });
        return text;
    } catch (error) {
        console.error('Failed to perform OCR:', error.message);
        return null;
    }
};

const cropImage = async (imageBuffer, outputPath) => {
    try {
        const image = sharp(imageBuffer);
        const { width, height } = await image.metadata();

        // 크롭할 영역의 좌표와 크기 설정 (예: 숫자 부분)
        const left = width * 0.3; // 이미지의 20% 지점에서 시작
        const top = height * 0.2; // 이미지의 30% 지점에서 시작
        const cropWidth = width * 0.2; // 이미지의 60% 너비
        const cropHeight = height * 0.1; // 이미지의 40% 높이

        await image
            .extract({ left: Math.floor(left), top: Math.floor(top), width: Math.floor(cropWidth), height: Math.floor(cropHeight) })
            .toFile(outputPath);
    } catch (error) {
        console.error('Failed to crop image:', error.message);
        throw error;
    }
};

const transformOCRText = (text) => {
    return text.replace(/ /g, '').replace(/\//g, '7').replace(/!/g, '1').replace(/\|/g, '1');
};

const validateOCRText = async (text, imageBuffer) => {
    if (text.length > 3) {
        console.log('OCR result is invalid, retrying...');
        const newText = await performOCR(imageBuffer);
        if (newText) {
            return transformOCRText(newText);
        }
    }
    return text;
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

        // 이미지 소스를 base64 데이터로 변환
        const imgBase64 = await page.evaluate(async () => {
            const img = document.querySelector('img');
            if (img) {
                console.log('Image found:', img.src);

                // blob URL을 base64 데이터로 변환
                const response = await fetch(img.src);
                const blob = await response.blob();

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } else {
                console.log('No image found');
                return null;
            }
        });

        if (imgBase64) {
            const base64Data = imgBase64.split(',')[1]; // base64 헤더를 제거
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const croppedImagePath = path.join(__dirname, 'downloaded_image_cropped.jpg');

            // 테스트용 실행일때에는 ../testimages 폴더의 이미지파일을 읽어서 imageBuffer에 저장하여 사용한다.
            let testMode = false;
            if (testMode) {
                // ../testimages 폴더의 파일중에 랜덤하게 하나를 고른다.
                const testImageFiles = await fs.promises.readdir(path.join(__dirname, '../testimages'));
                const randomIndex = Math.floor(Math.random() * testImageFiles.length);
                const randomImageFile = testImageFiles[randomIndex];
                console.log('Random image file:', randomImageFile);
                const testImage = await fs.promises.readFile(path.join(__dirname, '../testimages', randomImageFile));
                const testImageBuffer = testImage;
                await cropImage(testImageBuffer, croppedImagePath);
            } else {
                await cropImage(imageBuffer, croppedImagePath);
            }
            lastGetImagineTime = new Date().toLocaleString();// 이미지 저장 시간
            console.log('Image saved at:', croppedImagePath);
          
            const croppedImageBuffer = await fs.promises.readFile(croppedImagePath);

            ocrResultText = await performOCR(croppedImageBuffer);
            if (ocrResultText) {
                ocrResultText = await validateOCRText(ocrResultText, croppedImageBuffer);
            }

            const timestamp = new Date().toLocaleString();
            const base64CroppedImage = croppedImageBuffer.toString('base64');

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
