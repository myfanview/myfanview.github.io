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
     * 해석적 신호(Analytic Signal) 생성
     * ml-dsp의 FFT 사용
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
            // 신호 길이를 2의 거듭제곱으로 확장 (FFT 효율성)
            const n = signal.length;
            const n_fft = Math.pow(2, Math.ceil(Math.log2(2 * n)));

            // Zero-padding
            const paddedSignal = [...signal];
            while (paddedSignal.length < n_fft) {
                paddedSignal.push(0);
            }

            // FFT (sampleRate 전달)
            const fft = this.performFFT(paddedSignal, sampleRate);
            
            if (!fft) return null;

            // Hilbert 필터 적용
            const magnitudeResponse = new Array(fft.magnitude.length);
            magnitudeResponse[0] = 1;
            
            for (let i = 1; i < magnitudeResponse.length; i++) {
                if (i < fft.magnitude.length / 2) {
                    magnitudeResponse[i] = 2;
                } else if (i === fft.magnitude.length / 2) {
                    magnitudeResponse[i] = 1;
                } else {
                    magnitudeResponse[i] = 0;
                }
            }

            // 필터링된 스펙트럼
            const hilbertFft = fft.real.map((r, i) => [
                r * magnitudeResponse[i],
                fft.imaginary[i] * magnitudeResponse[i]
            ]);

            // IFFT로 해석적 신호 복원
            const analyticSignal = this._ifft(hilbertFft);

            // 포락선 계산 (크기)
            const envelope = analyticSignal.slice(0, n).map(c => 
                Math.sqrt(c[0] * c[0] + c[1] * c[1])
            );

            return {
                envelope: envelope,
                analyticSignal: analyticSignal.slice(0, n)
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
     * 복소수 배열 입력 필요
     */
    static _ifft(fftData) {
        // 간단한 구현 (정확도보다는 작동 중심)
        const n = fftData.length;
        const result = [];

        for (let t = 0; t < n; t++) {
            let real = 0, imag = 0;

            for (let k = 0; k < n; k++) {
                const angle = 2 * Math.PI * k * t / n;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                real += (fftData[k][0] * cos + fftData[k][1] * sin);
                imag += (fftData[k][1] * cos - fftData[k][0] * sin);
            }

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
