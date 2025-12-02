"""
Windows 환경: LibreHardwareMonitor DLL을 사용한 고속 센서 데이터 수집 프로그램
- 10ms~100ms 간격으로 팬 RPM, 온도, PWM 데이터 수집
- 실시간 팬 제어 가능
- JSON/CSV 포맷으로 자동 저장
"""

import clr
import sys
import os
import time
import json
import csv
import threading
import argparse
from datetime import datetime
from collections import deque
from typing import Dict, List, Optional

# LibreHardwareMonitor DLL 로드
try:
    dll_path = os.path.join(os.path.dirname(__file__), 'LibreHardwareMonitorLib.dll')
    if not os.path.exists(dll_path):
        print("[ERROR] LibreHardwareMonitorLib.dll을 찾을 수 없습니다.")
        print("다운로드: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases")
        sys.exit(1)
    
    clr.AddReference(dll_path)
except Exception as e:
    print(f"[ERROR] DLL 로드 실패: {e}")
    sys.exit(1)

from LibreHardwareMonitor.Hardware import Computer, HardwareType, SensorType


class HardwareSensorCollector:
    """LibreHardwareMonitor DLL을 이용한 실시간 센서 데이터 수집기"""
    
    def __init__(self, sample_interval_ms: int = 100):
        """
        Args:
            sample_interval_ms: 샘플링 간격 (10~1000ms 권장)
        """
        self.sample_interval = sample_interval_ms / 1000.0  # 초 단위로 변환
        self.computer = None
        self.is_running = False
        self.data_buffer = {}  # {센서이름: deque(최근 데이터)}
        self.lock = threading.Lock()
        self.collection_thread = None
        
        self._initialize_hardware()
    
    def _initialize_hardware(self):
        """하드웨어 초기화"""
        print("[*] 하드웨어 초기화 중...")
        
        self.computer = Computer()
        
        # 필요한 하드웨어 컴포넌트 활성화
        self.computer.IsMotherboardEnabled = True  # 메인보드 센서 (팬, 온도)
        self.computer.IsCpuEnabled = True          # CPU 온도
        self.computer.IsGpuEnabled = True          # GPU 팬 및 온도
        self.computer.IsControllerEnabled = True   # 외부 팬 컨트롤러
        
        try:
            self.computer.Open()
            print("[+] 하드웨어 열기 성공")
        except Exception as e:
            print(f"[ERROR] 하드웨어 열기 실패: {e}")
            print("[!] 관리자 권한으로 실행해주세요.")
            sys.exit(1)
        
        # 사용 가능한 센서 출력
        self._print_available_sensors()
    
    def _print_available_sensors(self):
        """사용 가능한 모든 센서 목록 출력"""
        print("\n[=] 감지된 센서:")
        print("=" * 70)
        
        for hardware in self.computer.Hardware:
            print(f"\n[하드웨어] {hardware.Name} ({hardware.HardwareType})")
            
            # 메인 하드웨어의 센서
            if hardware.Sensors.Length > 0:
                for sensor in hardware.Sensors:
                    sensor_type = str(sensor.SensorType)
                    value = sensor.Value if sensor.Value is not None else "N/A"
                    print(f"  ├─ {sensor.Name:30} [{sensor_type:10}] {value}")
            
            # 하위 하드웨어 탐색 (Super I/O 칩셋 등)
            if hardware.SubHardware.Length > 0:
                for sub in hardware.SubHardware:
                    print(f"  └─ [서브하드웨어] {sub.Name} ({sub.HardwareType})")
                    
                    if sub.Sensors.Length > 0:
                        for sensor in sub.Sensors:
                            sensor_type = str(sensor.SensorType)
                            value = sensor.Value if sensor.Value is not None else "N/A"
                            print(f"     ├─ {sensor.Name:28} [{sensor_type:10}] {value}")
        
        print("=" * 70 + "\n")
    
    def _collect_data_loop(self):
        """백그라운드 데이터 수집 루프 (고속 샘플링)"""
        print(f"[*] 데이터 수집 시작 (간격: {self.sample_interval*1000:.0f}ms)")
        
        while self.is_running:
            try:
                # 하드웨어 데이터 갱신
                for hardware in self.computer.Hardware:
                    hardware.Update()
                    
                    # 하위 하드웨어도 업데이트
                    for sub in hardware.SubHardware:
                        sub.Update()
                
                # 센서 데이터 수집
                timestamp = datetime.now().isoformat()
                sensor_data = {
                    'timestamp': timestamp,
                    'sensors': {}
                }
                
                for hardware in self.computer.Hardware:
                    self._collect_from_hardware(hardware, sensor_data)
                    
                    # 하위 하드웨어 데이터도 수집
                    for sub in hardware.SubHardware:
                        self._collect_from_hardware(sub, sensor_data)
                
                # 버퍼에 저장
                with self.lock:
                    for sensor_name, sensor_info in sensor_data['sensors'].items():
                        if sensor_name not in self.data_buffer:
                            self.data_buffer[sensor_name] = deque(maxlen=10000)  # 최근 10K개 저장
                        
                        self.data_buffer[sensor_name].append({
                            'timestamp': timestamp,
                            'value': sensor_info['value'],
                            'type': sensor_info['type']
                        })
                
                time.sleep(self.sample_interval)
            
            except Exception as e:
                print(f"[ERROR] 데이터 수집 오류: {e}")
                time.sleep(self.sample_interval)
    
    def _collect_from_hardware(self, hardware, sensor_data: Dict):
        """특정 하드웨어에서 센서 데이터 수집"""
        hw_name = hardware.Name
        
        for sensor in hardware.Sensors:
            if sensor.Value is None:
                continue
            
            sensor_type = str(sensor.SensorType)
            sensor_key = f"{hw_name}_{sensor.Name}"
            
            # 관심 센서 타입만 수집
            if sensor_type in ['Fan', 'Temperature', 'Control']:
                sensor_data['sensors'][sensor_key] = {
                    'hardware': hw_name,
                    'sensor_name': sensor.Name,
                    'type': sensor_type,
                    'value': float(sensor.Value),
                    'min': float(sensor.Min) if sensor.Min is not None else None,
                    'max': float(sensor.Max) if sensor.Max is not None else None
                }
    
    def start_collection(self):
        """데이터 수집 시작"""
        if self.is_running:
            print("[!] 이미 데이터 수집 중입니다.")
            return
        
        self.is_running = True
        self.collection_thread = threading.Thread(target=self._collect_data_loop, daemon=False)
        self.collection_thread.start()
    
    def start_collection_with_duration(self, duration_seconds: float) -> Dict:
        """지정된 시간 동안 데이터 수집
        
        Args:
            duration_seconds: 수집 시간 (초, 최대 300초)
        
        Returns:
            수집된 데이터 요약
        """
        # 범위 검증
        if duration_seconds <= 0:
            print("[ERROR] 수집 시간은 0초보다 커야 합니다.")
            return {}
        
        if duration_seconds > 300:
            print("[!] 최대 수집 시간은 300초입니다. 300초로 조정됩니다.")
            duration_seconds = 300
        
        print(f"\n[*] {duration_seconds}초 동안 데이터 수집을 시작합니다...")
        print("=" * 70)
        
        # 기존 버퍼 초기화
        self.data_buffer.clear()
        
        # 데이터 수집 시작
        self.start_collection()
        
        # 진행 상황 표시
        start_time = time.time()
        last_count = 0
        
        try:
            while time.time() - start_time < duration_seconds:
                elapsed = time.time() - start_time
                remaining = duration_seconds - elapsed
                
                # 진행 상황 막대
                progress = elapsed / duration_seconds
                bar_length = 40
                filled = int(bar_length * progress)
                bar = '█' * filled + '░' * (bar_length - filled)
                
                # 현재 수집된 샘플 수
                with self.lock:
                    current_count = sum(len(data) for data in self.data_buffer.values())
                
                # 시간당 샘플 수 계산
                if elapsed > 0:
                    samples_per_sec = current_count / elapsed
                    avg_sample_interval = (1000 / samples_per_sec) if samples_per_sec > 0 else 0
                else:
                    avg_sample_interval = 0
                
                # 터미널에 진행 상황 표시
                print(f"\r[{bar}] {progress*100:5.1f}% | "
                      f"경과: {elapsed:6.1f}s / 남은: {remaining:6.1f}s | "
                      f"샘플: {current_count:5d}개 | "
                      f"간격: {avg_sample_interval:5.1f}ms   ",
                      end='', flush=True)
                
                time.sleep(0.1)
        
        except KeyboardInterrupt:
            print("\n[!] Ctrl+C로 중단되었습니다.")
        
        finally:
            self.stop_collection()
            elapsed = time.time() - start_time
            print("\n" + "=" * 70)
        
        # 수집 결과 요약
        with self.lock:
            summary = {
                'duration_requested': duration_seconds,
                'duration_actual': elapsed,
                'total_samples': sum(len(data) for data in self.data_buffer.values()),
                'sensors_count': len(self.data_buffer),
                'sensors': {}
            }
            
            for sensor_name, data_list in self.data_buffer.items():
                if len(data_list) > 0:
                    values = [d['value'] for d in data_list]
                    summary['sensors'][sensor_name] = {
                        'sample_count': len(data_list),
                        'min': min(values),
                        'max': max(values),
                        'avg': sum(values) / len(values)
                    }
        
        return summary
    
    def stop_collection(self):
        """데이터 수집 중지"""
        if not self.is_running:
            print("[!] 데이터 수집이 진행 중이지 않습니다.")
            return
        
        self.is_running = False
        if self.collection_thread:
            self.collection_thread.join(timeout=2)
        
        print("[+] 데이터 수집 중지됨")
    
    def get_latest_data(self) -> Dict:
        """최신 센서 데이터 조회"""
        with self.lock:
            latest = {}
            for sensor_name, data_list in self.data_buffer.items():
                if len(data_list) > 0:
                    latest[sensor_name] = data_list[-1]  # 가장 최신 데이터
            return latest
    
    def get_timeseries(self, sensor_name: str, last_n: int = 300) -> List[Dict]:
        """특정 센서의 시계열 데이터 조회 (최근 N개)"""
        with self.lock:
            if sensor_name not in self.data_buffer:
                return []
            
            buffer_list = list(self.data_buffer[sensor_name])
            return buffer_list[-last_n:] if last_n else buffer_list
    
    def set_fan_pwm(self, fan_name: str, pwm_percent: float) -> bool:
        """특정 팬의 PWM 속도 설정
        
        Args:
            fan_name: 팬 이름 (e.g., "CPU_FAN_1", "SYS_FAN_1")
            pwm_percent: PWM 비율 (0~100)
        
        Returns:
            성공 여부
        """
        if not 0 <= pwm_percent <= 100:
            print("[ERROR] PWM 범위는 0~100입니다.")
            return False
        
        pwm_clipped = max(0, min(100, pwm_percent))
        found = False
        
        try:
            for hardware in self.computer.Hardware:
                for sensor in hardware.Sensors:
                    # Control 타입 센서 찾기
                    if str(sensor.SensorType) == 'Control' and fan_name in sensor.Name:
                        print(f"[*] {sensor.Name}을 {pwm_clipped:.1f}%로 설정 중...")
                        sensor.Control.SetSoftware(pwm_clipped)
                        found = True
                        print(f"[+] 설정 완료")
                        break
                
                # 하위 하드웨어도 탐색
                if not found:
                    for sub in hardware.SubHardware:
                        for sensor in sub.Sensors:
                            if str(sensor.SensorType) == 'Control' and fan_name in sensor.Name:
                                print(f"[*] {sensor.Name}을 {pwm_clipped:.1f}%로 설정 중...")
                                sensor.Control.SetSoftware(pwm_clipped)
                                found = True
                                print(f"[+] 설정 완료")
                                break
            
            if not found:
                print(f"[!] '{fan_name}' 팬을 찾을 수 없습니다.")
                return False
            
            return True
        
        except Exception as e:
            print(f"[ERROR] PWM 설정 오류: {e}")
            return False
    
    def export_to_json(self, filename: str = None) -> str:
        """현재 데이터를 JSON 파일로 저장"""
        if filename is None:
            filename = f"sensor_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with self.lock:
            data = {
                'timestamp': datetime.now().isoformat(),
                'sample_interval_ms': self.sample_interval * 1000,
                'sensors': {}
            }
            
            for sensor_name, data_list in self.data_buffer.items():
                data['sensors'][sensor_name] = list(data_list)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"[+] JSON 저장 완료: {filename}")
        return filename
    
    def export_to_csv(self, filename: str = None) -> str:
        """현재 데이터를 CSV 파일로 저장"""
        if filename is None:
            filename = f"sensor_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        with self.lock:
            # 모든 타임스탬프 수집
            all_timestamps = set()
            for data_list in self.data_buffer.values():
                for record in data_list:
                    all_timestamps.add(record['timestamp'])
            
            all_timestamps = sorted(list(all_timestamps))
            
            # CSV 작성
            with open(filename, 'w', newline='', encoding='utf-8') as f:
                sensor_names = list(self.data_buffer.keys())
                writer = csv.writer(f)
                
                # 헤더
                writer.writerow(['timestamp'] + sensor_names)
                
                # 데이터 행
                for timestamp in all_timestamps:
                    row = [timestamp]
                    
                    for sensor_name in sensor_names:
                        # 해당 타임스탬프의 데이터 찾기
                        value = None
                        for record in self.data_buffer[sensor_name]:
                            if record['timestamp'] == timestamp:
                                value = record['value']
                                break
                        
                        row.append(value if value is not None else '')
                    
                    writer.writerow(row)
        
        print(f"[+] CSV 저장 완료: {filename}")
        return filename
    
    def cleanup(self):
        """리소스 정리"""
        self.stop_collection()
        if self.computer:
            self.computer.Close()
            print("[+] 하드웨어 리소스 해제됨")


