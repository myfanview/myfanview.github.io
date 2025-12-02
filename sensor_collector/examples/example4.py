from sensor_collector import HardwareSensorCollector
import time
from datetime import datetime

def spindown_diagnosis():
    """스핀 다운 테스트로 베어링 상태 진단"""
    
    collector = HardwareSensorCollector(sample_interval_ms=50)  # 50ms 간격
    collector.start_collection()
    
    # 초기 데이터 축적
    time.sleep(2)
    
    print("[*] 팬 베어링 진단 시작...")
    print("[!] 테스트 중 컴퓨터를 사용하지 마세요\n")
    
    # 팬 이름 자동 감지
    latest = collector.get_latest_data()
    fans = [name.replace(' PWM', '') for name in latest.keys() 
            if name.endswith(' PWM')]
    
    if not fans:
        print("[!] 제어 가능한 팬이 없습니다")
        collector.cleanup()
        return
    
    for fan_name in fans:
        print(f"\n[=] {fan_name} 테스트 중...")
        
        # Step 1: 최대 속도로 3초 운전
        print(f"  Step 1: 최대 속도 운전 (3초)...")
        collector.set_fan_pwm(fan_name, 100)
        time.sleep(3)
        
        # Step 2: 전원 차단 및 정지 시간 측정
        print(f"  Step 2: 정지 시간 측정 중...")
        collector.set_fan_pwm(fan_name, 0)
        
        start_time = time.time()
        rpm_data = []
        
        # RPM이 0에 도달할 때까지 측정
        while True:
            timeseries = collector.get_timeseries(fan_name, last_n=1)
            
            if not timeseries:
                time.sleep(0.05)
                continue
            
            current_rpm = timeseries[0]['value']
            rpm_data.append(current_rpm)
            
            # 10 RPM 이하면 정지로 간주
            if current_rpm < 10:
                break
            
            # 타임아웃 (팬이 고장난 경우)
            if time.time() - start_time > 30:
                print(f"    [!] 타임아웃 (30초) - 팬이 응답하지 않음")
                break
            
            time.sleep(0.05)
        
        spindown_time = time.time() - start_time
        
        # Step 3: 진단 결과
        print(f"\n  [결과]")
        print(f"    정지 시간: {spindown_time:.2f}초")
        print(f"    수집된 샘플: {len(rpm_data)}개")
        
        # 정상 범위: 2.0~3.5초
        if spindown_time < 1.5:
            status = "⚠️ 경고: 베어링 심각 손상 - 즉시 교체 권장"
        elif spindown_time < 2.0:
            status = "⚠️ 주의: 베어링 마모 진행 중 - 1주일 내 교체 권장"
        elif 2.0 <= spindown_time <= 3.5:
            status = "✓ 정상: 베어링 상태 양호"
        else:
            status = "ℹ️ 정보: 정상보다 느림 - 먼지 축적 가능"
        
        print(f"    상태: {status}")
        
        # 팬 정상 속도로 복구
        collector.set_fan_pwm(fan_name, 50)
        time.sleep(1)
    
    # 정리
    collector.cleanup()
    print("\n[+] 진단 완료")

if __name__ == '__main__':
    spindown_diagnosis()