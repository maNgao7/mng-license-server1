"""Prepare spectator settings in the isolated copy, including its cached ZIP."""
import copy
import json
import os
from pathlib import Path
import re
import shutil
import zipfile

root=Path('D:/TikMnG/Hediye-Box-Private').resolve()
game=(root/'native-game').resolve()
if not game.is_relative_to(root):raise RuntimeError('Unexpected private copy')
backups=root/'original-assets'
backups.mkdir(exist_ok=True)
def backup(source,name):
    dest=backups/name
    if not dest.exists():shutil.copy2(source,dest)
properties=game/'properties'
gameplay=properties/'gameplay_settings.properties'
physics=properties/'physics_settings.properties'
for p in [gameplay,physics]:backup(p,p.name)
data=gameplay.read_text()
for key,value in [('presentation_time','0'),('tale_of_the_tape_time','0')]:
    data=re.sub(r'(?m)^'+key+r'\s*=.*$',key+' = '+value,data)
gameplay.write_text(data)
physics.write_text(re.sub(r'(?m)^ring_width\s*=.*$','ring_width = 90',physics.read_text()))
movement_names=['basestyles.json','customstyle_defaults.json',
                'stunned_body_settings.json','stunned_head_settings.json',
                'fall_from_head_punch.json','boxer_ai.json']
for name in movement_names:
    source=properties/name
    backup(source,name)
    shutil.copyfile(backups/name,source)
    if name=='boxer_ai.json':
        behavior=json.loads(source.read_text())
        behavior['do_nothing_count']=[0,0]
        behavior['do_nothing_rnd']=0
        behavior['combo_pause']=0
        source.write_text(json.dumps(behavior,indent=2))
    if name=='customstyle_defaults.json':
        defaults=json.loads(source.read_text())
        defaults['neck_max']=15
        defaults['bob_weave_max_modifier']=10
        defaults['bone_tilts']=[[bone,5] for bone,_angle in defaults['bone_tilts']]
        source.write_text(json.dumps(defaults,indent=2))
    if name=='basestyles.json':
        styles=json.loads(source.read_text())
        classic=next(style for style in styles['styles'] if style['name']=='Classic')
        guard_id=classic['normal_stance']['arms_style_id']
        for style in styles['styles']:
            # Both viewers use the same original Classic jab/cross. Retain
            # style identity and the native locomotion definitions.
            for punch in ['jab','cross']:
                style[punch]=copy.deepcopy(classic[punch])
            stance=style['normal_stance']
            stance_width=stance['legs']['facing']['squared_config']['wide']
            for punch in ['jab','cross']:
                style[punch]['wide_start']=stance_width
                style[punch]['wide_end']=stance_width
            stance['spine']['tilt_dir']=[0,0]
            stance['spine']['neck_style']['up']=0
            stance['spine']['crouch']['pct']=0
            stance['arms_style_id']=guard_id
            stance['coverup_id']=guard_id
            stance['coverup_hooks_id']=guard_id
        source.write_text(json.dumps(styles,indent=2))
archive=properties/'game_6.0_1795342549.zip'
backup(archive,archive.name)
with zipfile.ZipFile(archive) as current:
    items=[(i,current.read(i.filename)) for i in current.infolist()]
temporary=archive.with_suffix('.spectator.tmp.zip')
with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_DEFLATED) as updated:
    for info,value in items:
        updated.writestr(info,(properties/info.filename).read_bytes()
            if info.filename in [gameplay.name,physics.name]+movement_names else value)
os.replace(temporary,archive)
settings=game/'config/settings.json'
backup(settings,'spectator-original-settings.json')
value=json.loads(settings.read_text())
value.update(show_health_bars_hud=False,show_timer_hud=False,show_fps_hud=False,selected_camera='FlyAroundCamera')
settings.write_text(json.dumps(value))
keyboard=game/'config/controls/keyboard_config.json_Player1'
backup(keyboard,'spectator-original-keyboard.json')
keyboard.write_text(json.dumps({'keybindings':[]}))
print('Private ring settings and cached package prepared. Steam installation unchanged.')
