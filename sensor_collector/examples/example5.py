import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime

def analyze_sensor_data():
    """CSV 데이터를 로드하여 분석"""
    
    # CSV 로드
    df = pd.read_csv('sensor_data.csv')
    
    # 타임스탬프를 datetime으로 변환
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    print("[*] 데이터 분석 중...\n")
    
    # 통계 정보 출력
    print("[=] 기본 통계:")
    print(df.describe())
    
    # CPU 팬 RPM 통계
    cpu_fan_col = 'Motherboard_CPU FAN'
    if cpu_fan_col in df.columns:
        cpu_rpm = df[cpu_fan_col]
        print(f"\n[=] {cpu_fan_col} 분석:")
        print(f"    평균: {cpu_rpm.mean():.1f} RPM")
        print(f"    최소: {cpu_rpm.min():.1f} RPM")
        print(f"    최대: {cpu_rpm.max():.1f} RPM")
        print(f"    표준편차: {cpu_rpm.std():.1f} RPM")
    
    # CPU 온도 통계
    cpu_temp_col = 'Intel Core i7-10700K_CPU Package'
    if cpu_temp_col in df.columns:
        cpu_temp = df[cpu_temp_col]
        print(f"\n[=] {cpu_temp_col} 분석:")
        print(f"    평균: {cpu_temp.mean():.1f} °C")
        print(f"    최소: {cpu_temp.min():.1f} °C")
        print(f"    최대: {cpu_temp.max():.1f} °C")
        print(f"    표준편차: {cpu_temp.std():.1f} °C")
    
    # 그래프 그리기
    if cpu_fan_col in df.columns and cpu_temp_col in df.columns:
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 6))
        
        # CPU 팬 RPM
        ax1.plot(df['timestamp'], df[cpu_fan_col], label='CPU FAN RPM', color='blue')
        ax1.set_ylabel('RPM')
        ax1.set_title('CPU Fan Speed')
        ax1.grid(True, alpha=0.3)
        ax1.legend()
        
        # CPU 온도
        ax2.plot(df['timestamp'], df[cpu_temp_col], label='CPU Temp', color='red')
        ax2.set_xlabel('Time')
        ax2.set_ylabel('Temperature (°C)')
        ax2.set_title('CPU Temperature')
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        plt.tight_layout()
        plt.savefig('sensor_analysis.png', dpi=100)
        print(f"\n[+] 그래프 저장: sensor_analysis.png")
        plt.show()

if __name__ == '__main__':
    analyze_sensor_data()