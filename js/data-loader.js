/**
 * Data Loader - GitHub에서 JSON 데이터 로드
 */

class DataLoader {
    constructor() {
        this.data = null;
        this.rawData = null;
        this.gitHubRepo = 'https://raw.githubusercontent.com'; // 기본값
        this.dataUrl = null;
    }

    /**
     * GitHub Pages 저장소에서 JSON 데이터 로드
     * @param {string} username GitHub 사용자명
     * @param {string} repo 저장소명
     * @param {string} filepath 데이터 파일 경로 (예: data/sensor_data.json)
     */
    async loadFromGitHub(username, repo, filepath) {
        const url = `${this.gitHubRepo}/${username}/${repo}/main/${filepath}`;
        return this.loadFromUrl(url);
    }

    /**
     * URL에서 JSON 데이터 로드
     * @param {string} url JSON 파일 URL
     */
    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.rawData = await response.json();
            this._processData();
            
            console.log('[+] 데이터 로드 완료:', this.data);
            return this.data;
        } catch (error) {
            console.error('[ERROR] 데이터 로드 실패:', error);
            throw error;
        }
    }

    /**
     * 로컬 파일 업로드로 데이터 로드 (개발용)
     */
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    this.rawData = JSON.parse(event.target.result);
                    this._processData();
                    resolve(this.data);
                } catch (error) {
                    reject(new Error('JSON 파싱 오류: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('파일 읽기 오류'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * 센서 목록 조회
     */
    getSensorList() {
        if (!this.data) return [];
        return Object.keys(this.data.sensors);
    }

    /**
     * 특정 센서의 데이터 조회
     */
    getSensorData(sensorName) {
        if (!this.data) return null;
        return this.data.sensors[sensorName] || null;
    }

    /**
     * 특정 센서의 값 배열 조회 (신호처리용)
     */
    getSensorValues(sensorName) {
        const sensorData = this.getSensorData(sensorName);
        if (!sensorData) return [];
        return sensorData.map(record => record.value);
    }

    /**
     * 특정 센서의 타임스탬프 배열 조회
     */
    getSensorTimestamps(sensorName) {
        const sensorData = this.getSensorData(sensorName);
        if (!sensorData) return [];
        return sensorData.map(record => record.timestamp);
    }

    /**
     * 메타데이터 조회
     */
    getMetadata() {
        if (!this.data) return null;
        return {
            timestamp: this.data.timestamp,
            sampleIntervalMs: this.data.sample_interval_ms,
            sensorCount: Object.keys(this.data.sensors).length,
            sampleCount: this.data.sensors[Object.keys(this.data.sensors)[0]]?.length || 0
        };
    }

    /**
     * 데이터 처리 및 정규화
     */
    _processData() {
        if (!this.rawData || !this.rawData.sensors) {
            throw new Error('유효하지 않은 JSON 구조');
        }

        this.data = {
            timestamp: this.rawData.timestamp || new Date().toISOString(),
            sample_interval_ms: this.rawData.sample_interval_ms || 100,
            sensors: {}
        };

        // 센서별 데이터 정규화
        for (const [sensorName, sensorData] of Object.entries(this.rawData.sensors)) {
            if (!Array.isArray(sensorData)) continue;

            this.data.sensors[sensorName] = sensorData.map(record => ({
                timestamp: record.timestamp || '',
                value: parseFloat(record.value) || 0,
                type: record.type || 'Unknown'
            }));
        }
    }

    /**
     * 데이터 통계 계산
     */
    getStatistics(sensorName) {
        const values = this.getSensorValues(sensorName);
        
        if (values.length === 0) {
            return {
                mean: 0,
                min: 0,
                max: 0,
                stdDev: 0,
                count: 0
            };
        }

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            mean: parseFloat(mean.toFixed(2)),
            min: parseFloat(min.toFixed(2)),
            max: parseFloat(max.toFixed(2)),
            stdDev: parseFloat(stdDev.toFixed(2)),
            count: values.length
        };
    }

    /**
     * 시간 범위 조회
     */
    getTimeRange() {
        if (!this.data) return null;

        const sensors = Object.values(this.data.sensors);
        if (sensors.length === 0 || sensors[0].length === 0) {
            return null;
        }

        const timestamps = sensors[0].map(r => new Date(r.timestamp));
        const startTime = new Date(Math.min(...timestamps));
        const endTime = new Date(Math.max(...timestamps));

        return {
            start: startTime,
            end: endTime,
            duration: (endTime - startTime) / 1000 // 초 단위
        };
    }

    /**
     * 고장 진단 (간단한 규칙 기반)
     */
    performDiagnosis() {
        const warnings = [];

        if (!this.data) return warnings;

        // RPM 패턴 분석
        const fanSensors = Object.entries(this.data.sensors)
            .filter(([name]) => name.includes('FAN') && name.includes('RPM'));

        for (const [sensorName, sensorData] of fanSensors) {
            const values = sensorData.map(r => r.value);
            const stats = this.getStatistics(sensorName);

            // 조건 1: 평균 RPM이 너무 낮음
            if (stats.mean < 500) {
                warnings.push({
                    level: 'danger',
                    message: `${sensorName}: RPM이 비정상적으로 낮음 (평균 ${stats.mean})`
                });
            }

            // 조건 2: RPM 변동이 너무 심함
            if (stats.stdDev > stats.mean * 0.5) {
                warnings.push({
                    level: 'warning',
                    message: `${sensorName}: RPM 변동이 심함 (편차 ${stats.stdDev})`
                });
            }

            // 조건 3: 최근 값이 0에 가깐
            if (values.length > 0 && values[values.length - 1] < 100) {
                warnings.push({
                    level: 'danger',
                    message: `${sensorName}: 회전이 거의 멈춤`
                });
            }
        }

        // 온도 패턴 분석
        const tempSensors = Object.entries(this.data.sensors)
            .filter(([name]) => name.includes('CPU') && name.includes('Temperature'));

        for (const [sensorName, sensorData] of tempSensors) {
            const stats = this.getStatistics(sensorName);

            if (stats.max > 90) {
                warnings.push({
                    level: 'danger',
                    message: `${sensorName}: 온도가 위험 수준 (최대 ${stats.max}°C)`
                });
            } else if (stats.max > 80) {
                warnings.push({
                    level: 'warning',
                    message: `${sensorName}: 온도가 높음 (최대 ${stats.max}°C)`
                });
            }
        }

        return warnings;
    }

    /**
     * 샘플 데이터 생성 (테스트용)
     */
    static generateSampleData() {
        const sampleCount = 600; // 1분 데이터 (100ms 간격)
        const timestamp = new Date();
        const sensors = {};

        // CPU FAN RPM 데이터
        sensors['Motherboard_CPU FAN'] = [];
        for (let i = 0; i < sampleCount; i++) {
            const noise = Math.sin(i / 50) * 100 + Math.random() * 50;
            const rpm = 2800 + noise;
            sensors['Motherboard_CPU FAN'].push({
                timestamp: new Date(timestamp.getTime() + i * 100).toISOString(),
                value: Math.max(0, rpm),
                type: 'Fan'
            });
        }

        // CPU 온도
        sensors['Intel Core i7_CPU Package'] = [];
        for (let i = 0; i < sampleCount; i++) {
            const trend = i / sampleCount * 5; // 시간에 따라 증가
            const noise = Math.sin(i / 100) * 2 + Math.random() * 1;
            const temp = 45 + trend + noise;
            sensors['Intel Core i7_CPU Package'].push({
                timestamp: new Date(timestamp.getTime() + i * 100).toISOString(),
                value: parseFloat(temp.toFixed(1)),
                type: 'Temperature'
            });
        }

        // PWM 비율
        sensors['Motherboard_CPU FAN PWM'] = [];
        for (let i = 0; i < sampleCount; i++) {
            const pwm = 50 + Math.sin(i / 100) * 20;
            sensors['Motherboard_CPU FAN PWM'].push({
                timestamp: new Date(timestamp.getTime() + i * 100).toISOString(),
                value: Math.max(0, Math.min(100, pwm)),
                type: 'Control'
            });
        }

        return {
            timestamp: timestamp.toISOString(),
            sample_interval_ms: 100,
            sensors: sensors
        };
    }
}

// 전역 변수로 dataLoader 인스턴스 생성
const dataLoader = new DataLoader();
