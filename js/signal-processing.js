/**
 * Signal Processing Module - FFT, STFT, Wavelet, Hilbert Transform
 */

class SignalProcessor {
    /**
     * FFT (Fast Fourier Transform)
     * DSP.js 라이브러리 사용
     */
    static performFFT(signal, sampleRate = null) {
        if (!signal || signal.length === 0) {
            console.error('FFT: 신호 데이터가 없습니다');
            return null;
        }

        if (sampleRate === null) {
            console.error('FFT: 샘플링 레이트가 지정되지 않았습니다');
            return null;
        }

        try {
            // DSP.js 라이브러리 확인
            if (typeof window.FFT === 'undefined') {
                console.error('FFT 라이브러리(DSP.js)가 로드되지 않았습니다');
                return null;
            }

            // 신호 길이를 2의 거듭제곱으로 조정 (FFT 최적화)
            const n = Math.pow(2, Math.ceil(Math.log2(signal.length)));
            const paddedSignal = new Array(n).fill(0);
            for (let i = 0; i < signal.length; i++) {
                paddedSignal[i] = signal[i];
            }

            // DSP.js FFT 인스턴스 생성
            // new FFT(bufferSize, sampleRate)
            const fft = new window.FFT(n, sampleRate);
            
            // FFT 수행
            fft.forward(paddedSignal);

            // 결과 추출
            const magnitude = [];
            const phase = [];
            const real = [];
            const imaginary = [];

            // DSP.js는 spectrum (magnitude) 배열을 제공
            // real과 imaginary는 내부 배열로 접근
            for (let i = 0; i < n / 2; i++) {
                const r = fft.real[i];
                const im = fft.imag[i];
                magnitude.push(Math.sqrt(r * r + im * im));
                phase.push(Math.atan2(im, r));
                real.push(r);
                imaginary.push(im);
            }

            return {
                magnitude: magnitude,
                phase: phase,
                real: real,
                imaginary: imaginary,

                // 메타데이터 (대안 1: 정확한 FFT 길이 정보)
                fftLength: n,                           // 실제 FFT 길이 (zero-padding 포함)
                originalLength: signal.length,          // 원본 신호 길이
                frequencyBins: Math.floor(n / 2),       // 주파수 빈 개수
                frequencyResolution: sampleRate / n,    // 주파수 해상도 (Hz)
                sampleRate: sampleRate                  // 샘플링 레이트 저장
            };
        } catch (error) {
            console.error('FFT 오류:', error);
            return null;
        }
    }

