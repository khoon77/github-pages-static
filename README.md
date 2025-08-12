# 한국 정부 채용공고 포털

한국 중앙정부 25개 기관의 채용공고를 실시간으로 수집하고 제공하는 웹 애플리케이션입니다.

## 주요 기능

- 🏛️ **25개 정부기관 실시간 모니터링**: 19개 부처, 3개 처, 5개 위원회
- 🔄 **자동 업데이트**: 5분마다 새로운 채용공고 자동 수집
- 🎯 **정확한 필터링**: 부처별 맞춤형 키워드 필터링
- 📱 **반응형 디자인**: 모바일/데스크톱 모든 환경 지원
- 🔍 **고급 검색**: 부처별, 직종별, 고용형태별 필터링
- 📊 **실시간 통계**: 전체 공고수, 긴급 공고, 신규 공고 현황

## 데이터 소스

### 19개 부처
기획재정부, 교육부, 과학기술정보통신부, 외교부, 통일부, 법무부, 국방부, 행정안전부, 국가보훈부, 문화체육관광부, 농림축산식품부, 산업통상자원부, 보건복지부, 환경부, 고용노동부, 여성가족부, 국토교통부, 인사혁신처, 법제처

### 3개 처
식품의약품안전처

### 5개 위원회  
공정거래위원회, 국민권익위원회, 금융위원회, 개인정보보호위원회, 원자력안전위원회

## 기술 스택

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Scraping**: Cheerio for HTML parsing
- **State Management**: TanStack Query
- **Build Tools**: Vite, ESBuild

## 로컬 개발 환경 설정

### 필수 요구사항
- Node.js 18+ 
- PostgreSQL 데이터베이스

### 설치 및 실행

1. 저장소 클론
```bash
git clone https://github.com/[your-username]/korean-gov-jobs.git
cd korean-gov-jobs
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일에서 DATABASE_URL 설정
```

4. 데이터베이스 스키마 생성
```bash
npm run db:push
```

5. 개발 서버 실행
```bash
npm run dev
```

6. 브라우저에서 http://localhost:5000 접속

## 배포

### Vercel 배포
1. Vercel에 GitHub 저장소 연결
2. 환경 변수 설정 (DATABASE_URL 등)
3. 자동 배포 완료

### 환경 변수
```
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
```

## 특별한 스크래핑 기능

### 고용노동부
- '[인사]' 카테고리 직접 접근 (searchDivCd=004)
- 인사 관련 게시글만 정확하게 수집

### 행정안전부  
- 엄격한 키워드 필터링: '채용', '임기제', '공무직', '근로자'
- 혼재된 게시판에서 채용 관련 글만 추출

### 법제처
- 포괄적 채용 키워드로 관련 공고 수집

## 데이터 관리

- **자동 정리**: 60일 이상 된 공고 자동 삭제
- **중복 방지**: 동일 공고 재수집 방지
- **신규 표시**: 새로 수집된 공고 자동 마킹

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 지원

문의사항이나 버그 리포트는 GitHub Issues를 이용해 주세요.

---

⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요!