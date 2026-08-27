import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import bgPng   from './asset/background.png';
import dog1Png from './asset/dog1.png';
import dog2Png from './asset/dog2.png';
import ufoPng  from './asset/UFO.png';
import cgAlienPng from './asset/isei1.png';
import run1Png from '../dino/Assets/06_walk1.png';
import run2Png from '../dino/Assets/06_walk2.png';
import run3Png from '../dino/Assets/06_walk3.png';

interface GameProps { onClose: () => void; lang?: 'zh' | 'en'; }

const CW = 400, CH = 300, GY = 260;
const D1W = 56, D1H = 44;
const D2W = 60, D2H = 48;
const DOG_W = D1W, DOG_H = D1H;
const GROUND_LEVEL = GY - DOG_H;   // 216
const UFO_IW = 99, UFO_IH = 54;
const UFO_BASE_Y = 58, UFO_BOB = 10;
const RW = 38, RH = 43, RUNNER_SPEED = 3;
const GRAVITY = 0.32, JUMP_POWER = -9;

type BeamPhase  = 'off' | 'warning' | 'active';
type DeathCause = 'alien' | 'human' | 'won';
interface MStar  { id:number; x:number; y:number; vy:number; landed:boolean; landMs:number; done:boolean; }
interface Flower { id:number; x:number; ms:number; done:boolean; }
interface Runner { id:number; x:number; frame:number; ft:number; }

const overlaps = (ax:number,ay:number,aw:number,ah:number,
                  bx:number,by:number,bw:number,bh:number) =>
  ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;

