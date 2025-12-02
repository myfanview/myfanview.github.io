from flask import Flask, jsonify
from sensor_collector import HardwareSensorCollector
import json
import threading
import time

app = Flask(__name__)
collector = HardwareSensorCollector(sample_interval_ms=100)

@app.route('/api/latest')
def get_latest():
    """최신 센서 데이터 반환"""
    latest = collector.get_latest_data()
    
    # 응답 형식 정리
    response = {}
    for sensor_name, data in latest.items():
        response[sensor_name] = {
            'value': data['value'],
            'type': data['type'],
            'timestamp': data['timestamp']
        }
    
    return jsonify(response)

@app.route('/api/timeseries/<sensor_name>')
def get_timeseries(sensor_name):
    """특정 센서의 시계열 데이터 반환 (최근 300개)"""
    timeseries = collector.get_timeseries(sensor_name, last_n=300)
    return jsonify(timeseries)

@app.route('/api/sensors')
def list_sensors():
    """사용 가능한 센서 목록"""
    latest = collector.get_latest_data()
    sensors = list(latest.keys())
    return jsonify({'sensors': sensors, 'count': len(sensors)})

@app.route('/api/set-fan/<fan_name>/<int:pwm>')
def set_fan_speed(fan_name, pwm):
    """팬 속도 설정"""
    success = collector.set_fan_pwm(fan_name, pwm)
    return jsonify({'success': success, 'fan': fan_name, 'pwm': pwm})

if __name__ == '__main__':
    # 백그라운드에서 데이터 수집
    collector.start_collection()
    
    print("[*] Flask 서버 시작...")
    print("[*] 주소: http://localhost:5000")
    print("[*] API:")
    print("    - GET /api/latest")
    print("    - GET /api/timeseries/<sensor_name>")
    print("    - GET /api/sensors")
    print("    - GET /api/set-fan/<fan_name>/<pwm>")
    
    app.run(debug=False, port=5000)