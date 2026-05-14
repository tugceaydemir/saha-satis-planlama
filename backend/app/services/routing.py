"""
Model 3: TDVRP - Time Dependent Vehicle Routing Problem
Orijinal kod: TDVRP vs Static VRP Karsilastirma
TomTom API ile gercek trafik verileri kullanir.
Pipeline entegrasyonu icin solve_route() wrapper fonksiyonu eklenmistir.
solve_tdvrp ve evaluate_route_with_real_traffic fonksiyonlari
orijinal koddan degistirilmeden alinmistir.
"""
import math
import os
import time as time_module
from datetime import datetime, timedelta
import pulp
import requests
import numpy as np


# TomTom API anahtarı environment variable'dan okunuyor.
# Lokal: backend/.env dosyasından, prod: Render dashboard env vars'tan.
API_KEY = os.getenv("TOMTOM_API_KEY", "")
if not API_KEY:
    print("[UYARI] TOMTOM_API_KEY environment variable set degil. "
          "Routing fonksiyonlari calismayacak. backend/.env dosyasini kontrol et.")

WORKDAY_START_HOUR = 8
NUM_SLOTS = 5
DEFAULT_SERVICE_TIME = 15.0
DEFAULT_TIME_WINDOW = (480, 1080)
DEFAULT_DEMAND = 3
DEFAULT_CAPACITY = 60


# =============================================================================
# BOLUM 1: TOMTOM API CLIENT
# =============================================================================
class TomTomMatrixClient:
    BASE_URL = "https://api.tomtom.com/routing/matrix/2"

    def __init__(self, api_key):
        self.api_key = api_key

    def get_time_dependent_matrices(self, coords, time_slots):
        matrices = {}
        for rho, slot_time in enumerate(time_slots, start=1):
            matrices[rho] = self._real_api_call(coords, slot_time)
        return matrices

    def _real_api_call(self, coords, slot_time):
        origins = [{"point": {"latitude": lat, "longitude": lon}}
                   for lat, lon in coords]
        payload = {
            "origins": origins,
            "destinations": origins.copy(),
            "options": {
                "departAt": slot_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "traffic": "live",
                "travelMode": "car",
                "routeType": "fastest"
            }
        }
        url = f"{self.BASE_URL}?key={self.api_key}"
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()

        n = len(coords)
        matrix = [[0.0] * n for _ in range(n)]
        for cell in data.get("data", []):
            i = cell["originIndex"]
            j = cell["destinationIndex"]
            if i != j and "routeSummary" in cell:
                matrix[i][j] = round(
                    cell["routeSummary"]["travelTimeInSeconds"] / 60.0, 2
                )
        return matrix


