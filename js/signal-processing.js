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
                imaginary: imaginary
            };
        } catch (error) {
            console.error('FFT 오류:', error);
            return null;
        }
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
     * ml-dsp의 FFT 사용
     */
    static performSTFT(signal, windowSize = 256, hopSize = 128, sampleRate = null) {
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

        // Hann 윈도우 생성
        const window = this._hannWindow(windowSize);

        for (let start = 0; start + windowSize <= signal.length; start += hopSize) {
            // 신호 절편 추출
            const segment = signal.slice(start, start + windowSize);

            // 윈도우 적용
            const windowed = segment.map((x, i) => x * window[i]);

            // 필요시 zero-padding
            while (windowed.length < 512) {
                windowed.push(0);
            }

            // FFT 수행 (sampleRate 전달)
            const fft = this.performFFT(windowed, sampleRate);

            if (fft) {
                // 양수 주파수만 추출
                const magnitude = fft.magnitude.slice(0, fft.magnitude.length / 2);

                // dB 스케일
                const magnitudeDb = magnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));

                result.push(magnitudeDb);
                times.push(start / sampleRate); // 타임 스탬프 (실제 샘플링 레이트 사용)
            }
        }

        return {
            spectrogram: result,
            times: times,
            windowSize: windowSize,
            hopSize: hopSize
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
     * 간단한 Continuous Wavelet Transform (CWT)
     * Morlet Wavelet 사용
     */
    static performWavelet(signal, scales = null, wavelet = 'morlet', sampleRate = null) {
        if (!signal || signal.length === 0) {
            console.error('Wavelet: 신호 데이터가 없습니다');
            return null;
        }

        if (sampleRate === null) {
            console.error('Wavelet: 샘플링 레이트가 지정되지 않았습니다');
            return null;
        }

        try {
            // 기본 스케일 범위
            if (!scales) {
                scales = [];
                for (let s = 1; s <= 64; s *= 1.2) {
                    scales.push(Math.floor(s));
                }
                scales = [...new Set(scales)].sort((a, b) => a - b);
            }

            // Morlet wavelet 중심 주파수 (정규화된 주파수)
            const centerFrequency = 1.0;

            // Scale을 주파수(Hz)로 변환
            // 공식: f = (centerFrequency * sampleRate) / (2 * π * scale)
            const frequencies = scales.map(scale => (centerFrequency * sampleRate) / (2 * Math.PI * scale));

            // 주파수 검증: 나이퀴스트 주파수 이하인지 확인
            const nyquistFreq = sampleRate / 2;
            const maxFreq = Math.max(...frequencies);
            const minFreq = Math.min(...frequencies);

            console.log(`[Wavelet Debug] 샘플링 레이트: ${sampleRate.toFixed(2)} Hz`);
            console.log(`[Wavelet Debug] 나이퀴스트 주파수: ${nyquistFreq.toFixed(2)} Hz`);
            console.log(`[Wavelet Debug] 주파수 범위: ${minFreq.toFixed(4)} ~ ${maxFreq.toFixed(4)} Hz`);
            console.log(`[Wavelet Debug] 스케일 범위: ${scales[0]} ~ ${scales[scales.length - 1]}`);

            if (maxFreq > nyquistFreq) {
                console.warn(`[Wavelet Warning] 최대 주파수(${maxFreq.toFixed(2)} Hz)가 나이퀴스트 주파수(${nyquistFreq.toFixed(2)} Hz)를 초과합니다.`);
                console.warn(`[Wavelet Warning] 앨리어싱(aliasing)이 발생할 수 있습니다.`);
            }

            // 주파수 예시 출력 (처음 5개)
            console.log('[Wavelet Debug] 스케일-주파수 대응 (처음 5개):');
            for (let i = 0; i < Math.min(5, scales.length); i++) {
                console.log(`  스케일 ${scales[i]} → ${frequencies[i].toFixed(4)} Hz`);
            }

            const result = [];

            for (const scale of scales) {
                const coefficients = [];

                for (let t = 0; t < signal.length; t++) {
                    let coeff = 0;

                    // Wavelet 적분
                    const window = Math.floor(scale * 5);
                    for (let n = Math.max(0, t - window); n < Math.min(signal.length, t + window); n++) {
                        const u = (n - t) / scale;
                        const psi = this._morletWavelet(u);
                        coeff += signal[n] * psi / Math.sqrt(scale);
                    }

                    coefficients.push(Math.abs(coeff));
                }

                result.push(coefficients);
            }

            return {
                coefficients: result,
                scales: scales,
                frequencies: frequencies,
                centerFrequency: centerFrequency,
                sampleRate: sampleRate,
                time: Array.from({length: signal.length}, (_, i) => i),
                waveletType: wavelet
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
     * Morlet Wavelet
     */
    static _morletWavelet(u, sigma = 1) {
        const realPart = Math.exp(-u * u / (2 * sigma * sigma)) * Math.cos(5 * u);
        return realPart;
    }

    /**
     * 간단한 IFFT (역 푸리에 변환)
     * 복소수 배열 입력 필요 [[real, imag], ...]
     * DFT를 사용하여 IFFT 계산 (O(n²) 복잡도)
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
}

// 전역 signalProcessor 인스턴스
const signalProcessor = new SignalProcessor();