    /**
     * 신호 특성에 따라 적절한 윈도우 크기 자동 계산
     * @param {number} signalLength - 신호의 샘플 개수
     * @param {number} sampleRate - 샘플링 레이트 (Hz)
     * @param {object} options - 옵션 {
     *   expectedFrequency: null,     // 신호의 기본 주파수 (Hz)
     *   frequencyResolution: null,   // 원하는 주파수 해상도 (Hz)
     *   cyclesPerWindow: 5,          // 각 윈도우에 포함할 주기 수
     *   minFrameCount: 3,            // 최소 프레임 개수
     *   maxFrameCount: 20,           // 최대 프레임 개수
     *   minWindowSize: 32            // 최소 윈도우 크기 (2^5)
     * }
     * @returns {object} {
     *   windowSize,      // 계산된 윈도우 크기
     *   hopSize,         // 홉 크기 (windowSize / 2)
     *   frameCount,      // 예상 프레임 개수
     *   method,          // 사용된 방법
     *   metadata: { ... }
     * }
     */
    static _autoCalculateWindowSize(signalLength, sampleRate, options = {}) {
        const opts = {
            expectedFrequency: options.expectedFrequency || null,
            frequencyResolution: options.frequencyResolution || null,
            cyclesPerWindow: options.cyclesPerWindow || 5,
            minFrameCount: options.minFrameCount || 3,
            maxFrameCount: options.maxFrameCount || 20,
            minWindowSize: options.minWindowSize || 32
        };

        let windowSize, method;
        const metadata = {
            samplesPerCycle: null,
            idealWindowSize: null,
            frequencyResolution: null,
            warnings: []
        };

        // Step 1: 방법 결정 및 초기 계산
        if (opts.expectedFrequency && opts.expectedFrequency > 0) {
            // 방법 1: 신호 주파수 기반 (가장 정확)
            method = 'frequency-based';
            const samplesPerCycle = sampleRate / opts.expectedFrequency;
            metadata.samplesPerCycle = samplesPerCycle;

            // 각 윈도우에 N주기 포함
            const idealSize = samplesPerCycle * opts.cyclesPerWindow;
            metadata.idealWindowSize = idealSize;

            // 2의 거듭제곱으로 반올림
            windowSize = Math.pow(2, Math.ceil(Math.log2(idealSize)));

        } else if (opts.frequencyResolution && opts.frequencyResolution > 0) {
            // 방법 2: 주파수 해상도 기반
            method = 'resolution-based';
            metadata.frequencyResolution = opts.frequencyResolution;

            // 필요한 FFT 길이: sampleRate / frequencyResolution
            const idealSize = sampleRate / opts.frequencyResolution;
            metadata.idealWindowSize = idealSize;

            // 2의 거듭제곱으로 반올림
            windowSize = Math.pow(2, Math.ceil(Math.log2(idealSize)));

        } else {
            // 방법 3: 적응형 (기본, 신호 길이 기반)
            method = 'adaptive';
            const frameCountTarget = 15;  // 목표 프레임 개수
            const idealSize = signalLength / frameCountTarget;
            metadata.idealWindowSize = idealSize;

            // 2의 거듭제곱으로 반올림 (내림)
            windowSize = Math.pow(2, Math.floor(Math.log2(idealSize)));
        }

        // Step 2: 신호 길이와의 호환성 검증
        if (windowSize > signalLength) {
            metadata.warnings.push(`신호가 윈도우보다 짧음: ${signalLength} < ${windowSize}`);
            windowSize = Math.pow(2, Math.floor(Math.log2(signalLength)));
        }

        if (windowSize > signalLength / 2) {
            metadata.warnings.push(`프레임이 너무 적을 수 있음: 윈도우=${windowSize}, 신호=${signalLength}`);
            windowSize = Math.pow(2, Math.ceil(Math.log2(signalLength)) - 2);
        }

        if (windowSize < opts.minWindowSize) {
            metadata.warnings.push(`최소 윈도우 크기로 조정: ${opts.minWindowSize}`);
            windowSize = opts.minWindowSize;
        }

        // Step 3: 프레임 개수 계산
        const hopSize = Math.floor(windowSize / 2);  // 50% overlap
        const frameCount = Math.floor((signalLength - windowSize) / hopSize) + 1;

        if (frameCount < opts.minFrameCount) {
            metadata.warnings.push(`프레임 개수가 너무 적음: ${frameCount} < ${opts.minFrameCount}`);
        }
        if (frameCount > opts.maxFrameCount) {
            metadata.warnings.push(`프레임 개수가 너무 많음: ${frameCount} > ${opts.maxFrameCount}`);
        }

        // Step 4: 메타데이터 최종화
        metadata.frequencyResolution = sampleRate / windowSize;

        console.log(`[Window Size] 방법=${method}, 크기=${windowSize}, 홉=${hopSize}, 프레임=${frameCount}, 주파수분해능=${metadata.frequencyResolution.toFixed(4)}Hz`);
        if (metadata.warnings.length > 0) {
            console.warn('[Window 경고]', metadata.warnings.join(' | '));
        }

        return {
            windowSize: windowSize,
            hopSize: hopSize,
            frameCount: frameCount,
            method: method,
            metadata: metadata
        };
    }

    /**
     * 주파수 축 계산
     */
    static getFrequencies(fftLength, sampleRate) {
        const freqs = [];
        for (let i = 0; i < fftLength / 2; i++) {
            freqs.push((i * sampleRate) / fftLength);
        }
        return freqs;
    }