class SensorMonitoringCLI:
    """명령행 인터페이스 (CLI)"""
    
    def __init__(self):
        self.collector = None
    
    def run(self):
        """CLI 메인 루프"""
        print("\n" + "=" * 70)
        print(" LibreHardwareMonitor 기반 센서 데이터 수집 프로그램")
        print("=" * 70)
        
        # 데이터 수집기 초기화
        self.collector = HardwareSensorCollector(sample_interval_ms=100)
        
        # 데이터 수집 시작
        self.collector.start_collection()
        
        # 예열 (초기 데이터 축적)
        print("\n[*] 데이터 초기 축적 중 (3초)...")
        time.sleep(3)
        
        # CLI 루프
        while True:
            print("\n[명령어]")
            print("  1. 현재 상태 조회")
            print("  2. 특정 팬 속도 조절")
            print("  3. 시계열 데이터 보기")
            print("  4. x초 동안 데이터 수집 (최대 300초)")
            print("  5. JSON 저장")
            print("  6. CSV 저장")
            print("  7. 종료")
            
            cmd = input("\n명령어 선택 (1-7): ").strip()
            
            if cmd == '1':
                self._show_current_status()
            elif cmd == '2':
                self._set_fan_speed()
            elif cmd == '3':
                self._show_timeseries()
            elif cmd == '4':
                self._collect_for_duration()
            elif cmd == '5':
                self.collector.export_to_json()
            elif cmd == '6':
                self.collector.export_to_csv()
            elif cmd == '7':
                break
            else:
                print("[!] 잘못된 명령어입니다.")
        
        # 정리
        self.collector.cleanup()
        print("\n[+] 프로그램 종료")
    
    def _show_current_status(self):
        """현재 센서 상태 표시"""
        latest = self.collector.get_latest_data()
        
        if not latest:
            print("[!] 수집된 데이터가 없습니다.")
            return
        
        print("\n[=] 현재 센서 상태 (갱신 시간: 100ms)")
        print("=" * 70)
        
        for sensor_name in sorted(latest.keys()):
            data = latest[sensor_name]
            value = data['value']
            sensor_type = data['type']
            
            if sensor_type == 'Temperature':
                print(f"  {sensor_name:40} {value:6.1f} °C")
            elif sensor_type == 'Fan':
                print(f"  {sensor_name:40} {value:6.0f} RPM")
            elif sensor_type == 'Control':
                print(f"  {sensor_name:40} {value:6.1f} %")
        
        print("=" * 70)
    
    def _set_fan_speed(self):
        """팬 속도 조절"""
        # 사용 가능한 팬 목록 표시
        latest = self.collector.get_latest_data()
        fans = [name for name in latest.keys() if latest[name]['type'] == 'Control']
        
        if not fans:
            print("[!] 제어 가능한 팬이 없습니다.")
            return
        
        print("\n[=] 제어 가능한 팬:")
        for i, fan in enumerate(fans, 1):
            print(f"  {i}. {fan}")
        
        fan_idx = input("\n팬 번호 선택: ").strip()
        
        try:
            fan_idx = int(fan_idx) - 1
            if 0 <= fan_idx < len(fans):
                fan_name = fans[fan_idx]
                pwm = float(input("PWM 비율 입력 (0-100): ").strip())
                
                self.collector.set_fan_pwm(fan_name, pwm)
            else:
                print("[!] 잘못된 범위입니다.")
        except ValueError:
            print("[!] 숫자를 입력해주세요.")
    
    def _show_timeseries(self):
        """시계열 데이터 표시"""
        latest = self.collector.get_latest_data()
        sensors = sorted(latest.keys())
        
        print("\n[=] 센서 선택:")
        for i, sensor in enumerate(sensors, 1):
            print(f"  {i}. {sensor}")
        
        sensor_idx = input("\n센서 번호 선택: ").strip()
        
        try:
            sensor_idx = int(sensor_idx) - 1
            if 0 <= sensor_idx < len(sensors):
                sensor_name = sensors[sensor_idx]
                timeseries = self.collector.get_timeseries(sensor_name, last_n=20)
                
                print(f"\n[=] {sensor_name} (최근 20개)")
                print("=" * 70)
                print(f"{'시간':25} {'값':15}")
                print("-" * 70)
                
                for record in timeseries:
                    timestamp = record['timestamp'].split('T')[1][:12]  # HH:MM:SS.mmm
                    value = record['value']
                    print(f"{timestamp:25} {value:15.2f}")
                
                print("=" * 70)
            else:
                print("[!] 잘못된 범위입니다.")
        except ValueError:
            print("[!] 숫자를 입력해주세요.")
    
    def _collect_for_duration(self):
        """지정된 시간 동안 데이터 수집"""
        print("\n[=] x초 동안 데이터 수집")
        print("범위: 1~300초")
        
        try:
            duration = float(input("\n수집 시간 입력 (초): ").strip())
            
            if duration <= 0:
                print("[!] 0초보다 큰 값을 입력해주세요.")
                return
            
            # 기존 수집 중단 (배경에서 계속 실행되는 것 중단)
            was_running = self.collector.is_running
            if was_running:
                self.collector.stop_collection()
                time.sleep(0.5)
            
            # 지정된 시간 동안 수집
            summary = self.collector.start_collection_with_duration(duration)
            
            # 수집 결과 표시
            if summary:
                print("\n[=] 수집 결과 요약")
                print("=" * 70)
                print(f"요청 시간:    {summary['duration_requested']:.1f}초")
                print(f"실제 시간:    {summary['duration_actual']:.2f}초")
                print(f"수집된 샘플:  {summary['total_samples']:,}개")
                print(f"센서 수:      {summary['sensors_count']}개")
                
                print("\n[센서별 통계]")
                print("-" * 70)
                
                for sensor_name in sorted(summary['sensors'].keys()):
                    stats = summary['sensors'][sensor_name]
                    print(f"\n{sensor_name}")
                    print(f"  샘플 수: {stats['sample_count']:5d}개")
                    print(f"  최소값: {stats['min']:10.2f}")
                    print(f"  최대값: {stats['max']:10.2f}")
                    print(f"  평균값: {stats['avg']:10.2f}")
                
                print("\n" + "=" * 70)
                
                # 자동 저장 옵션
                save_opt = input("\n자동으로 JSON 저장하시겠습니까? (y/n): ").strip().lower()
                if save_opt == 'y':
                    self.collector.export_to_json()
            
            # 배경 수집 재시작 (필요한 경우)
            if was_running and not self.collector.is_running:
                print("\n[*] 배경 데이터 수집을 재시작합니다...")
                self.collector.start_collection()
        
        except ValueError:
            print("[!] 숫자를 입력해주세요.")


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description='LibreHardwareMonitor 기반 센서 데이터 수집 프로그램'
    )
    parser.add_argument(
        '--duration',
        type=float,
        default=None,
        help='데이터 수집 시간 (초, 최대 300초). 이 옵션이 지정되면 CLI 대신 배치 모드로 실행됩니다.'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=100,
        help='샘플링 간격 (밀리초, 기본값: 100ms)'
    )
    parser.add_argument(
        '--output',
        type=str,
        choices=['json', 'csv', 'both'],
        default='json',
        help='출력 형식 (기본값: json)'
    )
    
    args = parser.parse_args()
    
    try:
        # 배치 모드 (--duration 지정된 경우)
        if args.duration is not None:
            print("\n" + "=" * 70)
            print(" LibreHardwareMonitor 기반 센서 데이터 수집 (배치 모드)")
            print("=" * 70)
            
            collector = HardwareSensorCollector(sample_interval_ms=args.interval)
            
            # 지정된 시간 동안 데이터 수집
            summary = collector.start_collection_with_duration(args.duration)
            
            # 수집 결과 요약
            if summary:
                print("\n[=] 수집 결과 요약")
                print("=" * 70)
                print(f"요청 시간:    {summary['duration_requested']:.1f}초")
                print(f"실제 시간:    {summary['duration_actual']:.2f}초")
                print(f"수집된 샘플:  {summary['total_samples']:,}개")
                print(f"센서 수:      {summary['sensors_count']}개")
                
                print("\n[센서별 통계]")
                print("-" * 70)
                
                for sensor_name in sorted(summary['sensors'].keys()):
                    stats = summary['sensors'][sensor_name]
                    print(f"\n{sensor_name}")
                    print(f"  샘플 수: {stats['sample_count']:5d}개")
                    print(f"  최소값: {stats['min']:10.2f}")
                    print(f"  최대값: {stats['max']:10.2f}")
                    print(f"  평균값: {stats['avg']:10.2f}")
                
                print("\n" + "=" * 70)
                
                # 파일 저장
                if args.output in ['json', 'both']:
                    collector.export_to_json()
                if args.output in ['csv', 'both']:
                    collector.export_to_csv()
            
            collector.cleanup()
            print("\n[+] 배치 모드 완료")
        
        # 대화형 CLI 모드
        else:
            cli = SensorMonitoringCLI()
            cli.run()
    
    except KeyboardInterrupt:
        print("\n\n[!] Ctrl+C로 중단됨")
    except Exception as e:
        print(f"\n[ERROR] 예기치 않은 오류: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()