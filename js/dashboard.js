/**
 * CoolDiag Dashboard - Main Logic
 */

class Dashboard {
    constructor() {
        this.currentSensor = null;
        this.currentGraphType = 'timeseries';
        this.updateInterval = 10000;
        this.autoUpdateTimer = null;
        this.waveletFrequencyMode = false;  // Wavelet y축 모드: false=스케일, true=주파수
        this.githubConfig = {
            username: 'YOUR_USERNAME', // 사용자가 설정해야 함
            repo: 'YOUR_REPO',
            filepath: 'data/sensor_data.json'
        };

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
        if (!this.currentSensor) return 'Unknown';
        const sensorData = dataLoader.getSensorData(this.currentSensor);
        if (sensorData && sensorData.length > 0) {
            return sensorData[0].type;
        }
        return 'Unknown';
    }

    /**
     * 센서 타입별 허용 그래프 타입
     */
    _getAllowedGraphTypes() {
        const sensorType = this._getCurrentSensorType();
        
        const allowedTypes = {
            // Temperature: 온도 변화 시계열만 필요 (신호처리 분석 불필요)
            'Temperature': [
                { value: 'timeseries', label: '시계열 (온도)' }
            ],
            // Fan: 시계열 + 주파수 분석 (RPM 변화 특성 분석)
            'Fan': [
                { value: 'timeseries', label: '시계열 (RPM)' },
                { value: 'fft', label: 'FFT 스펙트럼' },
                { value: 'stft', label: 'STFT 스펙트로그램' },
                { value: 'wavelet', label: 'Wavelet Transform' },
                { value: 'hilbert', label: 'Hilbert 포락선' }
            ],
            // Control: PWM 제어 신호 (GPU 팬 제어 신호 분석)
            'Control': [
                { value: 'timeseries', label: '시계열 (PWM %)' },
                { value: 'fft', label: 'FFT 스펙트럼' }
            ],
            // Voltage: 전압 데이터 (수집되지 않음)
            'Voltage': [
                { value: 'timeseries', label: '시계열 (전압)' }
            ],
            // Power: 전력 데이터 (수집되지 않음)
            'Power': [
                { value: 'timeseries', label: '시계열 (전력)' }
            ],
            // Unknown: 기본 시계열만
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
        // 센서 선택
        document.getElementById('sensorSelect').addEventListener('change', (e) => {
            this.currentSensor = e.target.value;
            this._updateGraphTypeOptions();  // 그래프 타입 옵션 업데이트
            this.renderGraph();
        });

        // 그래프 타입 선택
        document.getElementById('graphType').addEventListener('change', (e) => {
            this.currentGraphType = e.target.value;
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
    }

    /**
     * 샘플 데이터 로드 (테스트용)
     */
    async _loadSampleData() {
        try {
            console.log('[*] 샘플 데이터 로드 중...');
            // sampledata.json 파일에서 로드 (또는 실패 시 합성 데이터 사용)
            await dataLoader.loadSampleDataFromFile();
            
            this._updateUI();
            
            console.log('[+] 샘플 데이터 로드 완료');
        } catch (error) {
            console.error('[ERROR] 샘플 데이터 로드 실패:', error);
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
        // 센서 목록 업데이트 (타입별 그룹화)
        const sensors = dataLoader.getSensorList();
        const sensorSelect = document.getElementById('sensorSelect');
        
        sensorSelect.innerHTML = '';
        
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

        // 드롭다운 구성 (타입별 옵션 그룹)
        const typeOrder = ['Temperature', 'Fan', 'Control', 'Voltage', 'Power', 'Unknown'];
        
        typeOrder.forEach(type => {
            if (sensorsByType[type]) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = this._getTypeLabel(type);
                
                sensorsByType[type].sort().forEach(sensor => {
                    const option = document.createElement('option');
                    option.value = sensor;
                    option.textContent = sensor;
                    optgroup.appendChild(option);
                });
                
                sensorSelect.appendChild(optgroup);
            }
        });

        if (sensors.length > 0) {
            this.currentSensor = sensors[0];
            sensorSelect.value = this.currentSensor;
            this._updateGraphTypeOptions();  // 그래프 타입 필터링
        }

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
        if (!this.currentSensor) return;

        this._showLoading(true);

        try {
            const sensorData = dataLoader.getSensorData(this.currentSensor);
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

            // 통계 업데이트 (정적 메서드 호출)
            this._updateStatistics(values);

            // 분석 텍스트 업데이트
            this._updateAnalysisText(this.currentGraphType, values);
        } catch (error) {
            console.error('[ERROR] 그래프 렌더링 오류:', error);
            this._showMessage('그래프 렌더링 실패: ' + error.message, 'error');
        }

        this._showLoading(false);
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
        const fftResult = SignalProcessor.performFFT(values);
        if (!fftResult) {
            throw new Error('FFT 계산 실패');
        }

        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
        const freqs = SignalProcessor.getFrequencies(values.length, sampleRate).slice(0, fftResult.magnitude.length / 2);
        const magnitude = fftResult.magnitude.slice(0, fftResult.magnitude.length / 2);

        // dB 스케일
        const magnitudeDb = magnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));

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

        const layout = {
            title: `${this.currentSensor} - FFT 스펙트럼`,
            xaxis: {title: '주파수 (Hz)'},
            yaxis: {title: '크기 (dB)'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        return {trace, layout};
    }

    /**
     * STFT 플롯 생성
     */
    _createSTFTPlot(values) {
        const stftResult = SignalProcessor.performSTFT(values, 128, 64);
        if (!stftResult) {
            throw new Error('STFT 계산 실패');
        }

        const trace = {
            z: stftResult.spectrogram,
            type: 'heatmap',
            colorscale: 'Jet',
            hovertemplate: '<b>시간:</b> %{x:.2f}s<br><b>주파수:</b> %{y:.0f} Hz<br><b>크기:</b> %{z:.2f} dB<extra></extra>'
        };

        const layout = {
            title: `${this.currentSensor} - STFT 스펙트로그램`,
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
        const waveletResult = SignalProcessor.performWavelet(values);
        if (!waveletResult) {
            throw new Error('Wavelet 계산 실패');
        }

        // 에너지 정규화
        const normalized = waveletResult.coefficients.map(row =>
            row.map(v => Math.log10(v + 1e-10))
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

        const trace = {
            z: normalized,
            y: yAxisData,
            type: 'heatmap',
            colorscale: 'Viridis',
            hovertemplate: hoverTemplate
        };

        const layout = {
            title: `${this.currentSensor} - Wavelet Transform (Morlet)`,
            xaxis: {title: '시간'},
            yaxis: {
                title: yAxisTitle,
                type: this.waveletFrequencyMode ? 'log' : 'linear'
            },
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        return {trace, layout, yAxisLabel};
    }

    /**
     * Hilbert 포락선 플롯 생성
     */
    _createHilbertPlot(values) {
        const hilbertResult = SignalProcessor.performHilbert(values);
        if (!hilbertResult) {
            throw new Error('Hilbert 계산 실패');
        }

        const timeAxis = Array.from({length: values.length}, (_, i) => i * (dataLoader.data.sample_interval_ms || 100) / 1000);

        const traces = [
            {
                x: timeAxis,
                y: values,
                name: '원본 신호',
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

        const layout = {
            title: `${this.currentSensor} - Hilbert 포락선`,
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
                const fftResult = SignalProcessor.performFFT(values);
                if (fftResult) {
                    const maxMagIdx = fftResult.magnitude.indexOf(Math.max(...fftResult.magnitude));
                    const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
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

        const sensorData = dataLoader.getSensorData(this.currentSensor);
        if (!sensorData || sensorData.length === 0) return;

        const values = sensorData.map(r => r.value);
        const stats = SignalProcessor.getStatistics(values);

        // 센서 타입별 진단 규칙
        if (sensorType === 'Temperature') {
            // 온도 진단
            if (stats.max > 90) {
                warnings.push({
                    level: 'danger',
                    message: `위험한 고온: ${stats.max.toFixed(1)}°C (즉시 조치 필요)`
                });
            } else if (stats.max > 80) {
                warnings.push({
                    level: 'warning',
                    message: `높은 온도: ${stats.max.toFixed(1)}°C (냉각 개선 필요)`
                });
            }
            
            if (stats.mean < 0) {
                warnings.push({
                    level: 'danger',
                    message: '센서 오류: 음수 온도 감지'
                });
            }

        } else if (sensorType === 'Fan') {
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
