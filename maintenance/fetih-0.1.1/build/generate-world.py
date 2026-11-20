"""Bake the portable Fetih atlas from world-atlas countries-110m.json (Natural Earth)."""
import argparse
import json
from math import cos, radians
from pathlib import Path

from shapely import coverage_is_valid, coverage_simplify, make_valid, set_precision, union_all
from shapely.affinity import translate
from shapely.geometry import Polygon, box
from shapely.ops import nearest_points, polylabel


# Order is the saved region ID. Keep these positions stable for world-v1.
ZONES = [
    ("Alaska", "Alaska"),
    ("Kanada", "Canada"),
    ("Birleşik Devletler", "United States of America"),
    ("Orta Amerika", "Mexico|Belize|Guatemala|El Salvador|Honduras|Nicaragua|Costa Rica|Panama"),
    ("Karayipler", "Cuba|Haiti|Dominican Rep.|Bahamas|Puerto Rico|Jamaica|Trinidad and Tobago"),
    ("Kuzey Andlar", "Colombia|Venezuela|Ecuador|Guyana|Suriname"),
    ("Brezilya", "Brazil"),
    ("Güney Andlar", "Peru|Bolivia|Chile"),
    ("La Plata", "Argentina|Paraguay|Uruguay"),
    ("Grönland", "Greenland"),
    ("Batı Avrupa", "France|Spain|Portugal|Belgium|Netherlands|Luxembourg|Switzerland"),
    ("Britanya Adaları", "United Kingdom|Ireland"),
    ("İskandinavya", "Norway|Sweden|Finland|Denmark"),
    ("Orta Avrupa", "Germany|Italy|Austria|Czechia|Slovakia|Slovenia|Poland|Hungary"),
    ("Doğu Avrupa", "Ukraine|Belarus|Lithuania|Latvia|Estonia|Moldova|Romania"),
    ("Balkanlar", "Bulgaria|Greece|Albania|Croatia|Bosnia and Herz.|Macedonia|Serbia|Montenegro|Kosovo"),
    ("Batı Rusya", "Batı Rusya"),
    ("Sibirya", "Sibirya"),
    ("Mağrip", "Morocco|W. Sahara|Algeria|Tunisia|Libya|Mauritania"),
    ("Batı Afrika", "Senegal|Gambia|Mali|Burkina Faso|Niger|Nigeria|Benin|Togo|Ghana|Côte d'Ivoire|"
        "Guinea|Guinea-Bissau|Liberia|Sierra Leone"),
    ("Orta Afrika", "Cameroon|Chad|Central African Rep.|Congo|Dem. Rep. Congo|Gabon|Eq. Guinea|Angola"),
    ("Doğu Afrika", "Egypt|Sudan|S. Sudan|Eritrea|Ethiopia|Somaliland|Somalia|Djibouti|Kenya|Uganda|"
        "Tanzania|Burundi|Rwanda"),
    ("Güney Afrika", "South Africa|Namibia|Botswana|Zimbabwe|Zambia|Mozambique|Malawi|Lesotho|eSwatini"),
    ("Madagaskar", "Madagascar"),
    ("Anadolu ve Kafkasya", "Turkey|Georgia|Armenia|Azerbaijan|N. Cyprus|Cyprus"),
    ("Arap Yarımadası", "Saudi Arabia|Yemen|Oman|United Arab Emirates|Qatar|Kuwait|Iraq|Syria|Jordan|"
        "Israel|Palestine|Lebanon"),
    ("Orta Asya", "Kazakhstan|Uzbekistan|Turkmenistan|Kyrgyzstan|Tajikistan|Iran|Afghanistan"),
    ("Hint Alt Kıtası", "India|Pakistan|Nepal|Bhutan|Bangladesh|Sri Lanka"),
    ("Doğu Asya", "China|Mongolia|North Korea|South Korea|Taiwan"),
    ("Japonya", "Japan"),
    ("Hindiçin", "Myanmar|Thailand|Vietnam|Laos|Cambodia"),
    ("Borneo ve Adalar", "Malaysia|Brunei|Indonesia|Philippines|Papua New Guinea|Timor-Leste"),
    ("Avustralya", "Australia"),
    ("Yeni Zelanda", "New Zealand"),
]

# Strategic sea lanes join otherwise disconnected landmasses. Both ends are playable.
LANES = [
    ("Orta Amerika", "Karayipler"), ("Karayipler", "Kuzey Andlar"),
    ("Kanada", "Grönland"), ("Grönland", "Britanya Adaları"), ("Britanya Adaları", "Batı Avrupa"),
    ("Batı Avrupa", "Mağrip"), ("Balkanlar", "Anadolu ve Kafkasya"), ("Doğu Afrika", "Arap Yarımadası"),
    ("Güney Afrika", "Madagaskar"), ("Doğu Asya", "Japonya"), ("Hindiçin", "Borneo ve Adalar"),
    ("Borneo ve Adalar", "Avustralya"), ("Avustralya", "Yeni Zelanda"),
]


