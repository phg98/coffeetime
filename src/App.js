import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
    const [ticketNumber, setTicketNumber] = useState('');
    const [currentNumber, setCurrentNumber] = useState(0);
    const [alertVisible, setAlertVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [imageBase64, setImageBase64] = useState('');
    const [imageUpdatedTime, setImageUpdatedTime] = useState('');
    const [ocrResult, setOcrResult] = useState('');
    const [error, setError] = useState(null);
    const [inputTime, setInputTime] = useState(null); // 숫자를 입력한 시간을 저장하는 상태
    const inputRef = useRef(null);

    const isNumber = (value) => {
        return !isNaN(value) && value.trim() !== '';
    };

    const findNumbersInString = (str) => {
        const numbers = str.match(/\d+/g);
        return numbers ? numbers.map(Number) : [];
    };

    const getTimeDifferenceInMinutes = (startTime, endTime) => {
        const diffInMs = Math.abs(endTime - startTime);
        return Math.floor(diffInMs / 1000 / 60); // 밀리초 단위를 분 단위로 변환
    };

    useEffect(() => {
        const fetchImage = async () => {
            const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
            console.log('서버 URL:', serverUrl);
            console.log('REACT_APP_SERVER_URL:', process.env.REACT_APP_SERVER_URL);
            try {
                const responseImg = await fetch(`${serverUrl}/static/downloaded_image_cropped.jpg`);
                const responseTime = await fetch(`${serverUrl}/getLastGetImagineTime`);
                const ocrResultResponse = await fetch(`${serverUrl}/getOcrResult`);
                const data = await responseTime.json();
                const ocrData = await ocrResultResponse.json();
                if (responseImg.ok) {
                    setImageBase64(`${serverUrl}/static/downloaded_image_cropped.jpg?timestamp=${new Date().getTime()}`);
                    setImageUpdatedTime(data?.timestamp ?? 'No Time data'); // 서버에서 받은 시간으로 설정
                    setOcrResult(ocrData?.ocrResult ?? 'No OCR data'); // OCR 결과 설정
                    setError(null);
                    setCurrentNumber(ocrData.ocrResult);
                } else {
                    console.error('이미지를 가져오는 데 실패했습니다.');
                    setImageUpdatedTime('No CCTV data');
                }
            } catch (error) {
                setImageUpdatedTime('No Time data');
                console.error('이미지를 가져오는 중 오류가 발생했습니다:', error);
                setError(error.message);
            }
        };

        fetchImage();

        const interval = setInterval(fetchImage, 5000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const ticketNum = parseInt(ticketNumber);
        const ocrNumbers = findNumbersInString(ocrResult);

        if (ocrNumbers.some(num => num >= ticketNum)) {
            const now = new Date();
            const waitingTime = getTimeDifferenceInMinutes(inputTime, now);
            notify(`${ticketNumber} 음료가 나왔습니다. (대기시간: ${waitingTime}분)`);
        }
    }, [ocrResult, ticketNumber, inputTime]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isNumber(inputValue)) {
            alert("유효한 대기표 번호를 입력하세요.");
            return;
        }
        setTicketNumber(inputValue);
        setInputValue('');
        setInputTime(new Date()); // 숫자를 입력한 시간을 저장
        inputRef.current.focus();
    };

    const handleCloseAlert = () => {
        setAlertVisible(false);
        setImageBase64('');
    };

    const notify = (message) => {
        if ('Notification' in window && navigator.serviceWorker) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification('커피 대기 알림', {
                            body: message,
                            icon: '/icon-192x192.png',
                        });
                    });
                }
            });
        } else {
            toast(message);
        }
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <form onSubmit={handleSubmit}>
                <h1>커피 대기 알림</h1>
                <p>현재 번호: {currentNumber}</p>
                <p>내 번호: {ticketNumber}</p>
                <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    ref={inputRef}
                    placeholder="대기표 번호 입력"
                />
                <button type="submit">
                    제출
                </button>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                {alertVisible && (
                    <div>
                        <p>알림: 당신의 커피가 준비되었습니다!</p>
                        <button onClick={handleCloseAlert}>닫기</button>
                        {imageBase64 && (
                            <>
                                <p>이미지 업데이트 시간: {imageUpdatedTime}</p>
                                <img src={imageBase64} alt="Downloaded" style={{ maxWidth: '100%', height: 'auto' }} />
                                <p>추출된 숫자: {ocrResult}</p>
                            </>
                        )}
                    </div>
                )}
                {imageBase64 && (
                    <>
                        <p>이미지 업데이트 시간: {imageUpdatedTime}</p>
                        <img src={imageBase64} alt="Downloaded" style={{ maxWidth: '100%', height: 'auto' }} />
                        <p>추출된 숫자: {ocrResult}</p>
                    </>
                )}
            </form>
            <ToastContainer />
        </div>
    );
}

export default App;
