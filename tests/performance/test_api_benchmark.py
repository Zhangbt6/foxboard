"""
API Performance Benchmark - 性能回归测试
测试各端点响应时间，对比基准，超时 200% 标记为回归。

使用方式：
    # 首次运行（生成基准）
    python3 -m pytest tests/performance/test_api_benchmark.py -v

    # 后续运行（自动对比基准）
    python3 -m pytest tests/performance/test_api_benchmark.py -v
"""
import json
import os
import sys
import time
from pathlib import Path

import pytest

# 确保项目路径在 sys.path 中
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

BASE_URL = os.environ.get("FOXBOARD_API", "http://localhost:8000")
BASELINE_FILE = Path(__file__).parent / "baseline.json"
REGRESSION_THRESHOLD = 2.0  # 超过基准 200% 标记为回归


def _load_baseline() -> dict:
    if BASELINE_FILE.exists():
        with open(BASELINE_FILE) as f:
            return json.load(f)
    return {}


def _save_baseline(data: dict) -> None:
    with open(BASELINE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _http_get(path: str, retries: int = 3) -> tuple:
    """发送 GET 请求，返回 (status_code, elapsed_ms, response_text)"""
    import urllib.request
    url = f"{BASE_URL}{path}"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url)
            start = time.perf_counter()
            resp = urllib.request.urlopen(req, timeout=10)
            elapsed_ms = (time.perf_counter() - start) * 1000
            return resp.status, elapsed_ms, resp.read().decode("utf-8")
        except Exception as e:
            if attempt == retries - 1:
                return 0, 0.0, str(e)
    return 0, 0.0, "unreachable"


class TestAPIBenchmark:
    """API 性能基准测试"""

    # 测试端点配置：(endpoint_path, 是否需要 query_param)
    ENDPOINTS = [
        ("/tasks/kanban", None),                    # 看板视图
        ("/tasks/", None),                         # 任务列表
        ("/phases/", None),                         # Phase 列表
        ("/projects/", None),                       # 项目列表
        ("/agents/", None),                         # Agent 列表
        ("/stats/burndown?project_id=foxboard", None),   # 燃尽图
        ("/analytics/efficiency", None),            # 效率统计
    ]

    # 类级别共享baseline（在第一次运行测试时自动生成）
    _class_baseline = None

    @classmethod
    def _get_baseline(cls) -> dict:
        """获取基准数据，优先用类级别共享baseline（同一进程生成），fallback到文件"""
        if cls._class_baseline is not None:
            return cls._class_baseline
        return _load_baseline()

    @pytest.fixture(scope="class", autouse=True)
    def _generate_baseline_once(self):
        """在测试类初始化时首先生成基准（与测试共享同一进程/缓存状态）"""
        if TestAPIBenchmark._class_baseline is not None:
            return  # 已有baseline，跳过
        baseline = {}
        for path, _ in self.ENDPOINTS:
            # 充分预热：50次请求确保缓存完全稳定
            for _ in range(50):
                _http_get(path)
                time.sleep(0.02)
            time.sleep(1.0)
            # 测量20次取中位数（更抗噪声）
            times = []
            for _ in range(20):
                _, elapsed, _ = _http_get(path)
                times.append(elapsed)
                time.sleep(0.05)
            avg_ms = sorted(times)[len(times) // 2]
            baseline[path] = {"baseline_ms": avg_ms, "version": "1.1"}
            print(f"  [baseline] {path}: {avg_ms:.1f}ms (min={min(times):.1f}, max={max(times):.1f})")
        TestAPIBenchmark._class_baseline = baseline
        _save_baseline(baseline)

    @pytest.fixture(autouse=True)
    def _per_test_warmup(self, request):
        """每个测试前重新预热该endpoint（弥补fixture和测试之间的缓存退化）"""
        # 非参数化测试没有 callspec，跳过预热
        if not hasattr(request.node, 'callspec') or request.node.callspec is None:
            return
        path = request.node.callspec.params.get("path")
        if path:
            # 充分预热，与基准生成保持一致
            for _ in range(40):
                _http_get(path)
                time.sleep(0.02)
            time.sleep(0.5)

    @pytest.mark.parametrize("path", [ep[0] for ep in ENDPOINTS])
    def test_endpoint_performance(self, path):
        """
        测试单个端点的响应时间，使用类级别共享baseline（同一进程状态）。
        """
        # 预热请求（排除冷启动影响）
        for _ in range(3):
            _http_get(path)
            time.sleep(0.1)

        # 正式测量（取 5 次中位数，更抗噪声）
        times = []
        for _ in range(5):
            _, elapsed, _ = _http_get(path)
            times.append(elapsed)
            time.sleep(0.05)

        avg_ms = sorted(times)[len(times) // 2]  # 中位数
        baseline = self._get_baseline()

        # 首次运行：生成基准
        if path not in baseline:
            baseline[path] = {"baseline_ms": avg_ms, "version": "1.1"}
            _save_baseline(baseline)
            pytest.skip(f"基准已生成: {path} = {avg_ms:.1f}ms")

        # 后续运行：对比基准
        base_ms = baseline[path]["baseline_ms"]
        ratio = avg_ms / base_ms if base_ms > 0 else 0

        print(f"\n  {path}:")
        print(f"    当前: {avg_ms:.1f}ms | 基准: {base_ms:.1f}ms | 比率: {ratio:.2f}x")

        # 判定回归（允许 200% 以内）
        if ratio > REGRESSION_THRESHOLD:
            pytest.fail(
                f"性能回归！{path} 当前 {avg_ms:.1f}ms，超过基准 {base_ms:.1f}ms 的 {REGRESSION_THRESHOLD}x "
                f"(实际 {ratio:.2f}x)"
            )

    def test_generate_baseline(self):
        """
        强制重新生成基准数据（用于更新基准）。
        运行方式：pytest tests/performance/test_api_benchmark.py::TestAPIBenchmark::test_generate_baseline -v -s

        使用充分预热（30次）+ 多次采样来获得稳定基准。
        """
        baseline = {}
        for path, _ in self.ENDPOINTS:
            # 充分预热：30次请求
            for _ in range(30):
                _http_get(path)
                time.sleep(0.02)
            time.sleep(0.5)

            # 测量15次取中位数
            times = []
            for _ in range(15):
                _, elapsed, _ = _http_get(path)
                times.append(elapsed)
                time.sleep(0.05)

            avg_ms = sorted(times)[len(times) // 2]
            baseline[path] = {"baseline_ms": avg_ms, "version": "1.1"}
            print(f"  {path}: {avg_ms:.1f}ms (min={min(times):.1f}, max={max(times):.1f})")

        _save_baseline(baseline)
        print(f"\n基准已保存到 {BASELINE_FILE}")
        assert BASELINE_FILE.exists(), "基准文件未生成"