const UFOGame: React.FC<GameProps> = ({ onClose, lang = 'zh' }) => {
  // 英文为草译，待审校 → translations-review.md
  const T = lang === 'en'
    ? { won: 'Caught the alien!', byHuman: 'Caught by the humans!', byAlien: 'Abducted by the alien!', retry: 'Try again', finalScore: 'Final score', title: 'My Coworker Is an Alien?!', start: 'Click / press Space to start', jump: 'Jump', move: 'Move', jumpWord: 'Jump', hintTail: "You can't be caught while jumping", hintMobile: '\u25c0\u25b6 Move \u00b7 \u2191 Jump \u00b7 Safe while jumping', close: 'Close' }
    : { won: '抓到外星人了！', byHuman: '被人类抓走了！', byAlien: '被外星人抓走了！', retry: '再试一次', finalScore: '最终得分', title: '同事是外星人？！', start: '点击 / 按空格开始', jump: '跳', move: '移动', jumpWord: '跳', hintTail: '跳跃的时候是不会被抓到的', hintMobile: '\u25c0\u25b6移动 \u00b7 \u2191跳 \u00b7 跳跃时不会被抓', close: '关闭' };
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [gameOver,  setGameOver]  = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const scoreRef  = useRef(0);
  const leftHeld  = useRef(false);
  const rightHeld = useRef(false);

  const imgBg   = useRef<HTMLImageElement|null>(null);
  const imgDog1 = useRef<HTMLImageElement|null>(null);
  const imgDog2 = useRef<HTMLImageElement|null>(null);
  const imgUFO  = useRef<HTMLImageElement|null>(null);
  const imgCgAlien = useRef<HTMLImageElement|null>(null);
  const imgRun  = useRef<HTMLImageElement[]>([]);
  const runLoaded = useRef(false);

  // Joystick
  const [joyKnob, setJoyKnob] = useState({ x: 0 });
  const joyStart = useRef<number | null>(null);

  const S = useRef({
    dog: { x: CW/2-DOG_W/2, y: GROUND_LEVEL, vy: 0, onGround: true },
    facingRight: false,
    ufoX: CW/2, ufoY: UFO_BASE_Y,
    sineT: 0,
    beamPhase: 'off' as BeamPhase,
    beamTimer: 2500, warnDur: 900, onDur: 1500, offDur: 2500,
    track: 0.012, lastScore: 0, lastFrame: 0, animId: 0, diffT: 0,
    deathCause: 'alien' as DeathCause,
    overFadeStart: 0,
    uid: 0,
    stars: [] as MStar[], flowers: [] as Flower[], runners: [] as Runner[],
    // UFO damage system
    ufoHits: 0,
    ufoHitCooldown: 0,
    ufoStunned: false,
    ufoStunTimer: 0,
    ufoStunCount: 0,     // total times stunned (0-3)
    ufoFalling: false,
    ufoFallVy: 0,
    ufoGrounded: false,
    ufoGroundedTimer: 0,
  });

  useEffect(() => {
    const load = (src: string, ref: React.MutableRefObject<HTMLImageElement|null>) => {
      const img = new Image(); img.src = src; ref.current = img;
    };
    load(bgPng, imgBg); load(dog1Png, imgDog1); load(dog2Png, imgDog2); load(ufoPng, imgUFO);
    load(cgAlienPng, imgCgAlien);
    let n = 0;
    const runs = [run1Png, run2Png, run3Png].map(src => {
      const img = new Image();
      img.onload = () => { if (++n === 3) runLoaded.current = true; };
      img.src = src; return img;
    });
    imgRun.current = runs;
  }, []);

  const reset = () => {
    const s = S.current;
    s.dog = { x: CW/2-DOG_W/2, y: GROUND_LEVEL, vy: 0, onGround: true };
    s.facingRight = false;
    s.ufoX = CW/2; s.ufoY = UFO_BASE_Y; s.sineT = 0;
    s.beamPhase = 'off'; s.beamTimer = 2500;
    s.warnDur = 900; s.onDur = 1500; s.offDur = 2500;
    s.track = 0.012; s.diffT = 0;
    s.deathCause = 'alien';
    s.overFadeStart = 0;
    s.stars = []; s.flowers = []; s.runners = [];
    s.ufoHits = 0; s.ufoHitCooldown = 0;
    s.ufoStunned = false; s.ufoStunTimer = 0; s.ufoStunCount = 0;
    s.ufoFalling = false; s.ufoFallVy = 0;
    s.ufoGrounded = false; s.ufoGroundedTimer = 0;
    scoreRef.current = 0;
    const now = performance.now();
    s.lastScore = now; s.lastFrame = now;
  };

  const beamTopY = () => S.current.ufoY + UFO_IH / 2;
  const inBeamX  = () => {
    const { dog, ufoX, ufoY } = S.current;
    const cx = dog.x+DOG_W/2, cy = dog.y+DOG_H/2;
    const bTop = ufoY + UFO_IH/2;
    const t = Math.max(0, Math.min(1, (cy-bTop) / (GY-bTop)));
    return Math.abs(cx - ufoX) < 12 + 38*t;
  };

  const handleJump = useCallback(() => {
    const d = S.current.dog;
    if (d.onGround) { d.vy = JUMP_POWER; d.onGround = false; }
  }, []);

  const handleJoyDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyStart.current = e.clientX;
    if (!isPlaying || gameOver) handleAction();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, gameOver]);

  const handleJoyMove = useCallback((e: React.PointerEvent) => {
    if (joyStart.current === null) return;
    const dx = e.clientX - joyStart.current;
    const MAX = 30;
    const clamped = Math.max(-MAX, Math.min(MAX, dx));
    setJoyKnob({ x: clamped });
    const DEAD = 8;
    leftHeld.current  = clamped < -DEAD;
    rightHeld.current = clamped >  DEAD;
    if (leftHeld.current  && !rightHeld.current) S.current.facingRight = false;
    if (rightHeld.current && !leftHeld.current)  S.current.facingRight = true;
  }, []);

  const handleJoyUp = useCallback(() => {
    joyStart.current  = null;
    setJoyKnob({ x: 0 });
    leftHeld.current  = false;
    rightHeld.current = false;
  }, []);

  const handleAction = useCallback(() => {
    if (gameOver)        { reset(); setGameOver(false); setIsPlaying(true); }
    else if (!isPlaying) { reset(); setIsPlaying(true); }
  }, [gameOver, isPlaying]);

  // ── Smoke helper ────────────────────────────────────────────────────────────
  const drawSmoke = (ctx: CanvasRenderingContext2D, cx: number, topY: number,
                     scale: number, now: number, continuous: boolean) => {
    const count  = continuous ? 8 : 5;
    const period = continuous ? 280 : 220;
    for (let i = 0; i < count; i++) {
      const t = ((now / period) + i * (3 / count)) % 3;
      const rise  = t * 18;
      const fade  = 1 - t / 3;
      const r     = scale * (6 + t * 3);
      const ox    = Math.sin(t * 2.5 + i * 1.1) * (scale * 8);
      ctx.globalAlpha = fade * 0.65;
      ctx.fillStyle   = '#C8C8C8';
      ctx.beginPath();
      ctx.arc(cx + ox, topY - rise, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, now: number) => {
    const s = S.current;
    ctx.imageSmoothingEnabled = false;

    // Background
    const bg = imgBg.current;
    if (bg && bg.complete && bg.naturalWidth > 0) {
      const sc = CH / bg.naturalHeight;
      const tw = bg.naturalWidth * sc;
      for (let x = 0; x < CW; x += tw) ctx.drawImage(bg, x, 0, tw, CH);
    } else {
      ctx.fillStyle = '#1A0A2E'; ctx.fillRect(0, 0, CW, CH);
    }

    // Beam (suppress when UFO falling/grounded or stunned)
    if (!s.ufoFalling && !s.ufoGrounded && !s.ufoStunned) {
      const btY = beamTopY();
      ctx.beginPath();
      ctx.moveTo(s.ufoX-12,btY); ctx.lineTo(s.ufoX+12,btY);
      ctx.lineTo(s.ufoX+50,GY);  ctx.lineTo(s.ufoX-50,GY);
      ctx.closePath();
      if (s.beamPhase === 'active') {
        ctx.fillStyle='rgba(160,220,255,0.65)'; ctx.fill();
        ctx.strokeStyle='rgba(200,240,255,0.45)'; ctx.lineWidth=1.5; ctx.stroke();
      } else if (s.beamPhase === 'warning') {
        const fl = Math.floor(now/120)%2===0;
        ctx.fillStyle   = fl ? 'rgba(255,200,80,0.38)' : 'rgba(255,140,40,0.18)'; ctx.fill();
        ctx.strokeStyle = fl ? 'rgba(255,200,80,0.7)'  : 'rgba(255,140,40,0.3)';  ctx.lineWidth=1.5; ctx.stroke();
      } else {
        ctx.fillStyle='rgba(120,180,220,0.10)'; ctx.fill();
      }
    }

    // UFO image
    const ux = s.ufoX, uy = s.ufoY;
    const uImg = imgUFO.current;
    if (uImg && uImg.complete) {
      ctx.drawImage(uImg, ux-UFO_IW/2, uy-UFO_IH/2, UFO_IW, UFO_IH);
    }

    // Damage lights (along saucer rim)
    const lightY = uy + 12;
    const showAllRed = s.ufoFalling || s.ufoGrounded || (s.ufoStunned && s.ufoHits >= 3);
    [ux-22, ux, ux+22].forEach((lx, i) => {
      const red = showAllRed || i < s.ufoHits;
      if (red) { ctx.shadowBlur=8; ctx.shadowColor='#FF4400'; ctx.fillStyle='#FF2200'; }
      else      { ctx.shadowBlur=0; ctx.fillStyle='#555'; }
      ctx.beginPath(); ctx.arc(lx, lightY, 5, 0, Math.PI*2); ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Warning "!" — bigger, with glow circle behind
    if (!s.ufoFalling && !s.ufoGrounded && s.beamPhase==='warning' && Math.floor(now/180)%2===0) {
      const excY = uy - UFO_IH/2 - 8;
      ctx.fillStyle = 'rgba(255,140,0,0.28)';
      ctx.beginPath(); ctx.arc(ux, excY-6, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#FFB800'; ctx.font='bold 24px monospace'; ctx.textAlign='center';
      ctx.fillText('!', ux, excY); ctx.textAlign='left';
    }

    // Smoke (scale grows with stun count)
    const smokeScale = s.ufoGrounded ? 3.2 : s.ufoFalling ? 2.6 : 1 + (s.ufoStunCount-1)*0.85;
    if (s.ufoStunned || s.ufoFalling || s.ufoGrounded) {
      drawSmoke(ctx, ux, uy - UFO_IH/2, smokeScale, now, s.ufoGrounded);
    }

    // Mint stars — bigger sparkle
    s.stars.forEach(st => {
      if (st.done) return;
      const cy = st.landed ? GY-10 : st.y;
      if (st.landed && st.landMs < 500) ctx.globalAlpha = st.landMs/500;
      ctx.fillStyle = '#6BD4C0';
      ctx.fillRect(st.x-3, cy-3, 6, 6);
      ctx.fillRect(st.x-2, cy-12, 4,  9); ctx.fillRect(st.x-2, cy+5,  4, 9);
      ctx.fillRect(st.x-12,cy-2,  9,  4); ctx.fillRect(st.x+5, cy-2,  9, 4);
      ctx.fillStyle='rgba(107,212,192,0.55)';
      ctx.fillRect(st.x-6, cy-6, 3, 3); ctx.fillRect(st.x+4, cy-6, 3, 3);
      ctx.fillRect(st.x-6, cy+4, 3, 3); ctx.fillRect(st.x+4, cy+4, 3, 3);
      ctx.globalAlpha=1;
    });

    // Flowers — bigger
    s.flowers.forEach(fl => {
      if (fl.done) return;
      if (fl.ms < 500) ctx.globalAlpha = fl.ms/500;
      const fx = Math.floor(fl.x);
      // stem
      ctx.fillStyle='#3D7A50'; ctx.fillRect(fx-2, GY-16, 4, 15);
      // petals
      ctx.fillStyle='#9D7FFF';
      ctx.fillRect(fx-10,GY-26,7,7); ctx.fillRect(fx+3, GY-26,7,7);
      ctx.fillRect(fx-3, GY-33,7,7); ctx.fillRect(fx-3, GY-19,7,7);
      // center
      ctx.fillStyle='#E0C8FF'; ctx.fillRect(fx-3,GY-26,7,7);
      ctx.globalAlpha=1;
    });

    // Dog
    const { dog, facingRight } = s;
    const dImg  = dog.onGround ? imgDog1.current : imgDog2.current;
    const dImgW = dog.onGround ? D1W : D2W;
    const dImgH = dog.onGround ? D1H : D2H;
    ctx.save();
    ctx.translate(dog.x+DOG_W/2, dog.y+DOG_H/2);
    if (facingRight) ctx.scale(-1, 1);
    if (!dog.onGround) ctx.rotate(dog.vy < 0 ? -0.30 : 0.22);
    if (dImg && dImg.complete) ctx.drawImage(dImg, -dImgW/2, -dImgH/2, dImgW, dImgH);
    else { ctx.fillStyle='#8B5E3C'; ctx.fillRect(-DOG_W/2,-DOG_H/2,DOG_W,DOG_H); }
    ctx.restore();

    // Dino runners
    s.runners.forEach(r => {
      if (runLoaded.current) {
        const img = imgRun.current[r.frame];
        if (img?.complete) ctx.drawImage(img, r.x, GY-RH, RW, RH);
      } else {
        ctx.fillStyle='#6BD4C0'; ctx.fillRect(r.x, GY-RH, RW, RH);
      }
    });

    // Score
    ctx.fillStyle='#D4A8FF'; ctx.font='bold 14px monospace'; ctx.textAlign='left';
    ctx.fillText(`Score: ${scoreRef.current}`, 10, 24);

    // Overlays
    if (gameOver) {
      if (!s.overFadeStart) s.overFadeStart = now;
      const fadeT = now - s.overFadeStart;
      // CG 900ms 渐入；文字延迟 400ms 后 600ms 渐入
      const cgAlpha   = Math.min(1, fadeT / 900);
      const textAlpha = Math.min(1, Math.max(0, (fadeT - 400) / 600));
      const isAlienEnd = s.deathCause !== 'won' && s.deathCause !== 'human';
      const cg = imgCgAlien.current;
      if (isAlienEnd && cg && cg.complete && cg.naturalWidth > 0) {
        // 结局CG：按高铺满，右对齐，多余部分裁掉左侧
        const sc = CH / cg.naturalHeight;
        const dw = cg.naturalWidth * sc;
        ctx.globalAlpha = cgAlpha;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(cg, CW - dw, 0, dw, CH);
        ctx.imageSmoothingEnabled = false;
        // 轻压暗保证文字可读
        ctx.fillStyle='rgba(10,10,40,0.30)'; ctx.fillRect(0,0,CW,CH);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = cgAlpha;
        ctx.fillStyle='rgba(26,10,46,0.72)'; ctx.fillRect(0,0,CW,CH);
        ctx.globalAlpha = 1;
      }
      const wonIt = s.deathCause === 'won';
      // 外星人结局文字移到顶部，避免盖住CG人物
      const yMsg   = isAlienEnd ? 34 : CH/2-22;
      const yRetry = isAlienEnd ? 58 : CH/2+10;
      const yScore = isAlienEnd ? 78 : CH/2+34;
      ctx.globalAlpha = textAlpha;
      if (isAlienEnd) { ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,0,30,0.9)'; }
      ctx.fillStyle = wonIt ? '#6BD4C0' : '#F2B6FB';
      ctx.font='bold 20px monospace'; ctx.textAlign='center';
      const msg = s.deathCause==='won'   ? T.won
                : s.deathCause==='human' ? T.byHuman
                :                          T.byAlien;
      ctx.fillText(msg, CW/2, yMsg);
      ctx.fillStyle = isAlienEnd ? '#D8CCE8' : '#9D8AB5'; ctx.font='14px monospace';
      ctx.fillText(T.retry, CW/2, yRetry);
      ctx.fillStyle='#6BD4C0'; ctx.font='12px monospace';
      ctx.fillText(`${T.finalScore}: ${scoreRef.current}`, CW/2, yScore);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign='left';
    } else if (!isPlaying) {
      ctx.fillStyle='rgba(26,10,46,0.55)'; ctx.fillRect(0,0,CW,CH);
      ctx.fillStyle='#C8A8FF'; ctx.font='bold 18px monospace'; ctx.textAlign='center';
      ctx.fillText(T.title, CW/2, CH/2-20);
      ctx.fillStyle='#9D8AB5'; ctx.font='13px monospace';
      ctx.fillText(T.start, CW/2, CH/2+10);
      ctx.textAlign='left';
    }
  }, [gameOver, isPlaying]);

  // ── Game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = CW; canvas.height = CH;

    const loop = (now: number) => {
      const s = S.current;
      const dt = Math.min(now - s.lastFrame, 50);
      s.lastFrame = now;

      if (isPlaying && !gameOver) {
        const { dog } = s;

        // Dog facing direction
        if (leftHeld.current  && !rightHeld.current) s.facingRight = false;
        if (rightHeld.current && !leftHeld.current)  s.facingRight = true;

        // Dog movement + physics
        if (leftHeld.current)  dog.x = Math.max(0, dog.x-3);
        if (rightHeld.current) dog.x = Math.min(CW-DOG_W, dog.x+3);
        if (!dog.onGround) {
          dog.vy += GRAVITY; dog.y += dog.vy;
          if (dog.y >= GROUND_LEVEL) { dog.y=GROUND_LEVEL; dog.vy=0; dog.onGround=true; }
        }

        // UFO vertical bob (always, including during stun/fall)
        s.sineT += dt;
        if (!s.ufoFalling && !s.ufoGrounded) {
          s.ufoY = UFO_BASE_Y + Math.sin(s.sineT * 0.0012) * UFO_BOB;
        }

        // UFO falling
        if (s.ufoFalling && !s.ufoGrounded) {
          s.ufoFallVy += 0.18;
          s.ufoY += s.ufoFallVy;
          if (s.ufoY + UFO_IH/2 >= GY) {
            s.ufoY = GY - UFO_IH/2;
            s.ufoGrounded = true;
          }
        }

        // Delay before win screen (see UFO crash and smoke a bit)
        if (s.ufoGrounded) {
          s.ufoGroundedTimer += dt;
          if (s.ufoGroundedTimer >= 1800) {
            s.deathCause = 'won';
            setGameOver(true); setIsPlaying(false);
          }
        }

        // UFO stun countdown
        if (s.ufoStunned) {
          s.ufoStunTimer -= dt;
          if (s.ufoStunTimer <= 0) {
            s.ufoStunned = false; s.ufoStunTimer = 0;
            s.beamPhase = 'off'; s.beamTimer = s.offDur;
          }
        }

        // UFO horizontal tracking (only when not stunned/falling/grounded)
        if (!s.ufoStunned && !s.ufoFalling && !s.ufoGrounded) {
          const dogCx = dog.x + DOG_W/2;
          s.ufoX += (dogCx - s.ufoX) * s.track * (dt/16);
          s.ufoX += Math.sin(s.sineT * 0.0008) * 0.4;
          s.ufoX = Math.max(UFO_IW/2+4, Math.min(CW-UFO_IW/2-4, s.ufoX));
        }

        // UFO hit cooldown
        if (s.ufoHitCooldown > 0) s.ufoHitCooldown -= dt;

        // Dog touches UFO
        if (!s.ufoFalling && !s.ufoGrounded && !s.ufoStunned && s.ufoHitCooldown <= 0 &&
            overlaps(dog.x,dog.y,DOG_W,DOG_H, s.ufoX-UFO_IW/2,s.ufoY-UFO_IH/2,UFO_IW,UFO_IH)) {
          s.ufoHits += 1;
          s.ufoHitCooldown = 1200;
          if (s.ufoHits >= 3) {
            s.ufoStunCount += 1;
            if (s.ufoStunCount >= 3) {
              // 3rd stun → UFO falls
              s.ufoFalling = true; s.ufoFallVy = 0;
              s.ufoStunned = false; s.ufoHits = 3; // keep all red
              s.beamPhase = 'off';
            } else {
              // Normal stun (1st or 2nd)
              s.ufoStunned = true; s.ufoStunTimer = 3000; s.ufoHits = 3;
              s.beamPhase = 'off';
            }
          }
        }

        // Beam state machine
        if (!s.ufoStunned && !s.ufoFalling && !s.ufoGrounded) {
          s.beamTimer -= dt;
          if (s.beamTimer <= 0) {
            if      (s.beamPhase==='off')     { s.beamPhase='warning'; s.beamTimer=s.warnDur; }
            else if (s.beamPhase==='warning') { s.beamPhase='active';  s.beamTimer=s.onDur;   }
            else                              { s.beamPhase='off';     s.beamTimer=s.offDur;  }
          }
        } else {
          s.beamPhase = 'off';
        }

        // Beam capture
        if (s.beamPhase==='active' && dog.onGround && inBeamX()) {
          s.deathCause='alien'; setGameOver(true); setIsPlaying(false);
        }

        // Mint stars — slow floaty fall
        s.stars = s.stars.filter(st => !st.done);
        for (const st of s.stars) {
          if (!st.landed) {
            st.vy += 0.05; st.y += st.vy;
            if (st.y >= GY-10) { st.y=GY-10; st.landed=true; }
          } else {
            st.landMs -= dt;
            if (st.landMs <= 0) { st.done=true; continue; }
          }
          const cy = st.landed ? GY-10 : st.y;
          if (overlaps(dog.x,dog.y,DOG_W,DOG_H, st.x-10,cy-10,20,20)) {
            st.done=true; scoreRef.current+=1;
          }
        }

        // Flowers
        s.flowers = s.flowers.filter(fl => !fl.done);
        for (const fl of s.flowers) {
          fl.ms -= dt;
          if (fl.ms <= 0) { fl.done=true; continue; }
          if (overlaps(dog.x,dog.y,DOG_W,DOG_H, fl.x-11,GY-33,22,33)) {
            fl.done=true; scoreRef.current+=1;
          }
        }

        // Dino runners
        s.runners = s.runners.filter(r => r.x > -RW-10);
        for (const r of s.runners) {
          r.x -= RUNNER_SPEED; r.ft++;
          if (r.ft >= 8) { r.ft=0; r.frame=(r.frame+1)%3; }
          if (overlaps(dog.x+4,dog.y+4,DOG_W-8,DOG_H-4, r.x+4,GY-RH+5,RW-8,RH-10)) {
            s.deathCause='human'; setGameOver(true); setIsPlaying(false);
          }
        }

        // Timed score + spawn
        if (now - s.lastScore >= 1000) {
          s.lastScore = now; scoreRef.current += 1;
          const str = String(scoreRef.current);
          if (str.includes('67')) s.runners.push({ id:s.uid++, x:CW+5, frame:0, ft:0 });
          if (str.includes('6'))  s.stars.push({ id:s.uid++, x:s.ufoX+(Math.random()-.5)*20,
              y:s.ufoY+UFO_IH/2+2, vy:0.4, landed:false, landMs:1200, done:false });
          if (str.includes('7'))  s.flowers.push({ id:s.uid++, x:20+Math.random()*(CW-40), ms:2800, done:false });
        }

        // Difficulty every 10s
        s.diffT += dt;
        if (s.diffT >= 10000) {
          s.diffT=0;
          s.track  =Math.min(s.track+0.005, 0.06);
          s.offDur =Math.max(s.offDur-200,  1000);
          s.onDur  =Math.min(s.onDur+100,   2500);
          s.warnDur=Math.max(s.warnDur-50,  500);
        }
      }

      drawFrame(ctx, now);
      s.animId = requestAnimationFrame(loop);
    };

    S.current.animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(S.current.animId);
  }, [isPlaying, gameOver, drawFrame]);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code==='ArrowLeft'  || e.code==='KeyA') leftHeld.current  = true;
      if (e.code==='ArrowRight' || e.code==='KeyD') rightHeld.current = true;
      if (e.code==='Space') { e.preventDefault(); handleAction(); }
      if (e.code==='ArrowUp' || e.code==='KeyW') {
        e.preventDefault();
        if (isPlaying && !gameOver) handleJump();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code==='ArrowLeft'  || e.code==='KeyA') leftHeld.current  = false;
      if (e.code==='ArrowRight' || e.code==='KeyD') rightHeld.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [handleAction, handleJump, isPlaying, gameOver]);

  return (
    <div className="fixed inset-0 bg-[#0D0518]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A0A2E] border border-[#3D2860] rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-5 max-w-lg w-full animate-float-in">
        <div className="flex justify-end mb-3">
          <button onClick={onClose} className="p-2 hover:bg-[#3D2860] rounded-full transition-colors duration-300" aria-label={T.close}>
            <X size={20} strokeWidth={1.5} className="text-[#9D8AB5]" />
          </button>
        </div>
        <div className="rounded-3xl overflow-hidden border border-[#3D2860]">
          <canvas ref={canvasRef} className="w-full h-auto block cursor-pointer" onClick={handleAction} />
        </div>
        {/* Mobile controls — joystick left, jump right */}
        <div
          className="md:hidden flex items-center justify-between px-4 mt-4 select-none"
          style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {/* Joystick */}
          <div
            className="relative w-24 h-24 rounded-full bg-[#2D1B4E] border-2 border-[#3D2860] touch-none flex-shrink-0 flex items-center justify-center"
            style={{ touchAction: 'none' }}
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyUp}
            onPointerLeave={handleJoyUp}
            onPointerCancel={handleJoyUp}
          >
            {/* rail hints */}
            <span className="absolute left-2 text-[#3D2860] text-sm pointer-events-none">◀</span>
            <span className="absolute right-2 text-[#3D2860] text-sm pointer-events-none">▶</span>
            {/* knob */}
            <div
              className="absolute w-10 h-10 rounded-full bg-[#5D3B8E] border-2 border-[#9D8AB5] pointer-events-none"
              style={{ transform: `translate(${joyKnob.x}px, 0)` }}
            />
          </div>

          {/* Jump */}
          <div
            className="w-24 h-24 rounded-full bg-[#3D1B6E] border-2 border-[#5D3B8E] touch-none flex-shrink-0 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
            style={{ touchAction: 'none' }}
            onPointerDown={() => { if (!isPlaying || gameOver) handleAction(); else handleJump(); }}
          >
            <span className="text-2xl pointer-events-none">↑</span>
            <span className="text-xs text-[#D4A8FF] pointer-events-none">{T.jump}</span>
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="hidden md:block text-xs text-[#5D4A6E]">
            <kbd className="px-1.5 py-0.5 bg-[#2D1B4E] rounded text-[#9D8AB5]">←</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-[#2D1B4E] rounded text-[#9D8AB5]">→</kbd>{' '}
            {T.move} ·{' '}
            <kbd className="px-1.5 py-0.5 bg-[#2D1B4E] rounded text-[#9D8AB5]">↑</kbd>{' / '}
            <kbd className="px-1.5 py-0.5 bg-[#2D1B4E] rounded text-[#9D8AB5]">W</kbd>{' '}
            {T.jumpWord} · {T.hintTail}
          </p>
          <p className="md:hidden text-xs text-[#5D4A6E]">{T.hintMobile}</p>
        </div>
      </div>
    </div>
  );
};

export default UFOGame;
