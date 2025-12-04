/**
 * CoolDiag Dashboard - Main Logic
 */

class Dashboard {
    constructor() {
        this.selectedSensorsByType = {};  // 타입별 센서 저장: {'Fan': ['센서1', '센서2'], 'Temperature': [...]}
        this.currentGraphType = 'timeseries';
        this.updateInterval = 10000;
        this.autoUpdateTimer = null;
        this.waveletFrequencyMode = false;
        this.selectedRangeData = null;  // 선택된 영역 데이터 저장
        this.selectionEventBound = false;  // 선택 이벤트 바인딩 여부
        this.githubConfig = {
            username: 'YOUR_USERNAME',
            repo: 'YOUR_REPO',
            filepath: 'data/sensor_data.json'
        };

        // 신호처리 결과 저장 (Export용)
        this.lastSignalProcessingResult = null;
        this.lastProcessingType = null;
        this.lastProcessingSensor = null;

        this.init();
    }

    /**
     * 초기화
     */
    init() {
        console.log('[*] 대시보드 초기화...');
        
        // 이벤트 리스너 설정
        this._setupEventListeners();
        
        // 샘플 데이터 로드 (테스트용)
        this._loadSampleData();
    }

    /**
     * 센서 타입 라벨 (드롭다운 표시용)
     */
    _getTypeLabel(type) {
        const labels = {
            'Temperature': '🌡️ 온도 (°C)',
            'Fan': '🌀 팬 (RPM)',
            'Control': '⚙️ 제어 (PWM %)',
            'Voltage': '⚡ 전압 (V)',
            'Power': '💡 전력 (W)',
            'Unknown': '❓ 기타'
        };
        return labels[type] || type;
    }

    /**
     * 선택된 센서의 타입 조회
     */
    _getCurrentSensorType() {
        // 단일 타입이 선택되었을 때만 사용
        const types = Object.keys(this.selectedSensorsByType);
        if (types.length !== 1) return 'Unknown';
        
        const sensorType = types[0];
        const sensors = this.selectedSensorsByType[sensorType];
        
        if (sensors.length === 0) return 'Unknown';
        
        const sensorData = dataLoader.getSensorData(sensors[0]);
        if (sensorData && sensorData.length > 0) {
            return sensorData[0].type;
        }
        return 'Unknown';
    }

    /**
     * 센서 타입별 허용 그래프 타입
     * 다중타입(2개)일 때는 시계열만 허용
     */
    _getAllowedGraphTypes() {
        // 다중타입 선택 시 시계열만 허용
        const typeCount = Object.keys(this.selectedSensorsByType).length;
        if (typeCount > 1) {
            return [
                { value: 'timeseries', label: '시계열 (다중센서)' }
            ];
        }
        
        // 타입 선택 안됨
        if (typeCount === 0) {
            return [
                { value: 'timeseries', label: '시계열' }
            ];
        }
        
        // 단일타입 선택 시 모든 그래프 타입 허용
        const sensorType = this._getCurrentSensorType();
        
        const allowedTypes = {
            'Temperature': [
                { value: 'timeseries', label: '시계열 (온도)' }
            ],
            'Fan': [
                { value: 'timeseries', label: '시계열 (RPM)' },
                { value: 'fft', label: 'FFT' },
                { value: 'stft', label: 'STFT' },
                { value: 'wavelet', label: 'Wavelet Transform' },
                { value: 'hilbert', label: 'envelope extraction' }
            ],
            'Control': [
                { value: 'timeseries', label: '시계열 (PWM %)' },
                { value: 'fft', label: 'FFT' }
            ],
            'Voltage': [
                { value: 'timeseries', label: '시계열 (전압)' }
            ],
            'Power': [
                { value: 'timeseries', label: '시계열 (전력)' }
            ],
            'Unknown': [
                { value: 'timeseries', label: '시계열' }
            ]
        };
        
        return allowedTypes[sensorType] || allowedTypes['Unknown'];
    }

