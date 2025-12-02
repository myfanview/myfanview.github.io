from sensor_collector import HardwareSensorCollector
import time

def auto_fan_control():
    """CPU 온도에 따라 팬 속도 자동 조절"""
    
    collector = HardwareSensorCollector(sample_interval_ms=100)
    collector.start_collection()
    
    # 초기 데이터 축적
    time.sleep(2)
    
    # 팬 제어 곡선 정의
    temp_curve = {
        40: 30,   # 40°C → 30% PWM
        50: 50,   # 50°C → 50% PWM
        60: 70,   # 60°C → 70% PWM
        70: 90,   # 70°C → 90% PWM
        80: 100,  # 80°C 이상 → 100% PWM
    }
    
    print("[*] 자동 팬 제어 시작...")
    print("[!] Ctrl+C로 종료\n")
    
    try:
        while True:
            latest = collector.get_latest_data()
            
            # CPU 온도 찾기
            cpu_temp = None
            for sensor_name, data in latest.items():
                if 'CPU Package' in sensor_name and data['type'] == 'Temperature':
                    cpu_temp = data['value']
                    break
            
            if cpu_temp is None:
                print("[!] CPU 온도를 찾을 수 없습니다")
                time.sleep(1)
                continue
            
            # 온도에 따른 PWM 계산
            pwm = 30  # 최소값
            for temp_threshold in sorted(temp_curve.keys()):
                if cpu_temp >= temp_threshold:
                    pwm = temp_curve[temp_threshold]
            
            # 현재 상태 표시
            print(f"[{time.strftime('%H:%M:%S')}] CPU: {cpu_temp:.1f}°C → PWM: {pwm}%", end='\r')
            
            # 팬 속도 조절
            collector.set_fan_pwm("CPU FAN", pwm)
            
            # 10초마다 갱신
            time.sleep(10)
    
    except KeyboardInterrupt:
        print("\n[!] 종료 중...")
        collector.cleanup()
        print("[+] 팬 제어 종료")

if __name__ == '__main__':
    auto_fan_control()