# =============================================================================
# BOLUM 2: COZUCU - HEM TDVRP HEM STATIC ICIN
# =============================================================================
def solve_tdvrp(n, travel_time, service_time, time_window, demand,
                capacity, time_slots, big_M=10000.0, verbose=True,
                model_name="TDVRP", time_limit=1800):
    """
    TDVRP modelini cozer.
    travel_time tek matris (dict ile {1: matrix}) verilirse static gibi calisir.
    """
    V = list(range(n + 2))
    C = list(range(1, n + 1))
    R = list(travel_time.keys())

    edges = []
    for i in V:
        for j in V:
            if i == j or j == 0 or i == n + 1:
                continue
            edges.append((i, j))

    model = pulp.LpProblem(model_name, pulp.LpMinimize)

    x = pulp.LpVariable.dicts("x", edges, cat="Binary")
    y = pulp.LpVariable.dicts("y", V, lowBound=0, cat="Continuous")
    z = pulp.LpVariable.dicts(
        "z",
        [(i, j, rho) for (i, j) in edges for rho in R],
        cat="Binary"
    )
    f = pulp.LpVariable.dicts("f", V, lowBound=0, cat="Continuous")

    model += pulp.lpSum(
        travel_time[rho][i][j] * z[(i, j, rho)]
        for (i, j) in edges for rho in R
    )

    for j in C:
        model += pulp.lpSum(x[(i, j)] for i in V if (i, j) in edges) == 1
    for i in C:
        model += pulp.lpSum(x[(i, j)] for j in V if (i, j) in edges) == 1
    model += pulp.lpSum(x[(0, j)] for j in C if (0, j) in edges) == 1
    model += pulp.lpSum(x[(i, n+1)] for i in C if (i, n+1) in edges) == 1

    for (i, j) in edges:
        if i == 0:
            g_i = 0
        elif i == n + 1:
            continue
        else:
            g_i = service_time[i - 1]
        model += y[j] >= y[i] + g_i + pulp.lpSum(
            travel_time[rho][i][j] * z[(i, j, rho)] for rho in R
        ) - big_M * (1 - x[(i, j)])

    for i in C:
        a_i, b_i = time_window[i - 1]
        model += y[i] >= a_i
        model += y[i] <= b_i
    model += y[n + 1] <= time_slots[-1][1]
    model += y[0] == time_slots[0][0]

    for (i, j) in edges:
        model += pulp.lpSum(z[(i, j, rho)] for rho in R) == x[(i, j)]

    # Hiz dilimi secimi - sadece R > 1 ise gerekli (static'te bir dilim var)
    if len(R) > 1:
        for (i, j) in edges:
            if i == 0:
                g_i = 0
            elif i == n + 1:
                continue
            else:
                g_i = service_time[i - 1]
            for rho in R:
                tau_start, tau_end = time_slots[rho - 1]
                model += y[i] + g_i >= tau_start * z[(i, j, rho)]
                model += y[i] + g_i <= tau_end + big_M * (1 - z[(i, j, rho)])

    for (i, j) in edges:
        if j in C:
            q_j = demand[j - 1]
            model += f[j] >= f[i] + q_j - big_M * (1 - x[(i, j)])
    for i in C:
        q_i = demand[i - 1]
        model += f[i] >= q_i
        model += f[i] <= capacity
    model += f[0] == 0

    if verbose:
        print(f"  Model: {len(model.variables())} degisken, "
              f"{len(model.constraints)} kisit")

    start = time_module.time()
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit)
    model.solve(solver)
    solve_time = time_module.time() - start

    status = pulp.LpStatus[model.status]
    if model.status != pulp.LpStatusOptimal:
        return {"status": status, "objective": None, "route": None,
                "arrival_times": None, "edge_slots": None,
                "solve_time": solve_time}

    objective = pulp.value(model.objective)
    next_node = {}
    for (i, j) in edges:
        if pulp.value(x[(i, j)]) > 0.5:
            next_node[i] = j

    route = [0]
    current = 0
    while current != n + 1:
        current = next_node[current]
        route.append(current)

    arrival = {i: pulp.value(y[i]) for i in V}
    edge_slots = {}
    for (i, j) in edges:
        if pulp.value(x[(i, j)]) > 0.5:
            for rho in R:
                if pulp.value(z[(i, j, rho)]) > 0.5:
                    edge_slots[(i, j)] = rho

    return {"status": status, "objective": objective, "route": route,
            "arrival_times": arrival, "edge_slots": edge_slots,
            "solve_time": solve_time}


def format_minutes(m):
    if m is None:
        return "—"
    h = int(m) // 60
    mm = int(m) % 60
    return f"{h:02d}:{mm:02d}"


def evaluate_route_with_real_traffic(route, travel_time_real, service_time,
                                      time_slots, edge_slots_used=None):
    """
    Bir rotanin GERCEK trafikteki suresini hesaplar.
    Static'te bulunan rotayi gercek time-dependent trafikte test ederiz.
    """
    n = len(route) - 2
    current_time = time_slots[0][0]  # 480 = 08:00
    total_travel = 0.0
    arrival_real = {0: current_time}

    for idx in range(len(route) - 1):
        i = route[idx]
        j = route[idx + 1]

        # i'den ayrilis: varis + servis
        if 0 < i <= n:
            depart = current_time + service_time[i - 1]
        else:
            depart = current_time

        # Hangi dilimde?
        rho = 1
        for r_idx, (s, e) in enumerate(time_slots, start=1):
            if s <= depart < e:
                rho = r_idx
                break
        else:
            rho = len(time_slots)

        # Bu dilimin gercek trafigi
        if rho in travel_time_real:
            t_ij = travel_time_real[rho][i][j]
        else:
            t_ij = travel_time_real[1][i][j]

        total_travel += t_ij
        current_time = depart + t_ij

        # Time window'a erken vardiysak bekle (a_i'dan once gidemeyiz)
        arrival_real[j] = current_time

    return {
        "total_travel": total_travel,
        "arrival_times": arrival_real,
        "end_time": current_time
    }