    /**
     * 그래프 타입 옵션 업데이트 (센서 타입별 필터링)
     */
    _updateGraphTypeOptions() {
        const graphTypeSelect = document.getElementById('graphType');
        const allowedTypes = this._getAllowedGraphTypes();
        const currentValue = graphTypeSelect.value;

        graphTypeSelect.innerHTML = '';
        
        allowedTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            graphTypeSelect.appendChild(option);
        });

        // 현재 값이 허용 목록에 없으면 첫 번째로 변경
        if (!allowedTypes.find(t => t.value === currentValue)) {
            this.currentGraphType = allowedTypes[0].value;
            graphTypeSelect.value = this.currentGraphType;
        } else {
            graphTypeSelect.value = currentValue;
        }
    }

    /**
     * Y축 레이블 자동 설정
     */
    _getYAxisLabel() {
        const sensorType = this._getCurrentSensorType();
        
        const labels = {
            'Temperature': '온도 (°C)',
            'Fan': 'RPM (회전/분)',
            'Control': 'PWM (%)',
            'Voltage': '전압 (V)',
            'Power': '전력 (W)',
            'Unknown': '값'
        };
        
        return labels[sensorType] || '값';
    }
    _setupEventListeners() {
        // 그래프 타입 선택
        document.getElementById('graphType').addEventListener('change', (e) => {
            this.currentGraphType = e.target.value;
            // 그래프 타입 변경 시 이벤트 바인딩 플래그 리셋
            this.selectionEventBound = false;

            // 전처리 패널 표시/숨김
            this._updateFullSignalPreprocessVisibility();

            this.renderGraph();
        });

        // 갱신 간격 변경
        document.getElementById('updateInterval').addEventListener('change', (e) => {
            this.updateInterval = parseInt(e.target.value);
            this._restartAutoUpdate();
        });

        // 버튼 클릭 이벤트
        document.getElementById('loadDataBtn').addEventListener('click', () => this.loadData());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('refreshBtn').addEventListener('click', () => this.renderGraph());

        // 탭 클릭
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this._switchTab(e.target.dataset.tab);
            });
        });

        // 파일 업로드 (Ctrl+O)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json';
                fileInput.onchange = async (event) => {
                    const file = event.target.files[0];
                    if (file) {
                        await dataLoader.loadFromFile(file);
                        this._updateUI();
                    }
                };
                fileInput.click();
            }
        });

        // 신호처리 UI 이벤트 리스너
        document.getElementById('applySignalProcessingBtn').addEventListener('click', () => {
            this._applySignalProcessing();
        });

        document.getElementById('cancelSignalProcessingBtn').addEventListener('click', () => {
            this._hideSignalProcessingUI();
        });

        // 전체 신호 전처리 체크박스 변경 시 그래프 재렌더링
        document.getElementById('fullPreprocessRemoveDC')?.addEventListener('change', () => {
            if (this._isSignalProcessingGraphType()) {
                this.renderGraph();
            }
        });

        document.getElementById('fullPreprocessDetrend')?.addEventListener('change', () => {
            if (this._isSignalProcessingGraphType()) {
                this.renderGraph();
            }
        });

        // Export 버튼 이벤트 리스너 (선택 영역)
        document.getElementById('exportSelectionJSON')?.addEventListener('click', () => {
            this.exportSignalProcessingJSON();
        });

        document.getElementById('exportSelectionCSV')?.addEventListener('click', () => {
            this.exportSignalProcessingCSV();
        });

        // Export 버튼 이벤트 리스너 (메인 그래프)
        document.getElementById('exportGraphJSON')?.addEventListener('click', () => {
            this.exportSignalProcessingJSON();
        });

        document.getElementById('exportGraphCSV')?.addEventListener('click', () => {
            this.exportSignalProcessingCSV();
        });
    }

    /**
     * 전체 신호 전처리 패널 표시/숨김
     */
    _updateFullSignalPreprocessVisibility() {
        const panel = document.getElementById('fullSignalPreprocessGroup');
        if (panel) {
            if (this._isSignalProcessingGraphType()) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        }
    }

    /**
     * 현재 그래프 타입이 신호처리 타입인지 확인
     */
    _isSignalProcessingGraphType() {
        return ['fft', 'stft', 'wavelet', 'hilbert'].includes(this.currentGraphType);
    }

    /**
     * 전체 신호 전처리 적용
     */
    _applyFullSignalPreprocessing(signal) {
        const removeDC = document.getElementById('fullPreprocessRemoveDC')?.checked || false;
        const detrend = document.getElementById('fullPreprocessDetrend')?.checked || false;

        let processedSignal = signal;
        let preprocessInfo = '';

        if (removeDC) {
            processedSignal = SignalProcessor.removeDC(processedSignal);
            preprocessInfo += 'DC 제거 ';
            console.log('[전처리] DC 성분 제거 적용 (전체 신호)');
        }

        if (detrend) {
            processedSignal = SignalProcessor.detrend(processedSignal);
            preprocessInfo += '트렌드 제거 ';
            console.log('[전처리] 선형 트렌드 제거 적용 (전체 신호)');
        }

        return {
            processedSignal: processedSignal,
            preprocessInfo: preprocessInfo.trim()
        };
    }

    /**
     * 센서 checkbox 이벤트 바인딩 (타입별 2개 제한)
     */
    _bindSensorCheckboxes() {
        const checkboxes = document.querySelectorAll('.sensor-checkbox-item input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const sensorName = e.target.value;
                const sensorData = dataLoader.getSensorData(sensorName);
                const sensorType = sensorData && sensorData.length > 0 ? sensorData[0].type : 'Unknown';
                
                if (e.target.checked) {
                    // 이미 2개 타입이 선택되었는지 확인
                    const selectedTypeCount = Object.keys(this.selectedSensorsByType).length;
                    const typeAlreadySelected = this.selectedSensorsByType.hasOwnProperty(sensorType);
                    
                    if (selectedTypeCount >= 2 && !typeAlreadySelected) {
                        // 2개 타입 이미 선택됨 + 새로운 타입 선택 시도
                        e.target.checked = false;
                        this._showMessage('최대 2가지 센서 타입만 선택할 수 있습니다', 'warning');
                        return;
                    }
                    
                    // 타입별 배열 초기화
                    if (!this.selectedSensorsByType[sensorType]) {
                        this.selectedSensorsByType[sensorType] = [];
                    }
                    
                    // 센서 추가
                    if (!this.selectedSensorsByType[sensorType].includes(sensorName)) {
                        this.selectedSensorsByType[sensorType].push(sensorName);
                    }
                } else {
                    // 센서 제거
                    if (this.selectedSensorsByType[sensorType]) {
                        this.selectedSensorsByType[sensorType] = 
                            this.selectedSensorsByType[sensorType].filter(s => s !== sensorName);
                        
                        // 타입에 센서가 없으면 타입 제거
                        if (this.selectedSensorsByType[sensorType].length === 0) {
                            delete this.selectedSensorsByType[sensorType];
                        }
                    }
                }
                
                // 다른 타입 checkbox 활성/비활성화
                const selectedTypeCount = Object.keys(this.selectedSensorsByType).length;
                checkboxes.forEach(cb => {
                    const cbSensorData = dataLoader.getSensorData(cb.value);
                    const cbSensorType = cbSensorData && cbSensorData.length > 0 ? cbSensorData[0].type : 'Unknown';
                    const cbTypeSelected = this.selectedSensorsByType.hasOwnProperty(cbSensorType);
                    
                    if (selectedTypeCount >= 2 && !cb.checked && !cbTypeSelected) {
                        // 2개 타입 선택되었고, 이 체크박스는 체크 안됨, 새로운 타입
                        cb.disabled = true;
                    } else {
                        cb.disabled = false;
                    }
                });
                
                // 그래프 업데이트
                this._updateGraphTypeOptions();
                this.renderGraph();
            });
        });
    }

    /**
     * 샘플 데이터 로드 (테스트용)
     */
    async _loadSampleData() {
        try {
            console.log('[*] 샘플 데이터 로드 중...');
            
            // dataLoader 초기화 확인
            if (typeof dataLoader === 'undefined') {
                console.error('[FATAL] dataLoader가 정의되지 않았습니다');
                console.error('[DEBUG] typeof dataLoader:', typeof dataLoader);
                console.error('[DEBUG] window.dataLoader:', window.dataLoader);
                this._showMessage('데이터 로더 초기화 실패 - 페이지를 새로고침 해주세요', 'error');
                return;
            }
            
            console.log('[+] dataLoader 준비 완료:', typeof dataLoader);
            
            // sampledata.json 파일에서 로드 (또는 실패 시 합성 데이터 사용)
            await dataLoader.loadSampleDataFromFile();
            
            // 로드 후 dataLoader 상태 확인
            const metadata = dataLoader.getMetadata();
            if (!metadata) {
                console.warn('[WARN] 메타데이터 없음');
            }
            
            this._updateUI();
            
            console.log('[+] 샘플 데이터 로드 완료');
        } catch (error) {
            console.error('[ERROR] 샘플 데이터 로드 실패:', error);
            this._showMessage('샘플 데이터 로드 실패: ' + error.message, 'error');
        }
    }

    /**
     * 데이터 로드 (GitHub 또는 로컬)
     */
    async loadData() {
        this._showLoading(true);

        try {
            // GitHub에서 로드 시도
            await dataLoader.loadFromGitHub(
                this.githubConfig.username,
                this.githubConfig.repo,
                this.githubConfig.filepath
            );
            
            this._updateUI();
            this._showMessage('데이터 로드 완료', 'success');
        } catch (error) {
            console.warn('GitHub 로드 실패, 로컬 파일 선택:', error);
            
            // 로컬 파일 선택
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            
            fileInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (file) {
                    try {
                        await dataLoader.loadFromFile(file);
                        this._updateUI();
                        this._showMessage('데이터 로드 완료', 'success');
                    } catch (error) {
                        this._showMessage('데이터 로드 실패: ' + error.message, 'error');
                    }
                }
                this._showLoading(false);
            };
            
            fileInput.click();
        }

        this._showLoading(false);
    }

    /**
     * UI 업데이트
     */
    _updateUI() {
        // dataLoader 상태 확인
        if (typeof dataLoader === 'undefined' || !dataLoader) {
            console.error('[FATAL] dataLoader가 정의되지 않았습니다');
            console.error('[INFO] dataLoader 타입:', typeof dataLoader);
            return;
        }

        // 센서 목록 업데이트 (타입별 그룹화)
        const sensors = dataLoader.getSensorList();
        
        if (!Array.isArray(sensors)) {
            console.error('[ERROR] 센서 목록이 배열이 아닙니다:', sensors);
            this._showMessage('센서 목록 로드 실패', 'error');
            return;
        }
        
        if (sensors.length === 0) {
            console.warn('[WARN] 센서 데이터가 없습니다');
            document.getElementById('sensorCheckboxes').innerHTML = '<p>로드된 센서가 없습니다</p>';
            return;
        }

        const sensorCheckboxes = document.getElementById('sensorCheckboxes');
        
        sensorCheckboxes.innerHTML = '';
        
        // 센서를 타입별로 그룹화
        const sensorsByType = {};
        sensors.forEach(sensor => {
            const sensorData = dataLoader.getSensorData(sensor);
            const type = sensorData && sensorData.length > 0 ? sensorData[0].type : 'Unknown';
            
            if (!sensorsByType[type]) {
                sensorsByType[type] = [];
            }
            sensorsByType[type].push(sensor);
        });

        // checkbox 구성 (타입별 그룹)
        const typeOrder = ['Temperature', 'Fan', 'Control', 'Voltage', 'Power', 'Unknown'];
        
        typeOrder.forEach(type => {
            if (sensorsByType[type]) {
                // 타입 헤더
                const typeHeader = document.createElement('div');
                typeHeader.style.cssText = 'font-weight: 600; padding-top: 10px; padding-bottom: 5px; border-top: 1px solid #ddd; margin-top: 10px;';
                typeHeader.textContent = this._getTypeLabel(type);
                sensorCheckboxes.appendChild(typeHeader);
                
                // 센서 checkbox
                sensorsByType[type].sort().forEach(sensor => {
                    const checkboxItem = document.createElement('div');
                    checkboxItem.className = 'sensor-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `sensor-${sensor}`;
                    checkbox.value = sensor;
                    
                    const label = document.createElement('label');
                    label.htmlFor = `sensor-${sensor}`;
                    label.textContent = sensor;
                    
                    checkboxItem.appendChild(checkbox);
                    checkboxItem.appendChild(label);
                    sensorCheckboxes.appendChild(checkboxItem);
                });
            }
        });

        // 첫 번째 센서 기본 선택 (없으면 공)
        // 초기 상태: 아무것도 선택 안함

        // checkbox 이벤트 바인딩
        this._bindSensorCheckboxes();

        // 메타데이터 업데이트
        const metadata = dataLoader.getMetadata();
        if (metadata) {
            document.getElementById('sampleCount').textContent = metadata.sampleCount;
            document.getElementById('lastUpdate').textContent = new Date(metadata.timestamp).toLocaleString();

            const timeRange = dataLoader.getTimeRange();
            if (timeRange) {
                const duration = (timeRange.duration / 60).toFixed(1);
                document.getElementById('timeRange').textContent = `${duration}분`;
            }
        }

        // 현재 상태 업데이트
        this._updateCurrentStatus();

        // 그래프 렌더링
        this.renderGraph();

        // 고장 진단
        this._updateDiagnosis();

        // 자동 갱신 시작
        this._startAutoUpdate();
    }

    /**
     * 현재 상태 업데이트 (센서 타입별 표시)
     */
    _updateCurrentStatus() {
        const sensors = dataLoader.getSensorList();

        // CPU 팬 RPM
        const cpuFanSensor = sensors.find(s => 
            (s.includes('CPU') || s.includes('cpu')) && 
            s.includes('Fan') && 
            !s.includes('PWM')
        );
        if (cpuFanSensor) {
            const data = dataLoader.getSensorData(cpuFanSensor);
            if (data && data.length > 0 && data[0].type === 'Fan') {
                const rpm = data[data.length - 1].value;
                document.getElementById('cpuFanRpm').textContent = rpm.toFixed(0);
            }
        }

        // CPU 온도
        const cpuTempSensor = sensors.find(s => 
            (s.includes('CPU') || s.includes('Core')) && 
            s.includes('Temperature')
        );
        if (cpuTempSensor) {
            const data = dataLoader.getSensorData(cpuTempSensor);
            if (data && data.length > 0 && data[0].type === 'Temperature') {
                const temp = data[data.length - 1].value;
                document.getElementById('cpuTemp').textContent = temp.toFixed(1);
            }
        }

        // PWM 비율
        const pwmSensor = sensors.find(s => 
            (s.includes('Fan') || s.includes('Control')) && 
            (s.includes('PWM') || s.includes('Control'))
        );
        if (pwmSensor) {
            const data = dataLoader.getSensorData(pwmSensor);
            if (data && data.length > 0 && 
                (data[0].type === 'Control' || data[0].type === 'Fan')) {
                const pwm = data[data.length - 1].value;
                document.getElementById('pwmRatio').textContent = pwm.toFixed(1);
            }
        }
    }

    /**
     * 그래프 렌더링
     */
    async renderGraph() {
        // 디버깅: dataLoader 상태 확인
        if (typeof dataLoader === 'undefined' || !dataLoader) {
            console.error('[FATAL] dataLoader가 초기화되지 않았습니다');
            console.error('[INFO] dataLoader 타입:', typeof dataLoader);
            this._showMessage('데이터 로더 초기화 실패', 'error');
            return;
        }

        // 선택된 센서 확인
        if (!this.selectedSensorsByType || typeof this.selectedSensorsByType !== 'object') {
            console.error('[FATAL] selectedSensorsByType이 객체가 아닙니다:', this.selectedSensorsByType);
            this._showMessage('센서 선택 상태 오류', 'error');
            return;
        }

        const typeCount = Object.keys(this.selectedSensorsByType).length;
        if (typeCount === 0) {
            // 그래프 클리어
            const mainGraph = document.getElementById('mainGraph');
            if (mainGraph) {
                Plotly.purge(mainGraph);
            }
            // 통계 초기화
            document.getElementById('statMean').textContent = '-';
            document.getElementById('statMin').textContent = '-';
            document.getElementById('statMax').textContent = '-';
            document.getElementById('statStdDev').textContent = '-';
            document.getElementById('analysisText').textContent = '센서를 선택해주세요.';

            // 이벤트 바인딩 플래그 리셋
            this.selectionEventBound = false;

            this._showMessage('센서를 1개 이상 선택해주세요', 'warning');
            return;
        }

        this._showLoading(true);

        try {
            // 다중타입일 때 시계열만 지원
            if (typeCount > 1) {
                // 다중 센서 모드로 전환 시 이벤트 바인딩 플래그 리셋
                this.selectionEventBound = false;

                if (this.currentGraphType !== 'timeseries') {
                    this.currentGraphType = 'timeseries';
                }
                await this._renderMultiSensorTimeseries();
                return;
            }

            // 단일타입 처리
            const sensorType = Object.keys(this.selectedSensorsByType)[0];
            const sensors = this.selectedSensorsByType[sensorType];

            // 센서 배열 확인
            if (!sensors || sensors.length === 0) {
                this._showMessage('선택된 센서가 없습니다', 'error');
                return;
            }

            // 여러 센서가 선택되었고 시계열 그래프일 때는 다중 센서 표시
            if (sensors.length > 1 && this.currentGraphType === 'timeseries') {
                // 다중 센서 모드로 전환 시 이벤트 바인딩 플래그 리셋
                this.selectionEventBound = false;

                await this._renderMultiSensorTimeseries();
                return;
            }

            const firstSensor = sensors[0];
            this.currentSensor = firstSensor;  // 그래프 제목용
            const sensorData = dataLoader.getSensorData(firstSensor);

            if (!sensorData || sensorData.length === 0) {
                this._showMessage('센서 데이터가 없습니다', 'error');
                return;
            }

            const values = sensorData.map(r => r.value);
            const timestamps = sensorData.map(r => r.timestamp);

            // Wavelet 컨트롤 패널 숨김 (wavelet이 아닐 때)
            const waveletPanel = document.getElementById('waveletControlPanel');
            if (waveletPanel && this.currentGraphType !== 'wavelet') {
                waveletPanel.style.display = 'none';
            }

            let trace, layout;

            switch (this.currentGraphType) {
                case 'timeseries':
                case 'timeseries-temp':
                    // 센서 타입에 맞게 Y축 자동 설정
                    const ts = this._createTimeseriesPlot(values, timestamps);
                    Plotly.newPlot('mainGraph', [ts.trace], ts.layout, {responsive: true});
                    break;

                case 'pwm-rpm':
                    await this._renderPwmVsRpm();
                    break;

                case '3d':
                    await this._render3DPlot();
                    break;

                case 'fft':
                    const fft = this._createFFTPlot(values);
                    Plotly.newPlot('mainGraph', [fft.trace], fft.layout, {responsive: true});
                    break;

                case 'stft':
                    const stft = this._createSTFTPlot(values);
                    Plotly.newPlot('mainGraph', [stft.trace], stft.layout, {responsive: true});
                    break;

                case 'wavelet':
                    const wavelet = this._createWaveletPlot(values);
                    Plotly.newPlot('mainGraph', [wavelet.trace], wavelet.layout, {responsive: true});
                    
                    // Wavelet y축 전환 패널 표시
                    const waveletPanel = document.getElementById('waveletControlPanel');
                    if (waveletPanel) {
                        waveletPanel.style.display = 'block';
                        const toggle = document.getElementById('waveletFrequencyToggle');
                        if (toggle) {
                            toggle.checked = this.waveletFrequencyMode;
                            toggle.onchange = (e) => {
                                this.waveletFrequencyMode = e.target.checked;
                                // 그래프 재렌더링
                                this.renderGraph();
                            };
                        }
                    }
                    break;

                case 'hilbert':
                    const hilbert = this._createHilbertPlot(values);
                    Plotly.newPlot('mainGraph', hilbert.traces, hilbert.layout, {responsive: true});
                    break;

                default:
                    return;
            }

            // Export 패널 표시/숨김
            const exportPanel = document.getElementById('graphExportPanel');
            if (exportPanel) {
                if (['fft', 'stft', 'wavelet', 'hilbert'].includes(this.currentGraphType)) {
                    exportPanel.style.display = 'block';
                } else {
                    exportPanel.style.display = 'none';
                }
            }

            // 통계 업데이트 (정적 메서드 호출)
            this._updateStatistics(values);

            // 분석 텍스트 업데이트
            this._updateAnalysisText(this.currentGraphType, values);

            // 선택 이벤트 바인딩 (단일 센서 시계열 그래프에서만 영역 선택 가능)
            if (this.currentGraphType === 'timeseries') {
                console.log('[*] 단일 센서 시계열: 신호처리 활성화');
                this._bindSelectionEvent(values);
            }
        } catch (error) {
            console.error('[ERROR] 그래프 렌더링 오류:', error);
            this._showMessage('그래프 렌더링 실패: ' + error.message, 'error');
        }

        this._showLoading(false);
    }

    /**
     * 시계열 플롯 생성
     */
    /**
     * Plotly 그래프 선택 이벤트 바인딩
     * 선택한 영역에 대해 신호처리 UI 표시
     */
    _bindSelectionEvent(fullSignal) {
        const mainGraph = document.getElementById('mainGraph');

        if (!mainGraph) {
            console.error('[ERROR] mainGraph 요소를 찾을 수 없습니다');
            return;
        }

        console.log('[*] _bindSelectionEvent 호출됨, 신호 길이:', fullSignal.length);

        // dragmode를 명시적으로 select로 설정 (Plotly가 다른 모드로 시작할 수 있음)
        Plotly.relayout(mainGraph, {'dragmode': 'select'}).then(() => {
            console.log('[*] Plotly dragmode를 select로 강제 설정 완료');
        }).catch(err => {
            console.error('[ERROR] Plotly relayout 실패:', err);
        });

        // 이미 이벤트 리스너가 바인딩되어 있으면 중복 등록하지 않음
        if (this.selectionEventBound) {
            console.log('[*] 이미 plotly_selected 이벤트 리스너가 등록되어 있음 (중복 방지)');
            return;
        }

        // Plotly가 DOM 요소에 추가한 .on() 메서드 사용
        // (jQuery 스타일이지만 Plotly가 자체적으로 제공)
        if (typeof mainGraph.on !== 'function') {
            console.error('[ERROR] mainGraph.on()이 함수가 아닙니다. Plotly 그래프가 생성되지 않았을 수 있습니다.');
            return;
        }

        mainGraph.on('plotly_selected', (data) => {
            console.log('[*] plotly_selected 이벤트 발생!');
            console.log('[DEBUG] data 객체:', data);

            // Line plot에서는 data.points가 비어있고, data.range에 선택 영역 정보가 있음
            if (!data || !data.range || !data.range.x) {
                console.warn('[WARN] 선택 영역 정보가 없습니다 (data.range.x 없음)');
                return;
            }

            try {
                // data.range.x에서 직접 시간 범위 추출
                const [xMin, xMax] = data.range.x;
                console.log('[*] 선택된 시간 범위:', `${xMin.toFixed(2)}초 ~ ${xMax.toFixed(2)}초`);

                // 샘플 간격
                const sampleInterval = dataLoader.data.sample_interval_ms / 1000;

                // 배열 인덱스로 변환
                const startIdx = Math.max(0, Math.floor(xMin / sampleInterval));
                const endIdx = Math.min(fullSignal.length - 1, Math.ceil(xMax / sampleInterval));

                // 부분 신호 추출
                const selectedSignal = fullSignal.slice(startIdx, endIdx + 1);

                if (selectedSignal.length < 2) {
                    this._showMessage('선택한 영역이 너무 작습니다 (최소 2개 샘플 필요)', 'warning');
                    return;
                }

                // 선택 영역 정보 표시
                const duration = (endIdx - startIdx + 1) * sampleInterval;
                const info = `${selectedSignal.length}개 샘플, ${duration.toFixed(2)}초`;

                console.log('[*] 선택 영역:', info);
                console.log('[*] 인덱스 범위:', `${startIdx} ~ ${endIdx}`);

                // 선택 영역 데이터 저장
                this.selectedRangeData = {
                    signal: selectedSignal,
                    startIdx: startIdx,
                    endIdx: endIdx,
                    info: info
                };

                // 신호처리 UI 표시
                this._showSignalProcessingUI(info);

            } catch (error) {
                console.error('[ERROR] 선택 영역 처리 오류:', error);
                this._showMessage('선택 영역 처리 실패: ' + error.message, 'error');
            }
        });

        this.selectionEventBound = true;
        console.log('[*] mainGraph.on()으로 plotly_selected 이벤트 리스너 등록 완료');

        // 사용자 안내
        this._showMessage('💡 그래프 영역을 드래그하여 신호처리할 영역을 선택하세요', 'info');
    }

    /**
     * 신호처리 UI 표시
     */
    _showSignalProcessingUI(rangeInfo) {
        console.log('[*] _showSignalProcessingUI 호출됨:', rangeInfo);

        const panel = document.getElementById('signalProcessingPanel');
        const infoSpan = document.getElementById('selectedRangeInfo');

        if (!panel) {
            console.error('[ERROR] signalProcessingPanel 요소를 찾을 수 없습니다');
            return;
        }

        if (!infoSpan) {
            console.error('[ERROR] selectedRangeInfo 요소를 찾을 수 없습니다');
            return;
        }

        infoSpan.textContent = `선택 영역: ${rangeInfo}`;

        // 드롭박스 초기화
        const select = document.getElementById('signalProcessingType');
        if (select) {
            select.value = '';
        } else {
            console.error('[ERROR] signalProcessingType 요소를 찾을 수 없습니다');
        }

        panel.style.display = 'block';
        console.log('[*] 신호처리 UI 패널 표시됨');

        // 패널로 스크롤
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * 신호처리 UI 숨김
     */
    _hideSignalProcessingUI() {
        const panel = document.getElementById('signalProcessingPanel');
        panel.style.display = 'none';
        this.selectedRangeData = null;
    }

    /**
     * 신호처리 적용
     */
    _applySignalProcessing() {
        if (!this.selectedRangeData) {
            this._showMessage('선택된 영역이 없습니다', 'warning');
            return;
        }

        const select = document.getElementById('signalProcessingType');
        const processingType = select.value;

        if (!processingType) {
            this._showMessage('신호처리 방식을 선택해주세요', 'warning');
            return;
        }

        // 신호처리 수행
        this._processSelectedSignal(
            this.selectedRangeData.signal,
            processingType,
            this.selectedRangeData.info,
            this.selectedRangeData.startIdx
        );

        // Export 패널 표시
        const exportPanel = document.getElementById('selectionExportPanel');
        if (exportPanel) {
            exportPanel.style.display = 'flex';
        }

        // UI 숨김
        this._hideSignalProcessingUI();
    }

    /**
     * 선택된 신호에 대해 신호처리 수행
     */
    _processSelectedSignal(signal, graphType, info, startIdx) {
        try {
            // 샘플링 레이트 계산 (공통)
            const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);

            // 전처리 옵션 확인
            const removeDC = document.getElementById('preprocessRemoveDC')?.checked || false;
            const detrend = document.getElementById('preprocessDetrend')?.checked || false;

            // 전처리 적용
            let processedSignal = signal;
            let preprocessInfo = '';

            if (removeDC) {
                processedSignal = SignalProcessor.removeDC(processedSignal);
                preprocessInfo += 'DC 제거 ';
                console.log('[전처리] DC 성분 제거 적용');
            }

            if (detrend) {
                processedSignal = SignalProcessor.detrend(processedSignal);
                preprocessInfo += '트렌드 제거 ';
                console.log('[전처리] 선형 트렌드 제거 적용');
            }

            // 전처리 정보 추가
            const fullInfo = preprocessInfo ? `${info} (${preprocessInfo.trim()})` : info;

            let result = null;

            switch(graphType) {
                case 'fft':
                    result = SignalProcessor.performFFT(processedSignal, sampleRate);
                    if (result) {
                        this._showSelectedFFT(result, processedSignal, fullInfo, startIdx);
                    }
                    break;

                case 'stft':
                    result = SignalProcessor.performSTFT(processedSignal, 128, 64, sampleRate);
                    if (result) {
                        this._showSelectedSTFT(result, processedSignal, fullInfo, startIdx);
                    }
                    break;

                case 'wavelet':
                    result = SignalProcessor.performWavelet(processedSignal, null, 'morlet', sampleRate);
                    if (result) {
                        this._showSelectedWavelet(result, processedSignal, fullInfo, startIdx);
                    }
                    break;

                case 'hilbert':
                    result = SignalProcessor.performHilbert(processedSignal, sampleRate);
                    if (result) {
                        this._showSelectedHilbert(result, processedSignal, fullInfo, startIdx);
                    }
                    break;
            }

            if (result) {
                this._showMessage(`✅ 선택 영역 신호처리 완료: ${fullInfo}`, 'success');
            }

        } catch (error) {
            console.error('[ERROR] 신호처리 오류:', error);
            this._showMessage('신호처리 실패: ' + error.message, 'error');
        }
    }

    /**
     * 선택 영역 FFT 결과 표시
     */
    _showSelectedFFT(fftResult, signal, info, startIdx) {
        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
        const nyquistFreq = sampleRate / 2;
        const freqs = SignalProcessor.getFrequencies(signal.length, sampleRate).slice(0, fftResult.magnitude.length);
        const magnitudeDb = fftResult.magnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));

        // 디버그 정보 콘솔 출력
        console.log(`[선택 영역 FFT Debug] 샘플링 레이트: ${sampleRate.toFixed(2)} Hz | 나이퀴스트 주파수: ${nyquistFreq.toFixed(2)} Hz | 신호 길이: ${signal.length} 샘플`);

        const trace = {
            x: freqs,
            y: magnitudeDb,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            name: `선택 영역 FFT (${info})`,
            line: {color: '#FF9800', width: 2},
            hovertemplate: '<b>주파수:</b> %{x:.3f} Hz<br><b>크기:</b> %{y:.2f} dB<extra></extra>'
        };

        const layout = {
            title: `선택 영역 FFT 스펙트럼 - ${info}<br><sub>샘플링: ${sampleRate.toFixed(2)} Hz | 나이퀴스트: ${nyquistFreq.toFixed(2)} Hz</sub>`,
            xaxis: {title: '주파수 (Hz)'},
            yaxis: {title: '크기 (dB)'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 60, b: 40, l: 60, r: 40}
        };

        Plotly.newPlot('mainGraph', [trace], layout, {responsive: true});
    }

    /**
     * 선택 영역 STFT 결과 표시
     */
    _showSelectedSTFT(stftResult, signal, info, startIdx) {
        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);

        // 정규화
        const minVal = Math.min(...stftResult.spectrogram.flat());
        const maxVal = Math.max(...stftResult.spectrogram.flat());
        const normalized = stftResult.spectrogram.map(row =>
            row.map(v => (v - minVal) / (maxVal - minVal + 1e-10))
        );

        // Transpose: [시간][주파수] → [주파수][시간]
        const transposed = normalized[0].map((_, colIndex) =>
            normalized.map(row => row[colIndex])
        );

        // 주파수 축 생성
        const freqBins = transposed.length;
        const nyquistFreq = sampleRate / 2;
        const frequencies = Array.from({length: freqBins}, (_, i) => (i * nyquistFreq) / freqBins);

        const trace = {
            z: transposed,  // [주파수][시간]
            x: stftResult.times,  // 시간축
            y: frequencies,  // 주파수축
            type: 'heatmap',
            colorscale: 'Viridis',
            hovertemplate: '<b>시간:</b> %{x:.2f}s<br><b>주파수:</b> %{y:.2f} Hz<br><b>에너지:</b> %{z:.3f}<extra></extra>'
        };

        const layout = {
            title: `선택 영역 STFT 스펙트로그램 - ${info}`,
            xaxis: {title: '시간 (초)'},
            yaxis: {title: '주파수 (Hz)'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        Plotly.newPlot('mainGraph', [trace], layout, {responsive: true});
    }

    /**
     * 선택 영역 Wavelet 결과 표시
     */
    _showSelectedWavelet(waveletResult, signal, info, startIdx) {
        // 정규화
        const normalized = waveletResult.coefficients.map(row =>
            row.map(v => Math.log10(v + 1e-10))
        );

        // x축: 실제 시간(초) 배열 생성
        const timeAxis = Array.from({length: signal.length}, (_, i) =>
            i * (dataLoader.data.sample_interval_ms || 100) / 1000
        );

        // y축 데이터 (스케일 또는 주파수)
        let yAxisData = waveletResult.scales;
        let yAxisTitle = '스케일';

        if (this.waveletFrequencyMode && waveletResult.frequencies) {
            yAxisData = waveletResult.frequencies;
            yAxisTitle = '주파수 (Hz)';
        }

        const trace = {
            z: normalized,  // [스케일][시간]
            x: timeAxis,    // 실제 시간 (초)
            y: yAxisData,   // 스케일 또는 주파수
            type: 'heatmap',
            colorscale: 'Viridis',
            hovertemplate: '<b>시간:</b> %{x:.2f}s<br><b>' + yAxisTitle + ':</b> %{y}<br><b>에너지:</b> %{z:.2f}<extra></extra>'
        };

        const layout = {
            title: `선택 영역 Wavelet Transform - ${info}`,
            xaxis: {title: '시간 (초)'},
            yaxis: {
                title: yAxisTitle,
                type: this.waveletFrequencyMode ? 'log' : 'linear'
            },
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        Plotly.newPlot('mainGraph', [trace], layout, {responsive: true});
    }

    /**
     * 선택 영역 Hilbert 결과 표시
     */
    _showSelectedHilbert(hilbertResult, signal, info, startIdx) {
        const timeAxis = Array.from({length: signal.length}, (_, i) => i);

        const traces = [
            {
                x: timeAxis,
                y: signal,
                name: '원본 신호',
                type: 'scatter',
                mode: 'lines',
                line: {color: '#2196F3', width: 1},
                hovertemplate: '<b>원본:</b> %{y:.2f}<extra></extra>'
            },
            {
                x: timeAxis,
                y: hilbertResult.envelope,
                name: '포락선 (상)',
                type: 'scatter',
                mode: 'lines',
                line: {color: '#FF5722', width: 2, dash: 'dash'},
                hovertemplate: '<b>상단 포락선:</b> %{y:.2f}<extra></extra>'
            },
            {
                x: timeAxis,
                y: hilbertResult.envelope.map(v => -v),
                name: '포락선 (하)',
                type: 'scatter',
                mode: 'lines',
                line: {color: '#FF5722', width: 2, dash: 'dash'},
                hovertemplate: '<b>하단 포락선:</b> %{y:.2f}<extra></extra>'
            }
        ];

        const layout = {
            title: `선택 영역 Hilbert 포락선 - ${info}`,
            xaxis: {title: '시간 (샘플)'},
            yaxis: {title: '진폭'},
            hovermode: 'x unified',
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        Plotly.newPlot('mainGraph', traces, layout, {responsive: true});
    }

    async _renderMultiSensorTimeseries() {
        try {
            const traces = [];
            const yaxisConfigs = {}; // y축 설정 객체
            let yaxisCounter = 1; // yaxis, yaxis2, yaxis3 ...
            const colors = ['#2196F3', '#FF9800', '#4CAF50', '#4CAF50', '#FF5722', '#9C27B0']; // 센서 색상
            
            // 모든 선택된 센서 수집
            const allSensors = [];
            const typeOrder = [];
            
            for (const [sensorType, sensors] of Object.entries(this.selectedSensorsByType)) {
                typeOrder.push(sensorType);
                sensors.forEach(sensorName => {
                    allSensors.push({name: sensorName, type: sensorType});
                });
            }
            
            // 센서 배열 확인
            if (allSensors.length === 0) {
                this._showMessage('선택된 센서가 없습니다', 'error');
                this._showLoading(false);
                return;
            }
            
            // 첫 센서 기준으로 시간축 설정
            const firstSensorData = dataLoader.getSensorData(allSensors[0].name);
            if (!firstSensorData || firstSensorData.length === 0) {
                this._showMessage('센서 데이터가 없습니다', 'error');
                this._showLoading(false);
                return;
            }
            
            const timeAxis = dataLoader.data.sample_interval_ms 
                ? Array.from({length: firstSensorData.length}, (_, i) => i * dataLoader.data.sample_interval_ms / 1000)
                : Array.from({length: firstSensorData.length}, (_, i) => i);

            // 타입별로 y축 설정
            const typeToYaxis = {};
            
            allSensors.forEach((sensor, index) => {
                const sensorData = dataLoader.getSensorData(sensor.name);
                if (!sensorData || sensorData.length === 0) return;

                const values = sensorData.map(r => r.value);
                const sensorType = sensor.type;
                
                // 타입이 처음 나타나면 새 y축 할당
                if (!typeToYaxis[sensorType]) {
                    const yaxisKey = yaxisCounter === 1 ? 'y' : `y${yaxisCounter}`;
                    typeToYaxis[sensorType] = yaxisKey;

                    // y축 설정 저장
                    let yaxisLabel = this._getYAxisLabelForType(sensorType);
                    const layoutKey = yaxisCounter === 1 ? 'yaxis' : `yaxis${yaxisCounter}`;

                    if (yaxisCounter === 1) {
                        yaxisConfigs[layoutKey] = {
                            title: yaxisLabel,
                            side: 'left'
                        };
                    } else {
                        yaxisConfigs[layoutKey] = {
                            title: yaxisLabel,
                            overlaying: 'y',
                            side: 'right',
                            position: yaxisCounter === 2 ? 1.0 : 1.0 - (yaxisCounter - 2) * 0.1
                        };
                    }
                    yaxisCounter++;
                }
                
                const yaxisName = typeToYaxis[sensorType];
                
                const trace = {
                    x: timeAxis,
                    y: values,
                    type: 'scatter',
                    mode: 'lines',
                    name: sensor.name,
                    line: {
                        color: colors[index % colors.length],
                        width: 2
                    },
                    yaxis: yaxisName,
                    hovertemplate: `<b>${sensor.name}:</b> %{y:.2f}<br><b>시간:</b> %{x:.2f}s<extra></extra>`
                };
                
                traces.push(trace);
            });

            // 레이아웃 구성
            const sensorNames = allSensors.map(s => s.name).join(', ');
            const layout = {
                title: `${sensorNames} - 시계열 (다중센서)`,
                xaxis: {title: '시간 (초)'},
                hovermode: 'x unified',
                dragmode: 'zoom',  // 다중센서에서는 zoom 모드 (신호처리 비활성화)
                plot_bgcolor: '#fafafa',
                paper_bgcolor: 'white',
                margin: {
                    t: 40,
                    b: 40,
                    l: yaxisCounter > 2 ? 80 : 60,
                    r: yaxisCounter > 2 ? 80 : 40
                },
                ...yaxisConfigs
            };

            // 그래프 렌더링
            Plotly.newPlot('mainGraph', traces, layout, {responsive: true});

            // 통계 업데이트 (첫 센서 기준)
            const firstValues = dataLoader.getSensorData(allSensors[0].name).map(r => r.value);
            this._updateStatistics(firstValues);

            // 다중 센서 시계열에서는 신호처리 비활성화 (어떤 센서를 처리할지 모호)
            console.log('[*] 다중 센서 표시: 신호처리 비활성화');
            
        } catch (error) {
            console.error('[ERROR] 다중센서 그래프 렌더링 오류:', error);
            this._showMessage('다중센서 그래프 렌더링 실패: ' + error.message, 'error');
        } finally {
            this._showLoading(false);
        }
    }

    /**
     * 센서 타입별 y축 레이블 반환
     */
    _getYAxisLabelForType(sensorType) {
        const labels = {
            'Temperature': '온도 (°C)',
            'Fan': '회전수 (RPM)',
            'Control': '제어 신호 (PWM %)',
            'Voltage': '전압 (V)',
            'Power': '전력 (W)',
            'Unknown': '값'
        };
        return labels[sensorType] || '값';
    }

    /**
     * 시계열 플롯 생성
     */
    _createTimeseriesPlot(values, timestamps, ylabel = null) {
        // Y축 레이블이 지정되지 않으면 센서 타입에 따라 자동 설정
        if (!ylabel) {
            ylabel = this._getYAxisLabel();
        }

        const timeAxis = timestamps.map((_, i) => i * (dataLoader.data.sample_interval_ms || 100) / 1000);

        const trace = {
            x: timeAxis,
            y: values,
            type: 'scatter',
            mode: 'lines',
            name: this.currentSensor,
            line: {
                color: '#2196F3',
                width: 2
            },
            hovertemplate: '<b>시간:</b> %{x:.2f}s<br><b>값:</b> %{y:.2f}<extra></extra>'
        };

        const layout = {
            title: `${this.currentSensor} - 시계열`,
            xaxis: {title: '시간 (초)'},
            yaxis: {title: ylabel},
            hovermode: 'x unified',
            dragmode: 'select',  // 영역 선택 모드 활성화
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        return {trace, layout};
    }

    /**
     * FFT 플롯 생성
     */
    _createFFTPlot(values) {
        // 전처리 적용
        const {processedSignal, preprocessInfo} = this._applyFullSignalPreprocessing(values);

        // 샘플링 레이트 계산
        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
        const nyquistFreq = sampleRate / 2;

        const fftResult = SignalProcessor.performFFT(processedSignal, sampleRate);
        if (!fftResult) {
            throw new Error('FFT 계산 실패');
        }

        const freqs = SignalProcessor.getFrequencies(processedSignal.length, sampleRate).slice(0, fftResult.magnitude.length / 2);
        const magnitude = fftResult.magnitude.slice(0, fftResult.magnitude.length / 2);

        // dB 스케일
        const magnitudeDb = magnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));

        // 신호처리 결과 저장 (Export용)
        this.lastSignalProcessingResult = {
            frequencies: freqs,
            magnitude: magnitudeDb,
            phase: fftResult.phase.slice(0, fftResult.phase.length / 2)
        };
        this.lastProcessingType = 'fft';
        this.lastProcessingSensor = this.currentSensor;

        // 디버그 정보 콘솔 출력
        console.log(`[FFT Debug] 샘플링 레이트: ${sampleRate.toFixed(2)} Hz | 나이퀴스트 주파수: ${nyquistFreq.toFixed(2)} Hz | 주파수 해상도: ${(freqs[1] - freqs[0]).toFixed(4)} Hz`);
        if (preprocessInfo) {
            console.log(`[FFT Debug] 전처리: ${preprocessInfo}`);
        }

        const trace = {
            x: freqs,
            y: magnitudeDb,
            type: 'scatter',
            mode: 'lines',
            name: '전력 스펙트럼',
            fill: 'tozeroy',
            line: {color: '#FF9800'},
            hovertemplate: '<b>주파수:</b> %{x:.2f} Hz<br><b>크기:</b> %{y:.2f} dB<extra></extra>'
        };

        const titleSuffix = preprocessInfo ? `<br><sub>샘플링: ${sampleRate.toFixed(2)} Hz | 나이퀴스트: ${nyquistFreq.toFixed(2)} Hz | 전처리: ${preprocessInfo}</sub>`
                                           : `<br><sub>샘플링: ${sampleRate.toFixed(2)} Hz | 나이퀴스트: ${nyquistFreq.toFixed(2)} Hz</sub>`;

        const layout = {
            title: `${this.currentSensor} - FFT 스펙트럼${titleSuffix}`,
            xaxis: {title: '주파수 (Hz)'},
            yaxis: {title: '크기 (dB)'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 80, b: 40, l: 60, r: 40}
        };

        return {trace, layout};
    }

    /**
     * STFT 플롯 생성
     */
    _createSTFTPlot(values) {
        // 전처리 적용
        const {processedSignal, preprocessInfo} = this._applyFullSignalPreprocessing(values);

        // 샘플링 레이트 계산
        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);

        const stftResult = SignalProcessor.performSTFT(processedSignal, 128, 64, sampleRate);
        if (!stftResult) {
            throw new Error('STFT 계산 실패');
        }

        // Transpose: [시간][주파수] → [주파수][시간]
        // Plotly heatmap은 z[i][j]가 y[i], x[j]에 해당하므로
        // z = [주파수][시간], x = 시간, y = 주파수
        const transposed = stftResult.spectrogram[0].map((_, colIndex) =>
            stftResult.spectrogram.map(row => row[colIndex])
        );

        // 주파수 축 생성
        const freqBins = transposed.length;
        const nyquistFreq = sampleRate / 2;
        const frequencies = Array.from({length: freqBins}, (_, i) => (i * nyquistFreq) / freqBins);

        // 신호처리 결과 저장 (Export용)
        this.lastSignalProcessingResult = {
            times: stftResult.times,
            frequencies: frequencies,
            spectrogram: transposed
        };
        this.lastProcessingType = 'stft';
        this.lastProcessingSensor = this.currentSensor;

        const trace = {
            z: transposed,  // [주파수][시간]
            x: stftResult.times,  // 시간축
            y: frequencies,  // 주파수축
            type: 'heatmap',
            colorscale: 'Jet',
            hovertemplate: '<b>시간:</b> %{x:.2f}s<br><b>주파수:</b> %{y:.2f} Hz<br><b>크기:</b> %{z:.2f} dB<extra></extra>'
        };

        const titleSuffix = preprocessInfo ? ` (전처리: ${preprocessInfo})` : '';

        const layout = {
            title: `${this.currentSensor} - STFT 스펙트로그램${titleSuffix}`,
            xaxis: {title: '시간 (초)'},
            yaxis: {title: '주파수 (Hz)'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        return {trace, layout};
    }

    /**
     * Wavelet 플롯 생성
     */
    _createWaveletPlot(values) {
        // 전처리 적용
        const {processedSignal, preprocessInfo} = this._applyFullSignalPreprocessing(values);

        // 샘플링 레이트 계산
        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
        const nyquistFreq = sampleRate / 2;

        const waveletResult = SignalProcessor.performWavelet(processedSignal, null, 'morlet', sampleRate);
        if (!waveletResult) {
            throw new Error('Wavelet 계산 실패');
        }

        // 에너지 정규화
        const normalized = waveletResult.coefficients.map(row =>
            row.map(v => Math.log10(v + 1e-10))
        );

        // x축: 실제 시간(초) 배열 생성
        const timeAxis = Array.from({length: processedSignal.length}, (_, i) =>
            i * (dataLoader.data.sample_interval_ms || 100) / 1000
        );

        // y축 데이터 (스케일 또는 주파수)
        let yAxisData = waveletResult.scales;
        let yAxisTitle = '스케일';
        let yAxisLabel = '스케일';

        // 웨이블릿 y축 전환 상태 확인
        if (this.waveletFrequencyMode === true && waveletResult.frequencies) {
            yAxisData = waveletResult.frequencies;
            yAxisTitle = '주파수 (Hz)';
            yAxisLabel = '주파수';
        }

        const hoverTemplate = this.waveletFrequencyMode && waveletResult.frequencies
            ? '<b>시간:</b> %{x:.2f}s<br><b>주파수:</b> %{y:.4f} Hz<br><b>에너지:</b> %{z:.2f}<extra></extra>'
            : '<b>시간:</b> %{x:.2f}s<br><b>스케일:</b> %{y}<br><b>에너지:</b> %{z:.2f}<extra></extra>';

        // 신호처리 결과 저장 (Export용)
        this.lastSignalProcessingResult = {
            time: timeAxis,
            frequencies: waveletResult.frequencies,
            spectrogram: normalized
        };
        this.lastProcessingType = 'wavelet';
        this.lastProcessingSensor = this.currentSensor;

        const trace = {
            z: normalized,  // [스케일][시간]
            x: timeAxis,    // 실제 시간 (초)
            y: yAxisData,   // 스케일 또는 주파수
            type: 'heatmap',
            colorscale: 'Viridis',
            hovertemplate: hoverTemplate
        };

        // 주파수 범위 계산 (디버그 정보용)
        const minFreq = Math.min(...waveletResult.frequencies);
        const maxFreq = Math.max(...waveletResult.frequencies);

        const preprocessSuffix = preprocessInfo ? ` | 전처리: ${preprocessInfo}` : '';

        const layout = {
            title: `${this.currentSensor} - Wavelet Transform (Morlet)<br><sub>샘플링: ${sampleRate.toFixed(2)} Hz | 나이퀴스트: ${nyquistFreq.toFixed(2)} Hz | 주파수 범위: ${minFreq.toFixed(4)}~${maxFreq.toFixed(4)} Hz${preprocessSuffix}</sub>`,
            xaxis: {title: '시간 (초)'},
            yaxis: {
                title: yAxisTitle,
                type: this.waveletFrequencyMode ? 'log' : 'linear'
            },
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 80, b: 40, l: 60, r: 40}
        };

        return {trace, layout, yAxisLabel};
    }

    /**
     * Hilbert 포락선 플롯 생성
     */
    _createHilbertPlot(values) {
        // 전처리 적용
        const {processedSignal, preprocessInfo} = this._applyFullSignalPreprocessing(values);

        // 샘플링 레이트 계산
        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);

        const hilbertResult = SignalProcessor.performHilbert(processedSignal, sampleRate);
        if (!hilbertResult) {
            throw new Error('Hilbert 계산 실패');
        }

        const timeAxis = Array.from({length: processedSignal.length}, (_, i) => i * (dataLoader.data.sample_interval_ms || 100) / 1000);

        // 신호처리 결과 저장 (Export용)
        this.lastSignalProcessingResult = {
            envelope: hilbertResult.envelope
        };
        this.lastProcessingType = 'hilbert';
        this.lastProcessingSensor = this.currentSensor;

        const traces = [
            {
                x: timeAxis,
                y: processedSignal,
                name: preprocessInfo ? '전처리된 신호' : '원본 신호',
                type: 'scatter',
                mode: 'lines',
                line: {color: '#2196F3', width: 1},
                hovertemplate: '<b>원본:</b> %{y:.2f}<extra></extra>'
            },
            {
                x: timeAxis,
                y: hilbertResult.envelope,
                name: '포락선',
                type: 'scatter',
                mode: 'lines',
                line: {color: '#FF9800', width: 2},
                hovertemplate: '<b>포락선:</b> %{y:.2f}<extra></extra>'
            }
        ];

        const titleSuffix = preprocessInfo ? ` (전처리: ${preprocessInfo})` : '';

        const layout = {
            title: `${this.currentSensor} - Hilbert 포락선${titleSuffix}`,
            xaxis: {title: '시간 (초)'},
            yaxis: {title: '진폭'},
            hovermode: 'x unified',
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        return {traces: traces, layout: layout};
    }

    /**
     * PWM vs RPM 플롯
     */
    async _renderPwmVsRpm() {
        const sensors = dataLoader.getSensorList();
        
        const pwmSensor = sensors.find(s => s.includes('PWM') || (s.includes('Control') && s.includes('Fan')));
        const rpmSensor = sensors.find(s => s.includes('Fan') && !s.includes('PWM'));

        if (!pwmSensor || !rpmSensor) {
            this._showMessage('PWM 또는 RPM 데이터를 찾을 수 없습니다', 'error');
            this._showLoading(false);
            return;
        }

        const pwmData = dataLoader.getSensorData(pwmSensor)?.map(r => r.value) || [];
        const rpmData = dataLoader.getSensorData(rpmSensor)?.map(r => r.value) || [];

        if (pwmData.length === 0 || rpmData.length === 0) {
            this._showMessage('센서 데이터가 부족합니다', 'error');
            this._showLoading(false);
            return;
        }

        const trace = {
            x: pwmData,
            y: rpmData,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 5,
                color: Array.from({length: pwmData.length}, (_, i) => i),
                colorscale: 'Viridis',
                showscale: true,
                colorbar: {title: '시간'}
            },
            text: Array.from({length: pwmData.length}, (_, i) => `샘플 ${i}`),
            hovertemplate: '<b>PWM:</b> %{x:.1f}%<br><b>RPM:</b> %{y:.0f}<extra></extra>'
        };

        const layout = {
            title: 'PWM vs RPM (팬 성능 곡선)',
            xaxis: {title: 'PWM (%)'},
            yaxis: {title: 'RPM (회전/분)'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        Plotly.newPlot('mainGraph', [trace], layout, {responsive: true});
    }

    /**
     * 3D 플롯
     */
    async _render3DPlot() {
        const sensors = dataLoader.getSensorList();
        
        const pwmSensor = sensors.find(s => s.includes('PWM') || (s.includes('Control') && s.includes('Fan')));
        const rpmSensor = sensors.find(s => s.includes('Fan') && !s.includes('PWM'));

        if (!pwmSensor || !rpmSensor) {
            this._showMessage('필요한 데이터를 찾을 수 없습니다', 'error');
            return;
        }

        const pwmData = dataLoader.getSensorData(pwmSensor)?.map(r => r.value) || [];
        const rpmData = dataLoader.getSensorData(rpmSensor)?.map(r => r.value) || [];

        if (pwmData.length === 0 || rpmData.length === 0) {
            this._showMessage('센서 데이터가 부족합니다', 'error');
            return;
        }

        const timeData = Array.from({length: Math.max(pwmData.length, rpmData.length)}, (_, i) => i);

        const trace = {
            x: pwmData,
            y: rpmData,
            z: timeData.slice(0, pwmData.length),
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                size: 4,
                color: timeData.slice(0, pwmData.length),
                colorscale: 'Viridis',
                showscale: true,
                colorbar: {title: '시간'}
            },
            hovertemplate: '<b>PWM:</b> %{x:.1f}%<br><b>RPM:</b> %{y:.0f}<br><b>시간:</b> %{z}<extra></extra>'
        };

        const layout = {
            title: '3D: PWM-RPM-시간',
            scene: {
                xaxis: {title: 'PWM (%)'},
                yaxis: {title: 'RPM (회전/분)'},
                zaxis: {title: '시간'}
            },
            paper_bgcolor: 'white',
            margin: {t: 40}
        };

        Plotly.newPlot('mainGraph', [trace], layout, {responsive: true});
    }

    /**
     * 통계 업데이트
     */
    _updateStatistics(values) {
        const stats = SignalProcessor.getStatistics(values);
        
        document.getElementById('statMean').textContent = stats.mean.toFixed(2);
        document.getElementById('statMin').textContent = stats.min.toFixed(2);
        document.getElementById('statMax').textContent = stats.max.toFixed(2);
        document.getElementById('statStdDev').textContent = stats.stdDev.toFixed(2);
    }

    /**
     * 분석 텍스트 업데이트
     */
    _updateAnalysisText(graphType, values) {
        const stats = SignalProcessor.getStatistics(values);
        const sensorType = this._getCurrentSensorType();
        let analysisText = '';

        switch (graphType) {
            case 'timeseries':
            case 'timeseries-temp':
                if (sensorType === 'Temperature') {
                    analysisText = `평균: ${stats.mean.toFixed(2)}°C | 범위: ${stats.min.toFixed(1)}~${stats.max.toFixed(1)}°C | 변동폭: ${(stats.max - stats.min).toFixed(1)}°C`;
                } else if (sensorType === 'Fan') {
                    analysisText = `평균: ${stats.mean.toFixed(0)} RPM | 범위: ${stats.min.toFixed(0)}~${stats.max.toFixed(0)} RPM | 안정성: ${((1 - stats.stdDev/stats.mean) * 100).toFixed(1)}%`;
                } else if (sensorType === 'Control') {
                    analysisText = `평균: ${stats.mean.toFixed(1)}% | 범위: ${stats.min.toFixed(1)}~${stats.max.toFixed(1)}% | 변동폭: ${(stats.max - stats.min).toFixed(1)}%`;
                } else {
                    analysisText = `평균: ${stats.mean.toFixed(2)} | 범위: ${stats.min.toFixed(2)}~${stats.max.toFixed(2)} | 표준편차: ${stats.stdDev.toFixed(2)}`;
                }
                break;

            case 'fft':
                const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
                const fftResult = SignalProcessor.performFFT(values, sampleRate);
                if (fftResult) {
                    const maxMagIdx = fftResult.magnitude.indexOf(Math.max(...fftResult.magnitude));
                    const peakFreq = (maxMagIdx * sampleRate) / values.length;
                    analysisText = `피크 주파수: ${peakFreq.toFixed(2)} Hz (크기: ${fftResult.magnitude[maxMagIdx].toFixed(2)})`;

                    if (sensorType === 'Fan') {
                        analysisText += ` | 해석: 회전 기본 주파수`;
                    }
                }
                break;

            case 'stft':
                analysisText = '시간-주파수 에너지 분포입니다. 밝은 색 영역이 높은 에너지를 나타냅니다.';
                if (sensorType === 'Fan') {
                    analysisText += ' 베어링 손상이 있으면 광대역 에너지가 증가합니다.';
                }
                break;

            case 'wavelet':
                analysisText = '다중 스케일 신호 분석입니다. 밝은 색은 높은 에너지를 의미합니다.';
                if (sensorType === 'Fan') {
                    analysisText += ' 팬의 기계적 결함은 낮은 스케일에서 에너지 집중.';
                }
                break;

            case 'hilbert':
                analysisText = `신호의 포락선을 추출했습니다. 포락선 범위: ${stats.min.toFixed(2)}~${stats.max.toFixed(2)}`;
                if (sensorType === 'Fan') {
                    analysisText += ' 포락선의 변동성이 크면 베어링 문제 가능성.';
                }
                break;

            case 'pwm-rpm':
                analysisText = 'PWM(입력) 대비 RPM(출력)의 성능 곡선입니다.';
                if (this.currentSensor && this.currentSensor.includes('Fan')) {
                    analysisText += ' 정상 팬은 선형 관계를 보입니다. 베어링 마모시 곡선이 우측 이동.';
                }
                break;

            case '3d':
                analysisText = 'PWM-RPM-시간의 3D 산점도입니다. 시간에 따른 팬 특성 변화를 관찰할 수 있습니다.';
                break;

            default:
                analysisText = `평균: ${stats.mean.toFixed(2)}, 표준편차: ${stats.stdDev.toFixed(2)}`;
        }

        document.getElementById('analysisText').textContent = analysisText;
    }

    /**
     * 고장 진단 업데이트 (센서 타입별)
     */
    _updateDiagnosis() {
        const warnings = [];
        const sensorType = this._getCurrentSensorType();

        if (!this.currentSensor) return;

        // 여러 센서 선택 시 경고 시스템 비활성화 (방어코드)
        const typeCount = Object.keys(this.selectedSensorsByType).length;
        // 여러 타입 선택이거나, 같은 타입의 여러 센서 선택 시 경고 비활성화
        const hasMultipleSensors = typeCount > 1 ||
            (typeCount === 1 && Object.values(this.selectedSensorsByType)[0].length > 1);

        if (hasMultipleSensors) {
            // 다중 센서 선택 시 경고 비활성화
            console.log('[방어코드] 다중 센서 선택 감지 - 경고 시스템 비활성화:', {
                typeCount,
                selectedTypes: Object.keys(this.selectedSensorsByType),
                sensorCounts: Object.values(this.selectedSensorsByType).map(arr => arr.length)
            });
            const warningBox = document.getElementById('warningBox');
            const warningText = document.getElementById('warningText');
            if (warningBox && warningText) {
                warningBox.classList.remove('warning', 'danger', 'success');
                warningText.textContent = '다중 센서 선택 시 경고 비활성화';
            }
            return;
        }

        const sensorData = dataLoader.getSensorData(this.currentSensor);
        if (!sensorData || sensorData.length === 0) return;

        const values = sensorData.map(r => r.value);
        const stats = SignalProcessor.getStatistics(values);

        // 센서 타입별 진단 규칙 (Temperature 경고 제거, Fan 경고만 유지)
        if (sensorType === 'Fan') {
            // 팬 진단
            if (stats.mean < 500) {
                warnings.push({
                    level: 'danger',
                    message: `낮은 회전 속도: 평균 ${stats.mean.toFixed(0)} RPM (베어링 마모 의심)`
                });
            }

            if (values[values.length - 1] === 0) {
                warnings.push({
                    level: 'danger',
                    message: '팬이 멈춤: 즉시 점검 필요'
                });
            }

            // RPM 변동성 분석
            const volatility = stats.stdDev / stats.mean;
            if (volatility > 0.3) {
                warnings.push({
                    level: 'warning',
                    message: `회전 불안정: 변동율 ${(volatility * 100).toFixed(1)}% (축 흔들림 가능)`
                });
            }

        } else if (sensorType === 'Control') {
            // PWM 제어 진단
            if (stats.max === stats.min) {
                warnings.push({
                    level: 'warning',
                    message: `제어 변화 없음: 고정값 ${stats.mean.toFixed(1)}% (자동 제어 확인 필요)`
                });
            }
        }

        // UI 업데이트
        const warningBox = document.getElementById('warningBox');
        const warningText = document.getElementById('warningText');

        warningBox.classList.remove('warning', 'danger');

        if (warnings.length === 0) {
            warningBox.classList.add('success');
            warningText.textContent = '✓ 정상';
        } else {
            const maxLevel = warnings.some(w => w.level === 'danger') ? 'danger' : 'warning';
            warningBox.classList.add(maxLevel);
            const emoji = maxLevel === 'danger' ? '⚠️' : '⚡';
            warningText.innerHTML = emoji + ' ' + warnings.map(w => w.message).join('<br>');
        }
    }

    /**
     * 탭 전환
     */
    _switchTab(tabName) {
        // 모든 탭 숨기기
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // 모든 버튼 비활성화
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // 선택된 탭 활성화
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    /**
     * 데이터 내보내기
     */
    exportData() {
        if (!dataLoader.data) {
            this._showMessage('내보낼 데이터가 없습니다', 'error');
            return;
        }

        const json = JSON.stringify(dataLoader.data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sensor_data_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this._showMessage('데이터 내보내기 완료', 'success');
    }

    /**
     * 신호처리 결과 JSON으로 내보내기
     */
    exportSignalProcessingJSON() {
        if (!this.lastSignalProcessingResult || !this.lastProcessingType) {
            this._showMessage('내보낼 신호처리 결과가 없습니다', 'error');
            return;
        }

        const exportData = {
            sensor: this.lastProcessingSensor,
            processingType: this.lastProcessingType,
            timestamp: new Date().toISOString(),
            sampleRate: 1000 / (dataLoader.data.sample_interval_ms || 100),
            result: this.lastSignalProcessingResult
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.lastProcessingType}_${this.lastProcessingSensor}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this._showMessage('JSON 내보내기 완료', 'success');
    }

    /**
     * 신호처리 결과 CSV로 내보내기
     */
    exportSignalProcessingCSV() {
        if (!this.lastSignalProcessingResult || !this.lastProcessingType) {
            this._showMessage('내보낼 신호처리 결과가 없습니다', 'error');
            return;
        }

        let csv = '';
        const result = this.lastSignalProcessingResult;

        switch(this.lastProcessingType) {
            case 'fft':
                csv = 'Frequency (Hz),Magnitude (dB),Phase (rad)\n';
                result.frequencies.forEach((f, i) => {
                    csv += `${f},${result.magnitude[i]},${result.phase[i]}\n`;
                });
                break;

            case 'stft':
                // STFT는 2D 데이터이므로 long format으로 출력
                csv = 'Time (s),Frequency (Hz),Magnitude (dB)\n';
                result.times.forEach((t, i) => {
                    result.frequencies.forEach((f, j) => {
                        csv += `${t},${f},${result.spectrogram[j][i]}\n`;
                    });
                });
                break;

            case 'wavelet':
                // Wavelet도 2D 데이터
                csv = 'Time (s),Frequency (Hz),Magnitude\n';
                result.time.forEach((t, i) => {
                    result.frequencies.forEach((f, j) => {
                        csv += `${t},${f},${result.spectrogram[j][i]}\n`;
                    });
                });
                break;

            case 'hilbert':
                csv = 'Time (s),Envelope\n';
                result.envelope.forEach((env, i) => {
                    const time = i * (dataLoader.data.sample_interval_ms || 100) / 1000;
                    csv += `${time},${env}\n`;
                });
                break;

            default:
                this._showMessage('지원하지 않는 신호처리 타입입니다', 'error');
                return;
        }

        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.lastProcessingType}_${this.lastProcessingSensor}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this._showMessage('CSV 내보내기 완료', 'success');
    }

    /**
     * 로딩 표시
     */
    _showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    /**
     * 메시지 표시
     */
    _showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.right = '20px';
        messageDiv.style.zIndex = '1001';
        messageDiv.style.maxWidth = '400px';

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    /**
     * 자동 갱신 시작
     */
    _startAutoUpdate() {
        if (this.autoUpdateTimer) return;

        this.autoUpdateTimer = setInterval(() => {
            this._updateCurrentStatus();
        }, this.updateInterval);
    }

    /**
     * 자동 갱신 재시작
     */
    _restartAutoUpdate() {
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
        }
        this._startAutoUpdate();
    }
}

// 페이지 로드 완료 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