def polygons(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [geometry]
    return [part for child in getattr(geometry, "geoms", ()) for part in polygons(child)]


def countries(topology):
    scale_x, scale_y = topology["transform"]["scale"]
    shift_x, shift_y = topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x, y = x + dx, y + dy
            points.append((x * scale_x + shift_x, y * scale_y + shift_y))
        arcs.append(points)

    def ring(sequence):
        points = []
        for index in sequence:
            arc = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
            points.extend(arc if not points else arc[1:])
        return points

    def land_polygon(exterior, holes):
        points = ring(exterior)
        if all(abs(left[0] - right[0]) <= 180 for left, right in zip(points, points[1:])):
            return make_valid(Polygon(points, [ring(hole) for hole in holes]))
        # TopoJSON can join both sides of the date line in one spherical ring.
        # Unwrap before planar clipping so no edge crosses the rest of the map.
        assert not holes
        unwrapped = [points[0]]
        for x, y in points[1:]:
            shift = round((unwrapped[-1][0] - x) / 360) * 360
            unwrapped.append((x + shift, y))
        shape = make_valid(Polygon(unwrapped))
        return union_all([
            translate(shape.intersection(box(shift - 180, -90, shift + 180, 90)), xoff=-shift)
            for shift in [-360, 0, 360]
        ])

    result = {}
    for item in topology["objects"]["countries"]["geometries"]:
        rings = [item["arcs"]] if item["type"] == "Polygon" else item["arcs"]
        result[item["properties"]["name"]] = union_all([
            land_polygon(exterior, holes)
            for exterior, *holes in rings
        ])
    return result


def project(lon, lat):
    # Wide Atlantic-centered atlas, with a gentle high-latitude taper.
    return [round(960 + lon * 4.93 * (0.72 + 0.28 * cos(radians(lat))), 2), round(576 - lat * 5.88, 2)]


def outline(polygon):
    return [project(x, y) for x, y in polygon.exterior.coords[:-1]]


def bake(source):
    land = countries(source)
    land.pop("Antarctica")
    land.pop("Fr. S. Antarctic Lands")
    usa = polygons(land.pop("United States of America"))
    alaska = [part for part in usa if part.centroid.y > 50 and abs(part.centroid.x) > 125]
    land["Alaska"] = union_all(alaska)
    land["United States of America"] = union_all([part for part in usa if part not in alaska])
    russia = land.pop("Russia")
    # Split at an existing southern-border vertex to preserve the shared topology.
    western_russia = box(0, 0, 59.93159931599317, 90)
    land["Batı Rusya"] = russia.intersection(western_russia)
    land["Sibirya"] = russia.difference(western_russia)
    # The world-atlas France feature contains the mainland and French Guiana.
    france = polygons(land["France"])
    land["France"] = union_all([part for part in france if part.centroid.y > 30])
    land["Guyana"] = union_all([land["Guyana"], *[part for part in france if part.centroid.y <= 30]])
    # Snap the source's quantization slivers to a common grid before simplifying shared edges.
    shapes = [set_precision(union_all([land.pop(country) for country in group.split("|")]), 0.001)
              for _, group in ZONES]
    assert set(land) == {"Fiji", "Falkland Is.", "Vanuatu", "New Caledonia", "Solomon Is.", "Iceland"}, sorted(land)
    assert coverage_is_valid(shapes), "Land polygons must share edges without overlaps"
    simplified = coverage_simplify(shapes, 0.25)
    pieces = [sorted(polygons(group), key=lambda part: -part.area) for group in simplified]
    mainland = [parts[0] for parts in pieces]
    neighbors = [set() for _ in mainland]
    for left, polygon in enumerate(mainland):
        for right in range(left + 1, len(mainland)):
            if polygon.boundary.intersection(mainland[right].boundary).length > 0.12:
                neighbors[left].add(right)
                neighbors[right].add(left)

    routes = []
    ids = {name: index for index, (name, _) in enumerate(ZONES)}
    for left_name, right_name in LANES:
        left, right = ids[left_name], ids[right_name]
        if right not in neighbors[left]:
            a, b = nearest_points(mainland[left], mainland[right])
            routes.append([project(a.x, a.y), project(b.x, b.y)])
        neighbors[left].add(right)
        neighbors[right].add(left)

    visited = {0}
    frontier = [0]
    while frontier:
        unexplored = neighbors[frontier.pop()] - visited
        visited.update(unexplored)
        frontier.extend(unexplored)
    assert len(visited) == len(ZONES), [ZONES[i][0] for i in range(len(ZONES)) if i not in visited]

    # Everything outside each region's main landmass remains visible as coastline detail.
    islands = [part for parts in pieces for part in parts[1:]]
    islands.extend(part for group in land.values() for part in polygons(group))
    return {
        "schemaVersion": 1,
        "regions": [
            {"name": name, "center": project(center.x, center.y), "polygon": outline(polygon),
             "neighbors": sorted(neighbors[index])}
            for index, ((name, _), polygon) in enumerate(zip(ZONES, mainland))
            for center in [polylabel(polygon, tolerance=0.08)]
        ],
        "islands": [outline(part) for part in islands if part.area > 0.16],
        "seaRoutes": routes,
        "oceanLabels": [[name, project(lon, lat)] for name, lon, lat in [
            ("PASİFİK OKYANUSU", -135, 10), ("ATLAS OKYANUSU", -40, 24),
            ("HİNT OKYANUSU", 73, -24),
        ]],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Natural Earth world-atlas countries-110m.json")
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[1] / "assets/maps/world.json"
    atlas = bake(json.loads(args.source.read_text(encoding="utf-8")))
    target.write_text(json.dumps(atlas, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{target.name}: {len(atlas['regions'])} regions, {len(atlas['islands'])} islands, {len(atlas['seaRoutes'])} sea routes")
