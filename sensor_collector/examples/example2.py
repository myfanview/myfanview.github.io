from sensor_collector import HardwareSensorCollector
import time
import json

def automated_collection():
    """5분 동안 데이터 수집 후 저장"""
    
    # 100ms 간격으로 수집기 초기화
    collector = HardwareSensorCollector(sample_interval_ms=100)
    
    print("[*] 데이터 수집 시작...")
    collector.start_collection()
    
    # 5분 수집 (300초)
    try:
        time.sleep(300)
    except KeyboardInterrupt:
        print("\n[!] 사용자 중단")
    
    # 데이터 저장
    json_file = collector.export_to_json('5min_data.json')
    csv_file = collector.export_to_csv('5min_data.csv')
    
    print(f"[+] 데이터 저장 완료:")
    print(f"    - JSON: {json_file}")
    print(f"    - CSV: {csv_file}")
    
    # 정리
    collector.cleanup()

if __name__ == '__main__':
    automated_collection()

# 실행:
# python examples/example_automated.py