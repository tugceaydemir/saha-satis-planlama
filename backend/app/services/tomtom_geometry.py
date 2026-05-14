"""
TomTom Routing API client — calculateRoute endpoint'i.

Bu servis, bir dizi koordinat (depo -> musteri 1 -> musteri 2 -> ... -> depo)
icin gercek yol geometrisini TomTom'dan alir.

NEDEN TomTom:
  - Mevcut sistemde TomTom Matrix API (TDVRP rotalama icin) zaten kullaniliyor.
  - Ayni servisi yol cizgisi icin de kullanmak tutarli ve API key tek.
  - Public OSRM (router.project-osrm.org) demo sunucusu zaman zaman 403 donuyor.

API Dokumantasyonu:
  https://developer.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route
"""
import os
import requests
from typing import List, Tuple, Optional


TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "")
TOMTOM_BASE_URL = "https://api.tomtom.com/routing/1/calculateRoute"
TOMTOM_TIMEOUT = 30  # saniye


def get_route_geometry(
    coordinates: List[Tuple[float, float]],
) -> Optional[dict]:
    """
    Verilen koordinat sirasi icin TomTom'dan gercek yol geometrisi alir.

    Args:
        coordinates: [(lat, lon), (lat, lon), ...] listesi.
                     Sira onemli: ilk nokta baslangic, son nokta varis.

    Returns:
        {
            'geometry': [[lat, lon], [lat, lon], ...],  # Yol uzerindeki noktalar
            'distance_meters': float,                    # toplam mesafe
            'duration_seconds': float,                   # tahmini sure (trafik dahil)
        }
        Veya None (hata durumunda).
    """
    if not TOMTOM_API_KEY:
        print("[TomTom HATA] TOMTOM_API_KEY environment variable set degil.")
        return None

    if len(coordinates) < 2:
        return None

    # TomTom URL formati: lat,lng:lat,lng:lat,lng...
    locations_str = ":".join([f"{lat},{lon}" for lat, lon in coordinates])

    url = f"{TOMTOM_BASE_URL}/{locations_str}/json"
    params = {
        "key": TOMTOM_API_KEY,
        "traffic": "true",            # Gercek zamanli trafik dahil
        "travelMode": "car",
        "routeType": "fastest",
        "computeTravelTimeFor": "all",
    }

    try:
        response = requests.get(url, params=params, timeout=TOMTOM_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"[TomTom HATA] {e}")
        return None
    except ValueError as e:
        print(f"[TomTom HATA] JSON parse edilemedi: {e}")
        return None

    routes = data.get("routes", [])
    if not routes:
        print(f"[TomTom HATA] Yanitta route yok: {data}")
        return None

    route = routes[0]
    summary = route.get("summary", {})

    # TomTom yaniti: route.legs[].points[].latitude/longitude
    # Tum bacaklardaki noktalari birlestirip tek bir geometri olusturuyoruz.
    all_points = []
    for leg in route.get("legs", []):
        for point in leg.get("points", []):
            lat = point.get("latitude")
            lon = point.get("longitude")
            if lat is not None and lon is not None:
                all_points.append([lat, lon])

    if not all_points:
        return None

    return {
        "geometry": all_points,
        "distance_meters": float(summary.get("lengthInMeters", 0)),
        "duration_seconds": float(summary.get("travelTimeInSeconds", 0)),
    }
