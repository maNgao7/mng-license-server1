"""Validate the version contract used by the released TikMnG launcher."""
import json
from pathlib import Path
import zipfile

VERSION_FILES = ('.tikmng-package.json', 'resources/app/package.json',
                 'resources/app/runtime/native-patch/manifest.json')


def _validate(read, expected):
    records = {}
    for name in VERSION_FILES:
        record = json.loads(read(name).decode('utf-8-sig'))
        if record.get('version') != expected:
            raise ValueError(f'{name}: version {record.get("version")!r} != {expected!r}')
        records[name] = record
    marker = records[VERSION_FILES[0]]
    if marker.get('game') != 'ring' or marker.get('requiresSteamApp') != '4793540':
        raise ValueError('Ring package identity or required Steam app disagrees')
    return records


def validate_tree(root, expected):
    root = Path(root)
    return _validate(lambda name: (root / name).read_bytes(), expected)


def validate_archive(archive, expected):
    with zipfile.ZipFile(archive) as package:
        names = package.namelist()
        for name in VERSION_FILES:
            if names.count(name) != 1:
                raise ValueError(f'{name}: exactly one root-relative record required')
        return _validate(package.read, expected)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', required=True)
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    validate_archive(args.archive, args.version)
    print('Ring archive, application and native manifest versions agree: ' + args.version)