# =============================================================================
# PIPELINE UYUMLU YARDIMCI FONKSIYONLAR
# =============================================================================
def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _solve_nearest_neighbor(n, travel_time_avg):
    visited = [False] * (n + 2)
    visited[0] = True
    visited[n + 1] = True
    route = [0]
    current = 0
    total_time = 0.0

    for _ in range(n):
        best_next = -1
        best_t = float("inf")
        for j in range(1, n + 1):
            if not visited[j] and travel_time_avg[current][j] < best_t:
                best_t = travel_time_avg[current][j]
                best_next = j
        if best_next == -1:
            break
        visited[best_next] = True
        route.append(best_next)
        total_time += best_t
        current = best_next

    total_time += travel_time_avg[current][n + 1]
    route.append(n + 1)
    return route, total_time


# =============================================================================
# PIPELINE UYUMLU ANA FONKSIYON
# =============================================================================
def solve_route(
    customer_indices,
    x_coords,
    y_coords,
    depot_x,
    depot_y,
    time_limit=3600,
):
    """
    Pipeline'dan cagrilan ana fonksiyon.
    TomTom'dan trafik verileri ceker ve TDVRP cozer.

    Args:
        customer_indices: ziyaret edilecek musteri indeksleri (numpy array indeksleri)
        x_coords, y_coords: TUM musterilerin GPS koordinatlari (lat, lon)
        depot_x, depot_y: depo GPS koordinati (lat, lon)
        time_limit: TDVRP solver zaman siniri (saniye)

    Returns:
        dict: route (musteri indeksleri), total_distance (km),
              total_time (dk), arrival_times, status
    """
    custs = list(customer_indices)
    n = len(custs)

    if n == 0:
        return {"route": [], "total_distance": 0.0, "total_time": 0.0,
                "arrival_times": {}, "status": "empty"}

    coords = (
        [(depot_x, depot_y)]
        + [(float(x_coords[c]), float(y_coords[c])) for c in custs]
        + [(depot_x, depot_y)]
    )

    tomorrow = datetime.now().replace(
        hour=WORKDAY_START_HOUR, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    slot_hours = [0, 2, 4, 6, 8]  # 08:00, 10:00, 12:00, 14:00, 16:00
    time_slot_datetimes = [tomorrow + timedelta(hours=h) for h in slot_hours]
    time_slots_minutes = [(480 + h * 60, 480 + (h + 2) * 60) for h in slot_hours]

    client = TomTomMatrixClient(API_KEY)
    try:
        travel_time_td = client.get_time_dependent_matrices(
            coords, time_slot_datetimes
        )
    except Exception as e:
        print(f"TomTom API hatasi: {e} — Haversine fallback kullaniliyor")
        return _haversine_fallback(custs, x_coords, y_coords, depot_x, depot_y)

    if n == 1:
        avg_time = sum(travel_time_td[rho][0][1] for rho in travel_time_td) / NUM_SLOTS
        total_time = avg_time * 2
        total_dist = _haversine_km(depot_x, depot_y,
                                   float(x_coords[custs[0]]),
                                   float(y_coords[custs[0]])) * 2
        return {
            "route": [custs[0]],
            "total_distance": total_dist,
            "total_time": total_time,
            "arrival_times": {custs[0]: 480 + avg_time},
            "status": "trivial",
        }

    service_time = [DEFAULT_SERVICE_TIME] * n
    time_window = [DEFAULT_TIME_WINDOW] * n
    demand = [DEFAULT_DEMAND] * n

    result = solve_tdvrp(
        n=n,
        travel_time=travel_time_td,
        service_time=service_time,
        time_window=time_window,
        demand=demand,
        capacity=DEFAULT_CAPACITY,
        time_slots=time_slots_minutes,
        model_name=f"TDVRP_{n}musteri",
        time_limit=time_limit,
    )

    if result["status"] != "Optimal":
        n_total = len(coords)
        avg_matrix = [[0.0] * n_total for _ in range(n_total)]
        for i in range(n_total):
            for j in range(n_total):
                if i != j:
                    avg_matrix[i][j] = sum(
                        travel_time_td[rho][i][j] for rho in travel_time_td
                    ) / NUM_SLOTS
        nn_route, nn_time = _solve_nearest_neighbor(n, avg_matrix)

        route_indices = [custs[node - 1] for node in nn_route if 0 < node <= n]

        total_dist = 0.0
        for idx in range(len(route_indices)):
            if idx == 0:
                total_dist += _haversine_km(depot_x, depot_y,
                                            float(x_coords[route_indices[0]]),
                                            float(y_coords[route_indices[0]]))
            if idx < len(route_indices) - 1:
                c1, c2 = route_indices[idx], route_indices[idx + 1]
                total_dist += _haversine_km(float(x_coords[c1]), float(y_coords[c1]),
                                            float(x_coords[c2]), float(y_coords[c2]))
        if route_indices:
            total_dist += _haversine_km(float(x_coords[route_indices[-1]]),
                                        float(y_coords[route_indices[-1]]),
                                        depot_x, depot_y)

        arrival_map = {}
        current_time = 480.0
        for idx in range(len(nn_route) - 1):
            i, j = nn_route[idx], nn_route[idx + 1]
            if 0 < i <= n:
                current_time += DEFAULT_SERVICE_TIME
            current_time += avg_matrix[i][j]
            if 0 < j <= n:
                arrival_map[custs[j - 1]] = current_time

        return {
            "route": route_indices,
            "total_distance": total_dist,
            "total_time": nn_time,
            "arrival_times": arrival_map,
            "status": "heuristic",
        }

    tdvrp_route = result["route"]
    route_indices = [custs[node - 1] for node in tdvrp_route if 0 < node <= n]

    arrival_map = {}
    for node in tdvrp_route:
        if 0 < node <= n:
            arrival_map[custs[node - 1]] = result["arrival_times"][node]

    total_dist = 0.0
    for idx in range(len(route_indices)):
        if idx == 0:
            total_dist += _haversine_km(depot_x, depot_y,
                                        float(x_coords[route_indices[0]]),
                                        float(y_coords[route_indices[0]]))
        if idx < len(route_indices) - 1:
            c1, c2 = route_indices[idx], route_indices[idx + 1]
            total_dist += _haversine_km(float(x_coords[c1]), float(y_coords[c1]),
                                        float(x_coords[c2]), float(y_coords[c2]))
    if route_indices:
        total_dist += _haversine_km(float(x_coords[route_indices[-1]]),
                                    float(y_coords[route_indices[-1]]),
                                    depot_x, depot_y)

    return {
        "route": route_indices,
        "total_distance": total_dist,
        "total_time": result["objective"],
        "arrival_times": arrival_map,
        "status": result["status"],
    }


def _haversine_fallback(custs, x_coords, y_coords, depot_x, depot_y):
    n = len(custs)
    all_x = [depot_x] + [x_coords[c] for c in custs] + [depot_x]
    all_y = [depot_y] + [y_coords[c] for c in custs] + [depot_y]
    N = len(all_x)

    dist = [[0.0] * N for _ in range(N)]
    for i in range(N):
        for j in range(N):
            if i != j:
                dist[i][j] = _haversine_km(all_x[i], all_y[i], all_x[j], all_y[j])

    nn_route, _ = _solve_nearest_neighbor(n, dist)
    route_indices = [custs[node - 1] for node in nn_route if 0 < node <= n]

    total_dist = 0.0
    for idx in range(len(nn_route) - 1):
        total_dist += dist[nn_route[idx]][nn_route[idx + 1]]

    return {
        "route": route_indices,
        "total_distance": total_dist,
        "total_time": 0.0,
        "arrival_times": {},
        "status": "euclidean_fallback",
    }
