import json
import numpy as np
from scipy.fft import fft
import matplotlib.pyplot as plt

def signal_processing_example():
    """FFT를 사용한 스펙트럼 분석"""
    
    # JSON 로드
    with open('sensor_data.json', 'r') as f:
        data = json.load(f)
    
    # CPU 팬 RPM 데이터 추출
    rpm_data = data['sensors']['Motherboard_CPU FAN']
    rpm_values = [record['value'] for record in rpm_data]
    sample_interval = data['sample_interval_ms'] / 1000.0  # 초 단위
    sample_rate = 1 / sample_interval  # Hz
    
    print(f"[*] 신호 처리 중...")
    print(f"    샘플 수: {len(rpm_values)}")
    print(f"    샘플링 레이트: {sample_rate:.1f} Hz")
    print(f"    지속 시간: {len(rpm_values) * sample_interval:.1f}초\n")
    
    # FFT 수행
    fft_result = fft(rpm_values)
    fft_magnitude = np.abs(fft_result)
    
    # 주파수 축 계산
    frequencies = np.fft.fftfreq(len(rpm_values), sample_interval)
    
    # 양수 주파수만 선택
    pos_mask = frequencies > 0
    frequencies = frequencies[pos_mask]
    fft_magnitude = fft_magnitude[pos_mask]
    
    # dB 스케일로 변환
    fft_db = 20 * np.log10(fft_magnitude + 1e-10)
    
    # 피크 주파수 찾기
    peak_idx = np.argmax(fft_magnitude)
    peak_freq = frequencies[peak_idx]
    peak_magnitude = fft_magnitude[peak_idx]
    
    print(f"[=] FFT 분석 결과:")
    print(f"    피크 주파수: {peak_freq:.2f} Hz")
    print(f"    피크 크기: {peak_magnitude:.2f}")
    print(f"    피크 크기 (dB): {fft_db[peak_idx]:.2f} dB")
    
    # 상위 5개 주파수 성분
    top_5_idx = np.argsort(fft_magnitude)[-5:][::-1]
    print(f"\n[=] 상위 5개 주파수 성분:")
    for i, idx in enumerate(top_5_idx, 1):
        print(f"    {i}. {frequencies[idx]:.2f} Hz (크기: {fft_magnitude[idx]:.2f})")
    
    # 그래프
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 6))
    
    # 시계열 데이터
    time_axis = np.arange(len(rpm_values)) * sample_interval
    ax1.plot(time_axis, rpm_values, label='RPM Signal', color='blue')
    ax1.set_xlabel('Time (s)')
    ax1.set_ylabel('RPM')
    ax1.set_title('CPU Fan Speed - Time Domain')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    
    # FFT 스펙트럼 (0~50 Hz)
    freq_limit = 50
    limit_mask = frequencies <= freq_limit
    ax2.semilogy(frequencies[limit_mask], fft_magnitude[limit_mask], color='red')
    ax2.set_xlabel('Frequency (Hz)')
    ax2.set_ylabel('Magnitude')
    ax2.set_title('FFT Spectrum (0-50 Hz)')
    ax2.grid(True, alpha=0.3, which='both')
    
    plt.tight_layout()
    plt.savefig('fft_analysis.png', dpi=100)
    print(f"\n[+] 그래프 저장: fft_analysis.png")
    plt.show()

if __name__ == '__main__':
    signal_processing_example()