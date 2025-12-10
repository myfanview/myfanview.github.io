"""
테스트용 정현파 데이터 생성 스크립트

신호처리 기능 테스트를 위해 다음 3가지 유형의 정현파 데이터를 생성합니다:
1. 단일 정현파 (1Hz, 진폭 10)
2. 3개의 정현파 합성 (1Hz + 3Hz + 5Hz)
3. 3개의 정현파가 시계열로 이어진 형태 (1Hz → 2Hz → 0.5Hz)

생성 파일:
- test_data_sinusoid_1hz.json: FFT 테스트용
- test_data_sinusoid_combined.json: STFT 테스트용
- test_data_sinusoid_sequential.json: Wavelet 테스트용

사용법:
    python generate_sinusoid_test_data.py
"""

import json
import numpy as np
from datetime import datetime, timedelta


def generate_sinusoid_test_data():
    """테스트용 정현파 데이터 생성 및 JSON 파일로 저장"""

    # 샘플링 레이트: 100Hz (10ms 간격)
    sample_rate = 100  # Hz
    sample_interval_ms = 1000 / sample_rate  # 10ms

    print("=" * 60)
    print("테스트용 정현파 데이터 생성 시작")
    print("=" * 60)
    print(f"샘플링 레이트: {sample_rate}Hz ({sample_interval_ms}ms 간격)\n")

    # ============================================
    # 1. 단일 정현파 (1Hz, 진폭 10)
    # ============================================
    print("[1] 단일 정현파 (1Hz) 생성 중...")
    duration_1 = 10  # 10초
    t_1 = np.arange(0, duration_1, 1/sample_rate)
    signal_1 = 10 * np.sin(2 * np.pi * 1 * t_1)  # 1Hz, 진폭 10

    data_1 = []
    base_time = datetime.now()
    for i, value in enumerate(signal_1):
        timestamp = base_time + timedelta(milliseconds=i*sample_interval_ms)
        data_1.append({
            "timestamp": timestamp.isoformat(),
            "value": float(value),
            "type": "Test Signal"
        })

    # ============================================
    # 2. 3개의 정현파 합성 (1Hz + 3Hz + 5Hz)
    # ============================================
    print("[2] 3개의 정현파 합성 (1Hz + 3Hz + 5Hz) 생성 중...")
    duration_2 = 10  # 10초
    t_2 = np.arange(0, duration_2, 1/sample_rate)
    signal_2 = (
        10 * np.sin(2 * np.pi * 1 * t_2) +      # 1Hz, 진폭 10
        5 * np.sin(2 * np.pi * 3 * t_2) +       # 3Hz, 진폭 5
        3 * np.sin(2 * np.pi * 5 * t_2)         # 5Hz, 진폭 3
    )

    data_2 = []
    base_time = datetime.now() + timedelta(seconds=duration_1 + 5)
    for i, value in enumerate(signal_2):
        timestamp = base_time + timedelta(milliseconds=i*sample_interval_ms)
        data_2.append({
            "timestamp": timestamp.isoformat(),
            "value": float(value),
            "type": "Test Signal"
        })

    # ============================================
    # 3. 3개의 정현파가 시계열로 이어진 형태
    # ============================================
    print("[3] 시계열 정현파 (1Hz → 2Hz → 0.5Hz) 생성 중...")
    duration_per_signal = 5  # 각 신호 5초씩
    segment_1_t = np.arange(0, duration_per_signal, 1/sample_rate)
    segment_2_t = np.arange(0, duration_per_signal, 1/sample_rate)
    segment_3_t = np.arange(0, duration_per_signal, 1/sample_rate)

    # 세그먼트 1: 1Hz
    segment_1 = 8 * np.sin(2 * np.pi * 1 * segment_1_t)
    # 세그먼트 2: 2Hz
    segment_2 = 8 * np.sin(2 * np.pi * 2 * segment_2_t)
    # 세그먼트 3: 0.5Hz
    segment_3 = 8 * np.sin(2 * np.pi * 0.5 * segment_3_t)

    signal_3 = np.concatenate([segment_1, segment_2, segment_3])

    data_3 = []
    base_time = datetime.now() + timedelta(seconds=duration_1 + duration_2 + 10)
    for i, value in enumerate(signal_3):
        timestamp = base_time + timedelta(milliseconds=i*sample_interval_ms)
        data_3.append({
            "timestamp": timestamp.isoformat(),
            "value": float(value),
            "type": "Test Signal"
        })

    # ============================================
    # JSON 파일로 저장
    # ============================================

    # 테스트 1: 단일 정현파
    test_data_1 = {
        "metadata": {
            "name": "Single Sinusoid (1Hz)",
            "sampleRate": sample_rate,
            "sampleIntervalMs": sample_interval_ms,
            "duration": len(signal_1) / sample_rate,
            "timestamp": datetime.now().isoformat(),
            "description": "Single sinusoidal signal at 1Hz with amplitude 10. Use this for FFT testing."
        },
        "sensors": {
            "Test_Sinusoid_1Hz": data_1
        }
    }

    output_file_1 = "test_data_sinusoid_1hz.json"
    with open(output_file_1, 'w') as f:
        json.dump(test_data_1, f, indent=2)
    print(f"   ✓ {output_file_1} 생성됨")

    # 테스트 2: 3개의 정현파 합성
    test_data_2 = {
        "metadata": {
            "name": "Combined Sinusoids (1Hz + 3Hz + 5Hz)",
            "sampleRate": sample_rate,
            "sampleIntervalMs": sample_interval_ms,
            "duration": len(signal_2) / sample_rate,
            "timestamp": datetime.now().isoformat(),
            "description": "Composite signal: 10×sin(2π×1×t) + 5×sin(2π×3×t) + 3×sin(2π×5×t). Use this for STFT testing.",
            "components": [
                {"frequency": 1, "amplitude": 10},
                {"frequency": 3, "amplitude": 5},
                {"frequency": 5, "amplitude": 3}
            ]
        },
        "sensors": {
            "Test_Sinusoid_Combined": data_2
        }
    }

    output_file_2 = "test_data_sinusoid_combined.json"
    with open(output_file_2, 'w') as f:
        json.dump(test_data_2, f, indent=2)
    print(f"   ✓ {output_file_2} 생성됨")

    # 테스트 3: 시계열로 이어진 정현파
    test_data_3 = {
        "metadata": {
            "name": "Sequential Sinusoids (1Hz → 2Hz → 0.5Hz)",
            "sampleRate": sample_rate,
            "sampleIntervalMs": sample_interval_ms,
            "duration": len(signal_3) / sample_rate,
            "timestamp": datetime.now().isoformat(),
            "description": "Three sinusoid segments in sequence: 5s@1Hz, 5s@2Hz, 5s@0.5Hz. Use this for Wavelet testing.",
            "segments": [
                {
                    "name": "Segment 1",
                    "frequency": 1,
                    "amplitude": 8,
                    "duration": duration_per_signal,
                    "startTime": 0
                },
                {
                    "name": "Segment 2",
                    "frequency": 2,
                    "amplitude": 8,
                    "duration": duration_per_signal,
                    "startTime": duration_per_signal
                },
                {
                    "name": "Segment 3",
                    "frequency": 0.5,
                    "amplitude": 8,
                    "duration": duration_per_signal,
                    "startTime": duration_per_signal * 2
                }
            ]
        },
        "sensors": {
            "Test_Sinusoid_Sequential": data_3
        }
    }

    output_file_3 = "test_data_sinusoid_sequential.json"
    with open(output_file_3, 'w') as f:
        json.dump(test_data_3, f, indent=2)
    print(f"   ✓ {output_file_3} 생성됨\n")

    # ============================================
    # 통계 정보 출력
    # ============================================
    print("=" * 60)
    print("📊 생성된 테스트 데이터 통계")
    print("=" * 60)

    print(f"\n[1] 단일 정현파 (1Hz)")
    print(f"    샘플 개수: {len(signal_1)}")
    print(f"    지속 시간: {len(signal_1)/sample_rate:.1f}초")
    print(f"    값 범위: [{signal_1.min():.2f}, {signal_1.max():.2f}]")
    print(f"    평균: {signal_1.mean():.6f}")
    print(f"    표준편차: {signal_1.std():.6f}")
    print(f"    ▶ 테스트: FFT 실행 → 1Hz에서 피크 확인")

    print(f"\n[2] 3개의 정현파 합성 (1Hz + 3Hz + 5Hz)")
    print(f"    샘플 개수: {len(signal_2)}")
    print(f"    지속 시간: {len(signal_2)/sample_rate:.1f}초")
    print(f"    값 범위: [{signal_2.min():.2f}, {signal_2.max():.2f}]")
    print(f"    평균: {signal_2.mean():.6f}")
    print(f"    표준편차: {signal_2.std():.6f}")
    print(f"    성분:")
    print(f"      - 1Hz (진폭 10)")
    print(f"      - 3Hz (진폭 5)")
    print(f"      - 5Hz (진폭 3)")
    print(f"    ▶ 테스트: STFT 실행 → 1Hz, 3Hz, 5Hz 세 개의 주파수 성분 확인")

    print(f"\n[3] 시계열 정현파 (1Hz → 2Hz → 0.5Hz)")
    print(f"    샘플 개수: {len(signal_3)}")
    print(f"    지속 시간: {len(signal_3)/sample_rate:.1f}초 ({duration_per_signal}s × 3)")
    print(f"    값 범위: [{signal_3.min():.2f}, {signal_3.max():.2f}]")
    print(f"    평균: {signal_3.mean():.6f}")
    print(f"    표준편차: {signal_3.std():.6f}")
    print(f"    세그먼트:")
    print(f"      - 0~{duration_per_signal}초: 1Hz (진폭 8)")
    print(f"      - {duration_per_signal}~{duration_per_signal*2}초: 2Hz (진폭 8)")
    print(f"      - {duration_per_signal*2}~{duration_per_signal*3}초: 0.5Hz (진폭 8)")
    print(f"    ▶ 테스트: Wavelet 실행 → 시간에 따라 변하는 주파수 성분 확인")

    print("\n" + "=" * 60)
    print("✅ 모든 테스트 데이터 생성 완료!")
    print("=" * 60)
    print("\n사용 방법:")
    print("1. 대시보드에서 '파일 업로드' (Ctrl+O) 또는 '데이터 로드' 사용")
    print("2. 생성된 JSON 파일 중 하나 선택")
    print("3. 센서 체크박스에서 'Test_Sinusoid_xxx' 선택")
    print("4. 그래프 영역에서 신호처리 영역 선택 후 원하는 기능 실행\n")

    return test_data_1, test_data_2, test_data_3


if __name__ == "__main__":
    generate_sinusoid_test_data()
