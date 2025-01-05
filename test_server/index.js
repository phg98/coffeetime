const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { CronJob } = require('cron');
require('dotenv').config(); // .env 파일에서 환경 변수를 불러옴

const app = express();

app.use(cors());

let browser;
let lastGetImagineTime;
let ocrResult;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

app.use('/static', express.static(path.join(__dirname)));

app.use('/getLastGetImagineTime', (req, res) => {
    res.json({ timestamp: lastGetImagineTime });
});

app.use('/getOcrResult', (req, res) => {
    res.json({ ocrResult });
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
            // 숫자만 인식하도록 설정
            tessedit_char_whitelist: '0123456789'
        });
        
        // 공백 없애기, / 를 7로 변환, !, | 를 1로 변환 
        let transformedText = text.replace(/ /g, '').replace(/\//g, '7').replace(/!/g, '1').replace(/\|/g, '1'); 
        
        // OCR 결과에서 숫자만 추출 
        const numbersOnly = transformedText.match(/\d+/g)?.join('') || ''; 
        
        return numbersOnly;
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

// 로컬 testimages 디렉터리에서 랜덤하게 이미지 파일을 선택하여 OCR을 수행
const getLocalTestImage = async () => {
    try {
        const imagesDir = path.join(__dirname, '..', 'testimages'); // 상위 디렉터리에 위치한 testimages 폴더
        const files = fs.readdirSync(imagesDir);
        const randomFile = files[Math.floor(Math.random() * files.length)];
        const imagePath = path.join(imagesDir, randomFile);

        console.log(`Randomly selected image: ${imagePath}`);
        
        const imageBuffer = fs.readFileSync(imagePath);
        const croppedImagePath = path.join(__dirname, 'downloaded_image_cropped.jpg');

        await cropImage(imageBuffer, croppedImagePath);
        lastGetImagineTime = new Date().toLocaleString(); // 이미지 저장 시간
        console.log('Image saved at:', croppedImagePath);
      
        const croppedImageBuffer = await fs.promises.readFile(croppedImagePath);

        let ocrResultText = await performOCR(croppedImageBuffer);
        if (ocrResultText) {
            ocrResultText = await validateOCRText(ocrResultText, croppedImageBuffer);
        }

        ocrResult = ocrResultText;

    } catch (error) {
        console.error('Failed to perform OCR on local test image:', error.message);
    }
};

// hanwha701.com 에서 CCTV 이미지를 가져온다.
const getHanwha701Image = async () => {
    if (process.env.TEST_OCR === '1') {
        await getLocalTestImage();
        return;
    }

    console.log("getHanwha701Image");
    const targetUrl = 'https://www.hanwha701.com';
    let page;

    try {
        if (!browser) {
            // retry
                console.log('Retrying to launch browser...');
                browser = await openHiddenBrowser();
                if (!browser) {
                    throw new Error('Browser instance is not initialized');
                }
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

            await cropImage(imageBuffer, croppedImagePath);
            lastGetImagineTime = new Date().toLocaleString(); // 이미지 저장 시간
            console.log('Image saved at:', croppedImagePath);
          
            const croppedImageBuffer = await fs.promises.readFile(croppedImagePath);

            ocrResultText = await performOCR(croppedImageBuffer);
            if (ocrResultText) {
                ocrResultText = await validateOCRText(ocrResultText, croppedImageBuffer);
            }

            ocrResult = ocrResultText;

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

const init = () => {
    console.log("Init Server Start !!");
    openHiddenBrowser();
    getImageScheduler();
}

init();

app.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});
