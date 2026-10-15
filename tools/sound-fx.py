import subprocess,json,pathlib

def run(tool,cfg,*args):
 p=subprocess.run([tool,'--config',cfg,*map(str,args)],capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr)
def config(name,obj):
 p='/tmp/'+name+'cfg.json';pathlib.Path(p).write_text(json.dumps(obj));return p
pathlib.Path('assets/audio').mkdir(exist_ok=True);pathlib.Path('assets/fx').mkdir(exist_ok=True)
for i,name in enumerate(['gas-seep','drill-debris','jetpack-exhaust','ore-sparkle','material-shimmer','gas-explosion','lava-embers','impact-dust','core-extract','core-detonation','launch-exhaust','death-burst']):
 cfg=config('particle',dict(width=256,height=256,duration_ms=1500,fps=30,seed=54+i,actions='/tmp/particleops.json',preview='/tmp/particle.png',system=f'assets/fx/{name}.json'))
 run('particle-2d',cfg,'init')
 color=['#a7c9b8','#b59b77','#ffb45e','#fff1b6','#9bffdc','#ff7d42','#eaba60','#a58b71','#c7a0ff','#ffad65','#edc59e','#8bc8cc'][i]
 run('particle-2d',cfg,'add-emitter','--name','body','--shape','disc','--radius',12,'--x',128,'--y',128,'--burst',12 if i==0 else 42,'--lifetime',1100 if i==0 else 650,'--lifetime-spread',200,'--speed',18 if i==0 else 100 if i<5 else 200,'--speed-spread',10,'--cone-angle',30 if i in [0,2,10] else 180,'--dir-y',-1 if i in [2,10] else 1)
 run('particle-2d',cfg,'set-particle','--emitter','body','--size-from',0.5 if i<5 else 2,'--size-to',1 if i==0 else 0,'--opacity-from',0.16 if i==0 else 0.9,'--opacity-to',0,'--color-gradient',f'{color}@0,#435463@1')
 if i in [5,9]:
  run('particle-2d',cfg,'add-emitter','--name','shock','--shape','disc','--radius',3,'--x',128,'--y',128,'--burst',90,'--lifetime',400,'--speed',330,'--cone-angle',180)
  run('particle-2d',cfg,'set-particle','--emitter','shock','--size-from',1,'--size-to',0.3,'--color-gradient','#fff5d3@0,#ff7b45@1')
 if i in [1,7,11]:run('particle-2d',cfg,'set-forces','--gravity',-170,'--drag',1)
 if i in [0,4,8]:run('particle-2d',cfg,'set-forces','--wind','4,12','--turbulence','7,0.05')
 if i in [2,5,6,9,10]:
  run('particle-2d',cfg,'add-emitter','--name','smoke','--shape','disc','--radius',7,'--x',128,'--y',128,'--burst',30 if i!=9 else 100,'--lifetime',1300,'--speed',45 if i!=9 else 190,'--cone-angle',45 if i in [2,10] else 180,'--dir-y',-1 if i in [2,10] else 1)
  run('particle-2d',cfg,'set-particle','--emitter','smoke','--size-from',1,'--size-to',4 if i!=9 else 8,'--opacity-from',0.25,'--opacity-to',0,'--color-gradient','#9a9185@0,#344550@1')
 if i in [5,9]:
  run('particle-2d',cfg,'add-emitter','--name','flash','--shape','point','--x',128,'--y',128,'--burst',1,'--lifetime',100,'--speed',0)
  run('particle-2d',cfg,'set-particle','--emitter','flash','--size-from',18 if i==5 else 38,'--size-to',0,'--color-gradient','#fff7d0@0,#ffba68@1')
 run('particle-2d',cfg,'render','--frame',12)
for i,name in enumerate(['drill','thrust','ore-pickup','material-chime','gas-explosion','lava-sizzle','impact','fabricate','launch','death','alarm-fuel','alarm-core']):
 dur=700 if i in [0,1,4,8,9] else 350
 cfg=config('sfx',dict(sample_rate=22050,channels='mono',max_duration_ms=2000,seed=17+i,actions='/tmp/sfxops.json',preview='/tmp/sfx.png',wav=f'assets/audio/{name}.wav'))
 run('sfx-synth',cfg,'init')
 run('sfx-synth',cfg,'add-voice','--name','tone','--wave','saw' if i in [0,1] else 'triangle','--freq',[72,56,740,530,48,170,80,440,40,110,380,620][i],'--dur',dur,'--gain',-23)
 run('sfx-synth',cfg,'set-envelope','--voice','tone','--env','gate' if i<2 else 'pluck')
 if i in [0,1,4,5,6,8,9]:
  run('sfx-synth',cfg,'add-voice','--name','grit','--wave','noise','--dur',dur,'--gain',-28)
  run('sfx-synth',cfg,'set-envelope','--voice','grit','--env','punch')
 else:
  run('sfx-synth',cfg,'add-voice','--name','harmony','--wave','sine','--freq',990 if i==2 else 880,'--start',90,'--dur',dur,'--gain',-26)
  run('sfx-synth',cfg,'set-envelope','--voice','harmony','--env','pluck')
 run('sfx-synth',cfg,'render')
cfg=config('music',dict(sample_rate=22050,channels='stereo',max_duration_ms=17000,seed=12,actions='/tmp/musicops.json',preview='/tmp/music.png',wav='assets/audio/music.wav',mid='assets/audio/music.mid'))
run('music',cfg,'init');run('music',cfg,'set-tempo','--bpm',90)
for name,wave in [('abyss','synth_pad'),('signal','vibraphone'),('pulse','bass_electric')]:
 run('music',cfg,'define-track','--name',name,'--instrument',wave);run('music',cfg,'set-track-fx','--track',name,'--gain',-26,'--reverb',0.35,'--env','swell' if name=='abyss' else 'pluck')
for i in range(24):
 run('music',cfg,'add-note','--track','pulse','--pitch',36 if i%4 else 24,'--t',i,'--dur',0.4,'--velocity',65)
 if i%3==0:run('music',cfg,'add-note','--track','signal','--pitch',[60,67,62,63,55,62,58,67][i//3],'--t',i+0.5,'--dur',1.5,'--velocity',55)
 if i%6==0:run('music',cfg,'add-note','--track','abyss','--pitch',[36,39,34,31][i//6],'--t',i,'--dur',6,'--velocity',65)
run('music',cfg,'render')
print('sound and particles complete')
# Layered sample transients give the drill loop and rewards physical weight.
for name,sample,pitch,freq in [('drill','engine_diesel_idle',7,80),('impact','impact_metal_hollow',-5,65),('ore-pickup','mech_clip_load',7,880),('material-chime','clang_metal',12,660),('fabricate','mech_ratchet',3,440),('gas-explosion','cannon_body_heavy',-5,48),('launch','boom_sub_rumble',-7,36)]:
 cfg=config('sample',dict(sample_rate=22050,channels='mono',max_duration_ms=2200,seed=77,actions='/tmp/sampleops.json',preview='/tmp/sample.png',wav=f'assets/audio/{name}.wav',sample_pack='combat-core'))
 run('sfx-sample',cfg,'init');run('sfx-sample',cfg,'add-sample','--name',sample,'--t',0,'--gain',-15,'--pitch',pitch,'--trim','0,650' if name=='drill' else '0,1000','--fade-in',10,'--fade-out',120)
 run('sfx-sample',cfg,'add-voice','--name','resonance','--wave','sine','--freq',freq,'--dur',700,'--gain',-27)
 run('sfx-sample',cfg,'set-envelope','--voice','resonance','--env','pluck');run('sfx-sample',cfg,'render')
