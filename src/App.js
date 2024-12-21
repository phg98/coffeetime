import React, { useState, useEffect, useRef } from 'react';
import useWebContentFetcher from './web-content-fetcher-proxy';

function App() {
    const [ticketNumber, setTicketNumber] = useState('');
    const [currentNumber, setCurrentNumber] = useState(0);
    const [alertVisible, setAlertVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imageUpdatedTime, setImageUpdatedTime] = useState(''); // 이미지 업데이트 시간을 저장하는 상태
    const inputRef = useRef(null);
    const { fetchAndSave, loading, error } = useWebContentFetcher();

    const isNumber = (value) => {
        return !isNaN(value) && value.trim() !== '';
    };

    useEffect(() => {
        const fetchImage = async () => {
            try {
                const response = await fetch('http://localhost:3001/images');
                const data = await response.json();
                if (response.ok) {
                    setImageUrl(`http://localhost:3001/static/downloaded_image.jpg?timestamp=${new Date().getTime()}`);
                    setImageUpdatedTime(data.timestamp); // 서버에서 받은 시간으로 설정
                } else {
                    console.error('이미지를 가져오는 데 실패했습니다.');
                }
            } catch (error) {
                console.error('이미지를 가져오는 중 오류가 발생했습니다:', error);
            }
        };

        fetchImage(); // 처음 로드할 때 한번 이미지를 가져옴

        const interval = setInterval(fetchImage, 5000); // 5초마다 이미지 가져오기

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentNumber(prev => {
                const newNumber = prev + 1;
                if (isNumber(ticketNumber) && ticketNumber.length > 1 && newNumber === parseInt(ticketNumber)) {
                    setAlertVisible(true);
                }
                return newNumber;
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [ticketNumber]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isNumber(inputValue) || inputValue.length < 2) {
            alert("유효한 대기표 번호를 입력하세요.");
            return;
        }
        setTicketNumber(inputValue);
        setInputValue('');
        inputRef.current.focus();

        try {
            await fetchAndSave('https://www.testurl.com');
        } catch (err) {
            console.error('웹 페이지 저장 실패:', err);
        }
    };

    const handleCloseAlert = () => {
        setAlertVisible(false);
        setImageUrl(''); // 알림을 닫을 때 이미지를 초기화합니다.
    };

    return (
        <form onSubmit={handleSubmit} style={{ textAlign: 'center' }}>
            <h1>커피 대기 알림</h1>
            <p>현재 번호: {currentNumber}</p>
            <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                ref={inputRef}
                placeholder="대기표 번호 입력"
            />
            <button type="submit" disabled={loading}>
                {loading ? '가져오는 중...' : '제출'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {alertVisible && (
                <div>
                    <p>알림: 당신의 커피가 준비되었습니다!</p>
                    <button onClick={handleCloseAlert}>닫기</button>
                    {imageUrl && (
                        <>
                            <p>이미지 업데이트 시간: {imageUpdatedTime}</p>
                            <img src={imageUrl} alt="Downloaded" style={{ maxWidth: '100%', height: 'auto' }} />
                        </>
                    )}
                </div>
            )}
            {imageUrl && (
                <>
                    <p>이미지 업데이트 시간: {imageUpdatedTime}</p>
                    <img src={imageUrl} alt="Downloaded" style={{ maxWidth: '100%', height: 'auto' }} />
                </>
            )}
        </form>
    );
}

export default App;
