# coffeetime
회사 카페에서 커피를 주문후에 커피가 나올 때가 되면 알람을 주는 웹/앱

# 구성
- 사용자는 대기표 번호를 입력
- 대기표 번호와 현재 번호가 가까워지면 알람 발생
- 현재 번호 계산은
  -   커피 현황판 웹으로 부터 이미지를 받아와서
  - 숫자를 인식   

# 빌드 및 실행 방법
1. 필요 패키지 설치
    - `npm install`
2. 환경변수 설정
    - `copy .env.sample .env`
    - .env 파일을 열어서 하기 내용을 설정한다.
      - REACT_APP_SERVER_URL=http://localhost:3001  // 이대로 사용하면 된다.
      - TEST_OCR=1 // 1이면 크롤링없이 저장된 영상을 사용한다. 0이면 아래 ORDER_DISPLAY_SERVER_URL에 접속하여 크롤링한다.
      - ORDER_DISPLAY_SERVER_URL=https://www.test.com  // 실제 번호판 서버 주소로 바꿔야 한다.
4. 프론트 실행
    - `npm start`
5. 자동으로 브라우저가 실행된다. 실행이 안된다면 브라우저로 접속 (http://localhost:3000) 하면 화면이 뜬다.
