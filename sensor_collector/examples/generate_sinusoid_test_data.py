"""
테스트용 Fan RPM 데이터 생성 스크립트

신호처리 기능 테스트를 위해 다음 3가지 유형의 Fan RPM 데이터를 생성합니다:
1. 안정적인 저주파 진동 (1Hz, RPM 진폭 ±500)
2. 복합 주파수 성분 (1Hz + 3Hz + 7Hz 포함)
3. 시간에 따라 변하는 RPM (2Hz → 4Hz → 8Hz)

생성 파일:
- test_data_fan_rpm_stable.json: FFT 테스트용 (안정적 저주파)
- test_data_fan_rpm_complex.json: STFT 테스트용 (복합 주파수)
- test_data_fan_rpm_variable.json: Wavelet 테스트용 (시간 변화)

사용법:
    python generate_sinusoid_test_data.py
"""

import json
import numpy as np
from datetime import datetime, timedelta


def generate_sinusoid_test_data():
    """테스트용 Fan RPM 데이터 생성 및 JSON 파일로 저장"""

    # 샘플링 레이트: 100Hz (10ms 간격)
    sample_rate = 100  # Hz
    sample_interval_ms = 1000 / sample_rate  # 10ms

    # Fan RPM 기본값: 2000 RPM (중간값)
    base_rpm = 2000

    print("=" * 60)
    print("테스트용 Fan RPM 데이터 생성 시작")
    print("=" * 60)
    print(f"샘플링 레이트: {sample_rate}Hz ({sample_interval_ms}ms 간격)")
    print(f"기본 RPM: {base_rpm}\n")

    # ============================================
    # 1. 안정적 저주파 진동 (1Hz, ±500 RPM)
    # ============================================
    print("[1] 안정적 저주파 진동 (1Hz, ±500 RPM) 생성 중...")
    duration_1 = 10  # 10초
    t_1 = np.arange(0, duration_1, 1/sample_rate)
    signal_1 = base_rpm + 500 * np.sin(2 * np.pi * 1 * t_1)  # 기본값 + 진폭 500

    data_1 = []
    base_time = datetime.now()
    for i, value in enumerate(signal_1):
        timestamp = base_time + timedelta(milliseconds=i*sample_interval_ms)
        data_1.append({
            "timestamp": timestamp.isoformat(),
            "value": float(value),
            "type": "Fan"
        })

    # ============================================
    # 2. 복합 주파수 성분 (1Hz + 3Hz + 7Hz)
    # ============================================
    print("[2] 복합 주파수 성분 (1Hz + 3Hz + 7Hz) 생성 중...")
    duration_2 = 10  # 10초
    t_2 = np.arange(0, duration_2, 1/sample_rate)
    signal_2 = base_rpm + (
        500 * np.sin(2 * np.pi * 1 * t_2) +    # 1Hz, 진폭 500
        250 * np.sin(2 * np.pi * 3 * t_2) +    # 3Hz, 진폭 250
        150 * np.sin(2 * np.pi * 7 * t_2)      # 7Hz, 진폭 150
    )

    data_2 = []
    base_time = datetime.now() + timedelta(seconds=duration_1 + 5)
    for i, value in enumerate(signal_2):
        timestamp = base_time + timedelta(milliseconds=i*sample_interval_ms)
        data_2.append({
            "timestamp": timestamp.isoformat(),
            "value": float(value),
            "type": "Fan"
        })

    # ============================================
    # 3. 시간에 따라 변하는 RPM (2Hz → 4Hz → 8Hz)
    # ============================================
    print("[3] 시간 변화 RPM (2Hz → 4Hz → 8Hz) 생성 중...")
    duration_per_signal = 5  # 각 신호 5초씩
    segment_1_t = np.arange(0, duration_per_signal, 1/sample_rate)
    segment_2_t = np.arange(0, duration_per_signal, 1/sample_rate)
    segment_3_t = np.arange(0, duration_per_signal, 1/sample_rate)

    # 세그먼트 1: 2Hz, 1500 RPM 기준
    segment_1 = 1500 + 400 * np.sin(2 * np.pi * 2 * segment_1_t)
    # 세그먼트 2: 4Hz, 2500 RPM 기준
    segment_2 = 2500 + 400 * np.sin(2 * np.pi * 4 * segment_2_t)
    # 세그먼트 3: 8Hz, 1800 RPM 기준
    segment_3 = 1800 + 400 * np.sin(2 * np.pi * 8 * segment_3_t)

    signal_3 = np.concatenate([segment_1, segment_2, segment_3])

    data_3 = []
    base_time = datetime.now() + timedelta(seconds=duration_1 + duration_2 + 10)
    for i, value in enumerate(signal_3):
        timestamp = base_time + timedelta(milliseconds=i*sample_interval_ms)
        data_3.append({
            "timestamp": timestamp.isoformat(),
            "value": float(value),
            "type": "Fan"
        })

    # ============================================
    # JSON 파일로 저장
    # ============================================

    # 테스트 1: 안정적 저주파 진동
    test_data_1 = {
        "timestamp": datetime.now().isoformat(),
        "sample_interval_ms": sample_interval_ms,
        "metadata": {
            "name": "Fan RPM - Stable Low Frequency (1Hz)",
            "sampleRate": sample_rate,
            "duration": len(signal_1) / sample_rate,
            "description": "Stable fan RPM with low frequency vibration (1Hz, ±500 RPM). Base RPM 2000. Use this for FFT testing.",
            "baseRPM": base_rpm,
            "frequency": 1,
            "amplitude": 500
        },
        "sensors": {
            "ITE IT8689E_CPU Fan": data_1
        }
    }

    output_file_1 = "test_data_fan_rpm_stable.json"
    with open(output_file_1, 'w') as f:
        json.dump(test_data_1, f, indent=2)
    print(f"   ✓ {output_file_1} 생성됨")

    # 테스트 2: 복합 주파수 성분
    test_data_2 = {
        "timestamp": datetime.now().isoformat(),
        "sample_interval_ms": sample_interval_ms,
        "metadata": {
            "name": "Fan RPM - Complex Frequencies (1Hz + 3Hz + 5Hz)",
            "sampleRate": sample_rate,
            "duration": len(signal_2) / sample_rate,
            "description": "Fan RPM with multiple frequency components. Base RPM 2000. Use this for STFT testing.",
            "baseRPM": base_rpm,
            "components": [
                {"frequency": 1, "amplitude": 500},
                {"frequency": 3, "amplitude": 250},
                {"frequency": 7, "amplitude": 150}
            ]
        },
        "sensors": {
            "ITE IT8689E_CPU Fan": data_2
        }
    }

    output_file_2 = "test_data_fan_rpm_complex.json"
    with open(output_file_2, 'w') as f:
        json.dump(test_data_2, f, indent=2)
    print(f"   ✓ {output_file_2} 생성됨")

    # 테스트 3: 시간에 따라 변하는 RPM
    test_data_3 = {
        "timestamp": datetime.now().isoformat(),
        "sample_interval_ms": sample_interval_ms,
        "metadata": {
            "name": "Fan RPM - Variable Speed (1Hz → 2Hz → 0.5Hz)",
            "sampleRate": sample_rate,
            "duration": len(signal_3) / sample_rate,
            "description": "Fan RPM with changing frequency over time. Use this for Wavelet testing.",
            "segments": [
                {
                    "name": "Low Speed (1Hz)",
                    "baseRPM": 1500,
                    "frequency": 2,
                    "amplitude": 400,
                    "duration": duration_per_signal,
                    "startTime": 0
                },
                {
                    "name": "High Speed (2Hz)",
                    "baseRPM": 2500,
                    "frequency": 4,
                    "amplitude": 400,
                    "duration": duration_per_signal,
                    "startTime": duration_per_signal
                },
                {
                    "name": "Medium Speed (0.5Hz)",
                    "baseRPM": 1800,
                    "frequency": 8,
                    "amplitude": 400,
                    "duration": duration_per_signal,
                    "startTime": duration_per_signal * 2
                }
            ]
        },
        "sensors": {
            "ITE IT8689E_CPU Fan": data_3
        }
    }

    output_file_3 = "test_data_fan_rpm_variable.json"
    with open(output_file_3, 'w') as f:
        json.dump(test_data_3, f, indent=2)
    print(f"   ✓ {output_file_3} 생성됨\n")

    # ============================================
    # 통계 정보 출력
    # ============================================
    print("=" * 60)
    print("📊 생성된 테스트 데이터 통계")
    print("=" * 60)

    print(f"\n[1] 안정적 저주파 진동 (1Hz, ±500 RPM)")
    print(f"    샘플 개수: {len(signal_1)}")
    print(f"    지속 시간: {len(signal_1)/sample_rate:.1f}초")
    print(f"    값 범위: [{signal_1.min():.2f}, {signal_1.max():.2f}] RPM")
    print(f"    평균: {signal_1.mean():.2f} RPM")
    print(f"    표준편차: {signal_1.std():.2f} RPM")
    print(f"    ▶ 테스트: FFT 실행 → 1Hz에서 피크 확인")

    print(f"\n[2] 복합 주파수 성분 (1Hz + 3Hz + 7Hz)")
    print(f"    샘플 개수: {len(signal_2)}")
    print(f"    지속 시간: {len(signal_2)/sample_rate:.1f}초")
    print(f"    값 범위: [{signal_2.min():.2f}, {signal_2.max():.2f}] RPM")
    print(f"    평균: {signal_2.mean():.2f} RPM")
    print(f"    표준편차: {signal_2.std():.2f} RPM")
    print(f"    주파수 성분:")
    print(f"      - 1Hz (진폭 500 RPM)")
    print(f"      - 3Hz (진폭 250 RPM)")
    print(f"      - 7Hz (진폭 150 RPM)")
    print(f"    ▶ 테스트: STFT 실행 → 1Hz, 3Hz, 7Hz 세 개의 주파수 성분 확인")

    print(f"\n[3] 가변 속도 RPM (2Hz → 4Hz → 8Hz)")
    print(f"    샘플 개수: {len(signal_3)}")
    print(f"    지속 시간: {len(signal_3)/sample_rate:.1f}초 ({duration_per_signal}s × 3)")
    print(f"    값 범위: [{signal_3.min():.2f}, {signal_3.max():.2f}] RPM")
    print(f"    평균: {signal_3.mean():.2f} RPM")
    print(f"    표준편차: {signal_3.std():.2f} RPM")
    print(f"    세그먼트:")
    print(f"      - 0~{duration_per_signal}초: 저속 (1500 RPM ±400, 1Hz)")
    print(f"      - {duration_per_signal}~{duration_per_signal*2}초: 고속 (2500 RPM ±400, 2Hz)")
    print(f"      - {duration_per_signal*2}~{duration_per_signal*3}초: 중속 (1800 RPM ±400, 0.5Hz)")
    print(f"    ▶ 테스트: Wavelet 실행 → 시간에 따라 변하는 주파수 성분 확인")

    print("\n" + "=" * 60)
    print("✅ 모든 테스트 데이터 생성 완료!")
    print("=" * 60)
    print("\n사용 방법:")
    print("1. 대시보드에서 '파일 업로드' (Ctrl+O) 또는 '데이터 로드' 사용")
    print("2. 생성된 JSON 파일 중 하나 선택")
    print("3. 센서 체크박스에서 'ITE IT8689E_CPU Fan' (Fan 타입) 선택")
    print("4. 그래프 영역에서 신호처리 영역 선택 후 원하는 기능 실행\n")

    return test_data_1, test_data_2, test_data_3


if __name__ == "__main__":
    generate_sinusoid_test_data()