    /**
     * STFT (Short-Time Fourier Transform)
     * 시간-주파수 분석
     * 대안 4: 주파수 배열을 직접 생성해서 반환
     *
     * @param {Array} signal - 입력 신호
     * @param {number} windowSize - 윈도우 크기 (기본 256)
     * @param {number} hopSize - 홉 크기 (기본 128, 50% overlap)
     * @param {number} sampleRate - 샘플링 레이트 (Hz)
     * @param {object} windowOptions - 윈도우 자동 계산 옵션 {
     *   windowType: 'hann',  // 'rectangular', 'hann', 'hamming', 'blackman', 'kaiser'
     *   expectedFrequency: null,
     *   frequencyResolution: null,
     *   ... (다른 _autoCalculateWindowSize 옵션)
     * }
     * @returns {object} STFT 결과 + 주파수 배열
     */
    static performSTFT(signal, windowSize = 256, hopSize = 128, sampleRate = null, windowOptions = {}) {
        if (!signal || signal.length === 0) {
            console.error('STFT: 신호 데이터가 없습니다');
            return null;
        }

        if (sampleRate === null) {
            console.error('STFT: 샘플링 레이트가 지정되지 않았습니다');
            return null;
        }

        const result = [];
        const times = [];
        let isFirstFrame = true;

        // 윈도우 함수 타입 결정
        const windowType = windowOptions.windowType || 'hann';
        const kaisarBeta = windowOptions.kaiserBeta || 8.6;

        // 윈도우 생성
        const window = this.getWindow(windowType, windowSize, kaisarBeta);

        // Zero-padding 길이 결정 (대안 4: 고정값 사용)
        const fftLengthUsed = 512;

        for (let start = 0; start + windowSize <= signal.length; start += hopSize) {
            // 신호 절편 추출
            const segment = signal.slice(start, start + windowSize);

            // 윈도우 적용
            const windowed = segment.map((x, i) => x * window[i]);

            // Zero-padding to fftLengthUsed
            while (windowed.length < fftLengthUsed) {
                windowed.push(0);
            }

            // FFT 수행 (sampleRate 전달)
            const fft = this.performFFT(windowed, sampleRate);

            if (fft) {
                // 양수 주파수만 추출
                let magnitude = fft.magnitude.slice(0, fft.magnitude.length / 2);

                // 정규화 전 peak 값 (디버그용)
                const peakBeforeNorm = Math.max(...magnitude);

                // Magnitude 정규화
                // DFT 정규화 공식:
                //   - i=0 (DC): |X[0]| / N
                //   - 0<i<N/2 (양수 주파수): 2×|X[i]| / N
                //   - i=N/2 (Nyquist): |X[N/2]| / N
                magnitude = magnitude.map((m, i) => {
                    if (i === 0 || i === fftLengthUsed / 2) {
                        return m / fftLengthUsed;  // DC와 Nyquist
                    }
                    return 2 * m / fftLengthUsed;  // 양수 주파수
                });

                // 정규화 후 peak 값 (디버그용)
                const peakAfterNorm = Math.max(...magnitude);

                // 첫 프레임에서 정규화 영향도 로그
                if (isFirstFrame) {
                    console.log('[STFT] 정규화 적용:', {
                        signalLength: signal.length,
                        windowSize: windowSize,
                        windowType: windowType,
                        fftSize: fftLengthUsed,
                        peakBeforeNorm: peakBeforeNorm.toFixed(4),
                        peakAfterNorm: peakAfterNorm.toFixed(6),
                        normalizationFactor: (peakBeforeNorm / peakAfterNorm).toFixed(1) + 'x'
                    });
                    isFirstFrame = false;
                }

                // dB 스케일
                const magnitudeDb = magnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));

                result.push(magnitudeDb);
                times.push(start / sampleRate); // 타임 스탬프 (실제 샘플링 레이트 사용)
            }
        }

        // 주파수 배열 한 번만 생성 (대안 4)
        const frequencies = this.getFrequencies(fftLengthUsed, sampleRate)
            .slice(0, fftLengthUsed / 2);

        return {
            spectrogram: result,
            times: times,
            windowSize: windowSize,
            hopSize: hopSize,

            // 대안 4: 주파수 배열 포함
            frequencies: frequencies,

            // 메타데이터
            fftLength: fftLengthUsed,
            sampleRate: sampleRate,
            signalLength: signal.length,
            frameCount: result.length,

            // 계산 정보
            frequencyResolution: sampleRate / fftLengthUsed,
            nyquistFrequency: sampleRate / 2,

            // 디버그 로깅
            debug: {
                message: `STFT 완료: 윈도우=${windowSize}/${windowType}, 홉=${hopSize}, 프레임=${result.length}, 주파수빈=${frequencies.length}`,
                windowType: windowType
            }
        };
    }

    /**
     * Hilbert Transform (포락선 추출)
     * 해석적 신호(Analytic Signal) 생성 후 포락선 계산
     */
    static performHilbert(signal, sampleRate = null) {
        if (!signal || signal.length === 0) {
            console.error('Hilbert: 신호 데이터가 없습니다');
            return null;
        }

        if (sampleRate === null) {
            console.error('Hilbert: 샘플링 레이트가 지정되지 않았습니다');
            return null;
        }

        try {
            const n = signal.length;

            // Zero-padding: 신호 길이를 2의 거듭제곱으로
            const n_fft = Math.pow(2, Math.ceil(Math.log2(n)));

            const paddedSignal = [...signal];
            while (paddedSignal.length < n_fft) {
                paddedSignal.push(0);
            }

            // DSP.js FFT 수행
            const fftInstance = new window.FFT(n_fft, sampleRate);
            fftInstance.forward(paddedSignal);

            // 복소수 배열로 변환
            const spectrum = [];
            for (let i = 0; i < n_fft; i++) {
                spectrum.push([fftInstance.real[i], fftInstance.imag[i]]);
            }

            // Hilbert 필터 적용하여 해석적 신호 생성
            // H(f) = 1 (f=0), 2 (0<f<Nyquist), 1 (f=Nyquist), 0 (f>Nyquist)
            const analyticSpectrum = [];

            // DC 성분 (f=0): 유지
            analyticSpectrum[0] = [spectrum[0][0], spectrum[0][1]];

            // 양수 주파수 (0 < f < Nyquist): 2배
            for (let i = 1; i < n_fft / 2; i++) {
                analyticSpectrum[i] = [spectrum[i][0] * 2, spectrum[i][1] * 2];
            }

            // 나이퀴스트 주파수 (f = Nyquist): 유지
            analyticSpectrum[n_fft / 2] = [spectrum[n_fft / 2][0], spectrum[n_fft / 2][1]];

            // 음수 주파수 (f > Nyquist): 제거
            for (let i = Math.floor(n_fft / 2) + 1; i < n_fft; i++) {
                analyticSpectrum[i] = [0, 0];
            }

            // IFFT 수행
            // Hilbert Transform은 포락선 정확성이 중요하므로
            // 정규화가 보장된 _simpleIFFT 사용 (O(n²) 복잡도이지만 신호가 짧음)
            const analyticSignalFull = this._simpleIFFT(analyticSpectrum);

            // 원래 길이로 자르기
            const analyticSignal = analyticSignalFull.slice(0, n);

            // 포락선 계산 (복소수 크기)
            // envelope = |z| = sqrt(real^2 + imag^2)
            const envelope = analyticSignal.map(c =>
                Math.sqrt(c[0] * c[0] + c[1] * c[1])
            );

            // 추가 검증: 포락선이 원본 신호를 항상 감싸는지 확인
            let crossCount = 0;
            for (let i = 0; i < n; i++) {
                if (envelope[i] < Math.abs(signal[i]) - 1e-6) {  // 부동소수점 오차 고려
                    crossCount++;
                }
            }

            if (crossCount > 0) {
                console.warn(`[Hilbert] 포락선이 원본 신호 아래로 내려가는 지점: ${crossCount}개`);
            }

            // 결과 검증
            const maxOriginal = Math.max(...signal.map(Math.abs));
            const maxEnvelope = Math.max(...envelope);

            console.log('[Hilbert] 포락선 검증:', {
                maxOriginal: maxOriginal.toFixed(2),
                maxEnvelope: maxEnvelope.toFixed(2),
                ratio: (maxEnvelope / maxOriginal).toFixed(2),
                crossCount: crossCount
            });

            return {
                envelope: envelope,
                analyticSignal: analyticSignal
            };
        } catch (error) {
            console.error('Hilbert 오류:', error);
            return null;
        }
    }

    /**
     * Continuous Wavelet Transform (CWT)
     * Complex Morlet Wavelet 사용
     * @param {Array} signal - 입력 신호
     * @param {Array} scales - 스케일 배열 (null이면 자동 생성)
     * @param {string} wavelet - Wavelet 타입 (현재는 'morlet'만 지원)
     * @param {number} sampleRate - 샘플링 레이트 (Hz)
     * @param {object} options - 옵션 {omega0, sigma, edgeMode}
     */
    static performWavelet(signal, scales = null, wavelet = 'morlet', sampleRate = null, options = {}) {
        if (!signal || signal.length === 0) {
            console.error('Wavelet: 신호 데이터가 없습니다');
            return null;
        }

        if (sampleRate === null) {
            console.error('Wavelet: 샘플링 레이트가 지정되지 않았습니다');
            return null;
        }

        try {
            // 옵션 파라미터
            const omega0 = options.omega0 || 5;  // 중심 각주파수
            const sigma = options.sigma || 1;    // Gaussian 표준편차
            const edgeMode = options.edgeMode || 'none';  // 에지 처리 방식
            const filterNyquist = options.filterNyquist !== undefined ? options.filterNyquist : true;  // 나이퀴스트 필터

            // 기본 스케일 범위
            if (!scales) {
                scales = [];
                for (let s = 1; s <= 64; s *= 1.2) {
                    scales.push(Math.floor(s));
                }
                scales = [...new Set(scales)].sort((a, b) => a - b);
            }

            // 나이퀴스트 주파수 필터링
            const nyquistFreq = sampleRate / 2;
            const centerFrequency = omega0 / (2 * Math.PI);

            if (filterNyquist) {
                const originalLength = scales.length;
                // 각 scale에 대해 최대 주파수 계산
                scales = scales.filter(scale => {
                    const maxFreq = centerFrequency * sampleRate / scale;
                    return maxFreq <= nyquistFreq;
                });

                if (scales.length < originalLength) {
                    console.log(`[Wavelet] 나이퀴스트 필터: ${originalLength}개 중 ${originalLength - scales.length}개 Scale 제거됨`);
                    console.log(`[Wavelet] 필터링 후 Scale 범위: ${scales[0]} ~ ${scales[scales.length - 1]}`);
                }

                if (scales.length === 0) {
                    console.error('[Wavelet] 오류: 모든 Scale이 나이퀴스트 주파수를 초과합니다. omega0 값을 낮추거나 샘플링 레이트를 높여주세요.');
                    return null;
                }
            }

            // 에지 처리: 신호 패딩
            let paddedSignal = [...signal];
            let padLeft = 0;

            if (edgeMode !== 'none') {
                const maxScale = Math.max(...scales);
                const padSize = Math.floor(maxScale * 5);  // 양쪽에 충분한 패딩

                switch (edgeMode) {
                    case 'zero':
                        // Zero-padding
                        const zeros = new Array(padSize).fill(0);
                        paddedSignal = [...zeros, ...signal, ...zeros];
                        padLeft = padSize;
                        break;

                    case 'symmetric':
                        // 대칭 확장
                        const leftPad = signal.slice(0, padSize).reverse();
                        const rightPad = signal.slice(-padSize).reverse();
                        paddedSignal = [...leftPad, ...signal, ...rightPad];
                        padLeft = padSize;
                        break;

                    case 'reflect':
                        // 반사 (경계값 제외하고 반전)
                        const leftReflect = signal.slice(1, padSize + 1).reverse();
                        const rightReflect = signal.slice(-padSize - 1, -1).reverse();
                        paddedSignal = [...leftReflect, ...signal, ...rightReflect];
                        padLeft = padSize;
                        break;
                }

                console.log(`[Wavelet] 에지 처리: ${edgeMode}, 패딩 크기: ${padSize}`);
            }

            // Scale을 주파수(Hz)로 변환
            // 공식: f = (ω₀ / 2π) * (sampleRate / scale)
            const frequencies = scales.map(scale => centerFrequency * sampleRate / scale);

            // 주파수 검증
            const maxFreq = Math.max(...frequencies);
            const minFreq = Math.min(...frequencies);

            console.log(`[Wavelet Debug] 샘플링 레이트: ${sampleRate.toFixed(2)} Hz`);
            console.log(`[Wavelet Debug] 중심 각주파수 ω₀: ${omega0.toFixed(2)}`);
            console.log(`[Wavelet Debug] 나이퀴스트 주파수: ${nyquistFreq.toFixed(2)} Hz`);
            console.log(`[Wavelet Debug] 주파수 범위: ${minFreq.toFixed(4)} ~ ${maxFreq.toFixed(4)} Hz`);
            console.log(`[Wavelet Debug] 스케일 범위: ${scales[0]} ~ ${scales[scales.length - 1]}`);

            if (!filterNyquist && maxFreq > nyquistFreq) {
                console.warn(`[Wavelet Warning] 최대 주파수(${maxFreq.toFixed(2)} Hz)가 나이퀴스트 주파수(${nyquistFreq.toFixed(2)} Hz)를 초과합니다. 나이퀴스트 필터를 활성화하는 것을 권장합니다.`);
            }

            // 주파수 예시 출력 (처음 5개)
            console.log('[Wavelet Debug] 스케일-주파수 대응 (처음 5개):');
            for (let i = 0; i < Math.min(5, scales.length); i++) {
                console.log(`  스케일 ${scales[i]} → ${frequencies[i].toFixed(4)} Hz`);
            }

            // 샘플링 간격 (정규화용)
            const dt = 1.0 / sampleRate;

            const result = [];

            for (const scale of scales) {
                const coefficients = [];

                for (let t = 0; t < signal.length; t++) {
                    let coeffReal = 0;
                    let coeffImag = 0;

                    // Wavelet 적분 (컨볼루션)
                    const window = Math.floor(scale * 5 * sigma);  // sigma 고려
                    const tPadded = t + padLeft;  // 패딩된 인덱스

                    for (let n = Math.max(0, tPadded - window); n < Math.min(paddedSignal.length, tPadded + window); n++) {
                        const u = (n - tPadded) / scale;
                        const psi = this._morletWavelet(u, sigma, omega0);

                        // 샘플링 간격 정규화 포함
                        const normalization = dt / Math.sqrt(scale);

                        // 복소수 컨볼루션 (신호는 실수)
                        coeffReal += paddedSignal[n] * psi.real * normalization;
                        coeffImag += paddedSignal[n] * psi.imag * normalization;
                    }

                    // Magnitude 계산
                    const magnitude = Math.sqrt(coeffReal * coeffReal + coeffImag * coeffImag);
                    coefficients.push(magnitude);
                }

                result.push(coefficients);
            }

            return {
                coefficients: result,
                scales: scales,
                frequencies: frequencies,
                centerFrequency: centerFrequency,
                omega0: omega0,
                sampleRate: sampleRate,
                time: Array.from({length: signal.length}, (_, i) => i / sampleRate),
                waveletType: wavelet,
                edgeMode: edgeMode
            };
        } catch (error) {
            console.error('Wavelet 오류:', error);
            return null;
        }
    }

    /**
     * Hann Window 생성
     */
    static _hannWindow(size) {
        const window = [];
        for (let i = 0; i < size; i++) {
            window.push(0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
    }

    /**
     * Complex Morlet Wavelet
     * @param {number} u - 정규화된 시간 (n-t)/scale
     * @param {number} sigma - Gaussian 표준편차 (기본값: 1)
     * @param {number} omega0 - 중심 각주파수 (기본값: 5)
     * @returns {object} {real, imag} - 복소수 wavelet 값
     */
    static _morletWavelet(u, sigma = 1, omega0 = 5) {
        // Gaussian envelope
        const gaussian = Math.exp(-u * u / (2 * sigma * sigma));

        // 정규화 계수 (에너지 보존)
        const normalization = 1 / Math.sqrt(Math.sqrt(Math.PI) * sigma);

        // Complex exponential: e^(iω₀u) = cos(ω₀u) + i·sin(ω₀u)
        const real = normalization * gaussian * Math.cos(omega0 * u);
        const imag = normalization * gaussian * Math.sin(omega0 * u);

        return {real, imag};
    }

    /**
     * 간단한 IFFT (역 푸리에 변환)
     * 복소수 배열 입력 필요 [[real, imag], ...]
     * DFT를 사용하여 IFFT 계산 (O(n²) 복잡도)
     *
     * Hilbert Transform 등에서 정확한 정규화가 필요한 경우 사용
     */
    static _simpleIFFT(complexArray) {
        const n = complexArray.length;
        const result = [];

        for (let t = 0; t < n; t++) {
            let real = 0, imag = 0;

            for (let k = 0; k < n; k++) {
                // IFFT는 각도 부호가 양수 (FFT의 반대 부호)
                const angle = +2 * Math.PI * k * t / n;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // 복소수 곱셈: (a + bi) * (cos + i*sin)
                // real = a*cos - b*sin
                // imag = a*sin + b*cos
                real += (complexArray[k][0] * cos - complexArray[k][1] * sin);
                imag += (complexArray[k][0] * sin + complexArray[k][1] * cos);
            }

            // IFFT는 1/n으로 정규화
            result.push([real / n, imag / n]);
        }

        return result;
    }

    /**
     * Welch's Method (전력 스펙트럼 밀도)
     */
    static performWelch(signal, nperseg = 256, sampleRate = null) {
        if (!signal || signal.length < nperseg) {
            console.error('Welch: 신호가 너무 짧음');
            return null;
        }

        if (sampleRate === null) {
            console.error('Welch: 샘플링 레이트가 지정되지 않았습니다');
            return null;
        }

        const segments = [];
        const step = nperseg / 2;

        // 중첩된 세그먼트 생성
        for (let i = 0; i + nperseg <= signal.length; i += step) {
            const segment = signal.slice(i, i + nperseg);
            segments.push(segment);
        }

        // 각 세그먼트에 대해 FFT 계산
        let averagePsd = null;

        for (const segment of segments) {
            const fft = this.performFFT(segment, sampleRate);
            
            if (fft) {
                const magnitude = fft.magnitude.slice(0, fft.magnitude.length / 2);
                const psd = magnitude.map(m => (m * m) / segment.length);

                if (!averagePsd) {
                    averagePsd = psd;
                } else {
                    averagePsd = averagePsd.map((p, i) => p + psd[i]);
                }
            }
        }

        if (averagePsd) {
            averagePsd = averagePsd.map(p => p / segments.length);
        }

        return {
            psd: averagePsd,
            frequency: this.getFrequencies(nperseg, sampleRate),
            segments: segments.length
        };
    }

    /**
     * 신호 통계
     */
    static getStatistics(signal) {
        if (!signal || signal.length === 0) {
            return null;
        }

        const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
        const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
        const stdDev = Math.sqrt(variance);
        const min = Math.min(...signal);
        const max = Math.max(...signal);
        const rms = Math.sqrt(signal.reduce((sum, val) => sum + val * val, 0) / signal.length);
        const peak = Math.max(Math.abs(min), Math.abs(max));

        return {
            mean: parseFloat(mean.toFixed(4)),
            stdDev: parseFloat(stdDev.toFixed(4)),
            min: parseFloat(min.toFixed(4)),
            max: parseFloat(max.toFixed(4)),
            rms: parseFloat(rms.toFixed(4)),
            peak: parseFloat(peak.toFixed(4)),
            peakToPeak: parseFloat((max - min).toFixed(4))
        };
    }

    /**
     * DC 성분 제거 (평균값 빼기)
     * @param {Array<number>} signal - 입력 신호
     * @returns {Array<number>} DC 성분이 제거된 신호
     */
    static removeDC(signal) {
        if (!signal || signal.length === 0) {
            console.error('removeDC: 신호 데이터가 없습니다');
            return null;
        }

        const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
        return signal.map(x => x - mean);
    }

    /**
     * 선형 트렌드 제거
     * 최소제곱법을 사용하여 선형 트렌드를 제거
     * @param {Array<number>} signal - 입력 신호
     * @returns {Array<number>} 트렌드가 제거된 신호
     */
    static detrend(signal) {
        if (!signal || signal.length === 0) {
            console.error('detrend: 신호 데이터가 없습니다');
            return null;
        }

        const n = signal.length;
        const x = Array.from({length: n}, (_, i) => i);

        // 최소제곱법으로 기울기 계산
        const meanX = x.reduce((a, b) => a + b) / n;
        const meanY = signal.reduce((a, b) => a + b) / n;

        let numerator = 0, denominator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (x[i] - meanX) * (signal[i] - meanY);
            denominator += (x[i] - meanX) ** 2;
        }

        const slope = numerator / denominator;
        const intercept = meanY - slope * meanX;

        // 트렌드 제거
        return signal.map((y, i) => y - (slope * i + intercept));
    }

    /**
     * 윈도우 함수들
     */

    /**
     * Rectangular 윈도우 (윈도우 없음 - 기본값)
     * @param {number} size - 윈도우 크기
     * @returns {Array<number>} 모두 1인 배열
     */
    static windowRectangular(size) {
        return Array(size).fill(1);
    }

    /**
     * Hann 윈도우
     * w(n) = 0.5 * (1 - cos(2π*n / (N-1)))
     * 특징: 가장 일반적, 균형잡힌 스펙트럼 누수 감소
     * @param {number} size - 윈도우 크기
     * @returns {Array<number>} Hann 윈도우
     */
    static windowHann(size) {
        const window = [];
        for (let n = 0; n < size; n++) {
            window.push(0.5 * (1 - Math.cos(2 * Math.PI * n / (size - 1))));
        }
        return window;
    }

    /**
     * Hamming 윈도우
     * w(n) = 0.54 - 0.46 * cos(2π*n / (N-1))
     * 특징: Hann과 유사, 부엽(sidelobe) 약간 높음
     * @param {number} size - 윈도우 크기
     * @returns {Array<number>} Hamming 윈도우
     */
    static windowHamming(size) {
        const window = [];
        for (let n = 0; n < size; n++) {
            window.push(0.54 - 0.46 * Math.cos(2 * Math.PI * n / (size - 1)));
        }
        return window;
    }

    /**
     * Blackman 윈도우
     * w(n) = 0.42 - 0.5*cos(2π*n/(N-1)) + 0.08*cos(4π*n/(N-1))
     * 특징: 강한 스펙트럼 누수 감소, 메인로브 넓음
     * @param {number} size - 윈도우 크기
     * @returns {Array<number>} Blackman 윈도우
     */
    static windowBlackman(size) {
        const window = [];
        for (let n = 0; n < size; n++) {
            const a0 = 0.42;
            const a1 = 0.5;
            const a2 = 0.08;
            window.push(
                a0
                - a1 * Math.cos(2 * Math.PI * n / (size - 1))
                + a2 * Math.cos(4 * Math.PI * n / (size - 1))
            );
        }
        return window;
    }

    /**
     * Kaiser 윈도우 (조정 가능, 베셀 함수 사용)
     * w(n) = I₀(β * √(1 - (2n/(N-1) - 1)²)) / I₀(β)
     * 특징: β로 스펙트럼 누수와 해상도 조정 가능
     * @param {number} size - 윈도우 크기
     * @param {number} beta - Kaiser 파라미터 (기본 8.6)
     *                        낮을수록 누수 작음, 높을수록 넓은 메인로브
     * @returns {Array<number>} Kaiser 윈도우
     */
    static windowKaiser(size, beta = 8.6) {
        // Modified Bessel function I₀ (0차 1종 베셀 함수)
        const besselI0 = (x) => {
            if (x === 0) return 1;
            // Taylor series approximation
            let sum = 1;
            let term = 1;
            for (let k = 1; k <= 20; k++) {
                term *= (x / (2 * k)) * (x / (2 * k));
                sum += term;
                if (Math.abs(term) < 1e-15) break;
            }
            return sum;
        };

        const window = [];
        const denominator = besselI0(beta);

        for (let n = 0; n < size; n++) {
            const arg = 1 - Math.pow((2 * n) / (size - 1) - 1, 2);
            const numerator = besselI0(beta * Math.sqrt(Math.max(arg, 0)));
            window.push(numerator / denominator);
        }
        return window;
    }

    /**
     * 지정된 이름으로 윈도우 함수 선택
     * @param {string} windowType - 윈도우 타입: 'rectangular', 'hann', 'hamming', 'blackman', 'kaiser'
     * @param {number} size - 윈도우 크기
     * @param {number} param - 추가 파라미터 (Kaiser의 beta 등)
     * @returns {Array<number>} 윈도우 배열
     */
    static getWindow(windowType, size, param = null) {
        if (!windowType || windowType === 'rectangular') {
            return this.windowRectangular(size);
        }

        switch(windowType.toLowerCase()) {
            case 'hann':
                return this.windowHann(size);
            case 'hamming':
                return this.windowHamming(size);
            case 'blackman':
                return this.windowBlackman(size);
            case 'kaiser':
                return this.windowKaiser(size, param || 8.6);
            default:
                console.warn(`[Window] 알 수 없는 윈도우 타입: ${windowType}, Rectangular 사용`);
                return this.windowRectangular(size);
        }
    }

    /**
     * 윈도우 함수 정보 조회
     * @param {string} windowType - 윈도우 타입
     * @returns {object} 윈도우 특성 정보
     */
    static getWindowInfo(windowType) {
        const windowInfo = {
            'rectangular': {
                name: 'Rectangular (윈도우 없음)',
                description: '',
                mainLobeWidth: 4.0,
                sideLobeLevel: -13
            },
            'hann': {
                name: 'Hann',
                description: '',
                mainLobeWidth: 8.0,
                sideLobeLevel: -32
            },
            'hamming': {
                name: 'Hamming',
                description: '',
                mainLobeWidth: 8.0,
                sideLobeLevel: -43
            },
            'blackman': {
                name: 'Blackman',
                description: '',
                mainLobeWidth: 12.0,
                sideLobeLevel: -58
            },
            'kaiser': {
                name: 'Kaiser',
                description: '',
                mainLobeWidth: 9.0,
                sideLobeLevel: -50
            }
        };

        return windowInfo[windowType?.toLowerCase()] || {
            name: '알 수 없음',
            description: '',
            mainLobeWidth: 0,
            sideLobeLevel: 0
        };
    }
}

// 전역 signalProcessor 인스턴스
const signalProcessor = new SignalProcessor();
