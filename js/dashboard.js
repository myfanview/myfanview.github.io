/**
 * CoolDiag Dashboard - Main Logic
 */

class Dashboard {
    constructor() {
        this.currentSensor = null;
        this.currentGraphType = 'timeseries';
        this.updateInterval = 10000;
        this.autoUpdateTimer = null;
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
     * 이벤트 리스너 설정
     */
    _setupEventListeners() {
        // 센서 선택
        document.getElementById('sensorSelect').addEventListener('change', (e) => {
            this.currentSensor = e.target.value;
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
            console.log('[*] 샘플 데이터 생성...');
            const sampleData = DataLoader.generateSampleData();
            dataLoader.rawData = sampleData;
            dataLoader._processData();
            
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
        // 센서 목록 업데이트
        const sensors = dataLoader.getSensorList();
        const sensorSelect = document.getElementById('sensorSelect');
        
        sensorSelect.innerHTML = '';
        sensors.forEach(sensor => {
            const option = document.createElement('option');
            option.value = sensor;
            option.textContent = sensor;
            sensorSelect.appendChild(option);
        });

        if (sensors.length > 0) {
            this.currentSensor = sensors[0];
            sensorSelect.value = this.currentSensor;
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
     * 현재 상태 업데이트
     */
    _updateCurrentStatus() {
        const sensors = dataLoader.getSensorList();

        // CPU 팬 RPM
        const cpuFanSensor = sensors.find(s => s.includes('CPU') && s.includes('FAN') && !s.includes('PWM'));
        if (cpuFanSensor) {
            const data = dataLoader.getSensorData(cpuFanSensor);
            if (data && data.length > 0) {
                const rpm = data[data.length - 1].value;
                document.getElementById('cpuFanRpm').textContent = rpm.toFixed(0);
            }
        }

        // CPU 온도
        const cpuTempSensor = sensors.find(s => s.includes('CPU') && s.includes('Temperature'));
        if (cpuTempSensor) {
            const data = dataLoader.getSensorData(cpuTempSensor);
            if (data && data.length > 0) {
                const temp = data[data.length - 1].value;
                document.getElementById('cpuTemp').textContent = temp.toFixed(1);
            }
        }

        // PWM 비율
        const pwmSensor = sensors.find(s => s.includes('PWM'));
        if (pwmSensor) {
            const data = dataLoader.getSensorData(pwmSensor);
            if (data && data.length > 0) {
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

            let trace, layout;

            switch (this.currentGraphType) {
                case 'timeseries':
                    ({ trace, layout } = this._createTimeseriesPlot(values, timestamps));
                    break;

                case 'timeseries-temp':
                    ({ trace, layout } = this._createTimeseriesPlot(values, timestamps, '온도 (°C)'));
                    break;

                case 'pwm-rpm':
                    await this._renderPwmVsRpm();
                    return;

                case '3d':
                    await this._render3DPlot();
                    return;

                case 'fft':
                    ({ trace, layout } = this._createFFTPlot(values));
                    break;

                case 'stft':
                    ({ trace, layout } = this._createSTFTPlot(values));
                    break;

                case 'wavelet':
                    ({ trace, layout } = this._createWaveletPlot(values));
                    break;

                case 'hilbert':
                    ({ trace, layout } = this._createHilbertPlot(values));
                    break;

                default:
                    return;
            }

            Plotly.newPlot('mainGraph', [trace], layout, {responsive: true});

            // 통계 업데이트
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
    _createTimeseriesPlot(values, timestamps, ylabel = '값') {
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
        const fftResult = signalProcessor.performFFT(values);
        if (!fftResult) {
            throw new Error('FFT 계산 실패');
        }

        const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
        const freqs = signalProcessor.getFrequencies(values.length, sampleRate).slice(0, fftResult.magnitude.length / 2);
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
        const stftResult = signalProcessor.performSTFT(values, 128, 64);
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
        const waveletResult = signalProcessor.performWavelet(values);
        if (!waveletResult) {
            throw new Error('Wavelet 계산 실패');
        }

        // 에너지 정규화
        const normalized = waveletResult.coefficients.map(row =>
            row.map(v => Math.log10(v + 1e-10))
        );

        const trace = {
            z: normalized,
            type: 'heatmap',
            colorscale: 'Viridis',
            hovertemplate: '<b>시간:</b> %{x:.2f}s<br><b>스케일:</b> %{y}<br><b>에너지:</b> %{z:.2f}<extra></extra>'
        };

        const layout = {
            title: `${this.currentSensor} - Wavelet Transform (Morlet)`,
            xaxis: {title: '시간'},
            yaxis: {title: '스케일'},
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            margin: {t: 40, b: 40, l: 60, r: 40}
        };

        return {trace, layout};
    }

    /**
     * Hilbert 포락선 플롯 생성
     */
    _createHilbertPlot(values) {
        const hilbertResult = signalProcessor.performHilbert(values);
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
        
        const pwmSensor = sensors.find(s => s.includes('PWM'));
        const rpmSensor = sensors.find(s => s.includes('FAN') && !s.includes('PWM'));

        if (!pwmSensor || !rpmSensor) {
            this._showMessage('PWM 또는 RPM 데이터를 찾을 수 없습니다', 'error');
            return;
        }

        const pwmData = dataLoader.getSensorData(pwmSensor).map(r => r.value);
        const rpmData = dataLoader.getSensorData(rpmSensor).map(r => r.value);

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
            text: Array.from({length: pwmData.length}, (_, i) => `시간: ${i}`),
            hovertemplate: '<b>PWM:</b> %{x:.1f}%<br><b>RPM:</b> %{y:.0f}<extra></extra>'
        };

        const layout = {
            title: 'PWM vs RPM (팬 성능 곡선)',
            xaxis: {title: 'PWM (%)'},
            yaxis: {title: 'RPM'},
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
        
        const pwmSensor = sensors.find(s => s.includes('PWM'));
        const rpmSensor = sensors.find(s => s.includes('FAN') && !s.includes('PWM'));

        if (!pwmSensor || !rpmSensor) {
            this._showMessage('필요한 데이터를 찾을 수 없습니다', 'error');
            return;
        }

        const pwmData = dataLoader.getSensorData(pwmSensor).map(r => r.value);
        const rpmData = dataLoader.getSensorData(rpmSensor).map(r => r.value);
        const timeData = Array.from({length: pwmData.length}, (_, i) => i);

        const trace = {
            x: pwmData,
            y: rpmData,
            z: timeData,
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                size: 4,
                color: timeData,
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
                yaxis: {title: 'RPM'},
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
        const stats = signalProcessor.getStatistics(values);
        
        document.getElementById('statMean').textContent = stats.mean.toFixed(2);
        document.getElementById('statMin').textContent = stats.min.toFixed(2);
        document.getElementById('statMax').textContent = stats.max.toFixed(2);
        document.getElementById('statStdDev').textContent = stats.stdDev.toFixed(2);
    }

    /**
     * 분석 텍스트 업데이트
     */
    _updateAnalysisText(graphType, values) {
        const stats = signalProcessor.getStatistics(values);
        let analysisText = '';

        switch (graphType) {
            case 'fft':
                const fftResult = signalProcessor.performFFT(values);
                if (fftResult) {
                    const maxMagIdx = fftResult.magnitude.indexOf(Math.max(...fftResult.magnitude));
                    const sampleRate = 1000 / (dataLoader.data.sample_interval_ms || 100);
                    const peakFreq = (maxMagIdx * sampleRate) / values.length;
                    analysisText = `피크 주파수: ${peakFreq.toFixed(2)} Hz (크기: ${fftResult.magnitude[maxMagIdx].toFixed(2)})`;
                }
                break;

            case 'stft':
                analysisText = '시간-주파수 에너지 분포를 관찰하세요. 밝은 영역이 높은 에너지를 나타냅니다.';
                break;

            case 'wavelet':
                analysisText = '다중 스케일에서의 신호 특성을 분석합니다. 밝은 색은 높은 에너지입니다.';
                break;

            case 'hilbert':
                analysisText = `신호의 포락선을 추출했습니다. 포락선은 진폭 변조 신호의 회복에 유용합니다.`;
                break;

            case 'pwm-rpm':
                analysisText = `PWM과 RPM의 관계를 나타냅니다. 정상적인 팬은 선형 관계를 보입니다.`;
                break;

            default:
                analysisText = `평균: ${stats.mean.toFixed(2)}, 표준편차: ${stats.stdDev.toFixed(2)}`;
        }

        document.getElementById('analysisText').textContent = analysisText;
    }

    /**
     * 고장 진단 업데이트
     */
    _updateDiagnosis() {
        const warnings = dataLoader.performDiagnosis();
        const warningBox = document.getElementById('warningBox');
        const warningText = document.getElementById('warningText');

        warningBox.classList.remove('warning', 'danger');

        if (warnings.length === 0) {
            warningBox.classList.add('success');
            warningText.textContent = '정상';
        } else {
            const maxLevel = warnings.some(w => w.level === 'danger') ? 'danger' : 'warning';
            warningBox.classList.add(maxLevel);
            warningText.innerHTML = warnings.map(w => `• ${w.message}`).join('<br>');
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
